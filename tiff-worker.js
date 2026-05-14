self.onmessage = async (event) => {
  try {
    const { fileName, buffer } = event.data;
    const customSlices = tryReadUncompressedGrayStack(fileName, buffer);
    if (customSlices) {
      self.postMessage({ type: "done" });
      return;
    }

    importScripts("./vendor/UTIF.js");
    const ifds = self.UTIF.decode(buffer);
    if (!ifds.length) {
      throw new Error("这个 TIFF 没有解析到可用图像页。");
    }

    self.postMessage({ type: "meta", total: ifds.length });

    if (typeof self.UTIF.decodeImage === "function") {
      for (let index = 0; index < ifds.length; index += 1) {
        const ifd = ifds[index];
        self.UTIF.decodeImage(buffer, ifd);
        postSlice(fileName, ifd, index, ifds.length);
      }
    } else {
      self.UTIF.decodeImages(buffer, ifds);
      for (let index = 0; index < ifds.length; index += 1) {
        postSlice(fileName, ifds[index], index, ifds.length);
      }
    }

    self.postMessage({ type: "done" });
  } catch (error) {
    self.postMessage({
      type: "error",
      error:
        `${error.message || "无法解析这个 TIFF。"} ` +
        "如果它是 BigTIFF、OME-TIFF、金字塔全切片图像或超过浏览器内存限制，请先导出为普通多页 TIFF 或降采样后的连续切片。",
    });
  }
};

const TYPE_SIZE = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  11: 4,
  12: 8,
};

function tryReadUncompressedGrayStack(fileName, buffer) {
  const view = new DataView(buffer);
  const byteOrder = String.fromCharCode(view.getUint8(0), view.getUint8(1));
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") return false;
  if (view.getUint16(2, littleEndian) !== 42) return false;

  const ifds = readIfds(view, littleEndian);
  if (!ifds.length) return false;

  const first = ifds[0];
  const width = first[256]?.[0];
  const height = first[257]?.[0];
  const bitsPerSample = first[258]?.[0] || 1;
  const compression = first[259]?.[0] || 1;
  const photometric = first[262]?.[0] || 1;
  const samplesPerPixel = first[277]?.[0] || 1;
  const description = first[270]?.text || "";
  const imageJCount = Number((description.match(/(?:images|slices)=([0-9]+)/i) || [])[1] || 0);
  const total = imageJCount || ifds.length;

  if (!width || !height || bitsPerSample !== 16 || compression !== 1 || samplesPerPixel !== 1 || ![0, 1].includes(photometric)) {
    return false;
  }

  const pageByteLength = width * height * 2;
  const pages = [];

  if (imageJCount && first[273]?.length) {
    const start = first[273][0];
    for (let index = 0; index < imageJCount; index += 1) {
      pages.push({ offset: start + index * pageByteLength, byteLength: pageByteLength });
    }
  } else {
    for (const ifd of ifds) {
      const offsets = ifd[273] || [];
      const counts = ifd[279] || [];
      if (!offsets.length || !counts.length) return false;
      pages.push({ offsets, counts });
    }
  }

  if (!pages.length) return false;
  self.postMessage({ type: "meta", total: pages.length });

  const scale = computeRobustScale(view, pages, width, height, littleEndian);
  for (let index = 0; index < pages.length; index += 1) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    writePageToRgba(view, pages[index], rgba, width, height, littleEndian, scale);
    self.postMessage(
      {
        type: "slice",
        total: pages.length,
        name: `${fileName} #${String(index + 1).padStart(3, "0")}`,
        width,
        height,
        rgba: rgba.buffer,
      },
      [rgba.buffer],
    );
  }
  return true;
}

function readIfds(view, littleEndian) {
  const ifds = [];
  let offset = view.getUint32(4, littleEndian);
  let guard = 0;

  while (offset && offset < view.byteLength - 2 && guard < 10000) {
    guard += 1;
    const entryCount = view.getUint16(offset, littleEndian);
    const tags = {};

    for (let index = 0; index < entryCount; index += 1) {
      const entry = offset + 2 + index * 12;
      const tag = view.getUint16(entry, littleEndian);
      const type = view.getUint16(entry + 2, littleEndian);
      const count = view.getUint32(entry + 4, littleEndian);
      const typeSize = TYPE_SIZE[type];
      if (!typeSize) continue;

      const byteLength = count * typeSize;
      const valueOffset = byteLength <= 4 ? entry + 8 : view.getUint32(entry + 8, littleEndian);
      tags[tag] = readTagValue(view, valueOffset, type, count, littleEndian);
    }

    ifds.push(tags);
    offset = view.getUint32(offset + 2 + entryCount * 12, littleEndian);
  }

  return ifds;
}

function readTagValue(view, offset, type, count, littleEndian) {
  if (type === 2) {
    let text = "";
    for (let i = 0; i < count; i += 1) {
      const code = view.getUint8(offset + i);
      if (code) text += String.fromCharCode(code);
    }
    return { text };
  }

  const values = [];
  for (let i = 0; i < count; i += 1) {
    const pos = offset + i * TYPE_SIZE[type];
    if (type === 1) values.push(view.getUint8(pos));
    if (type === 3) values.push(view.getUint16(pos, littleEndian));
    if (type === 4) values.push(view.getUint32(pos, littleEndian));
    if (type === 11) values.push(view.getFloat32(pos, littleEndian));
    if (type === 12) values.push(view.getFloat64(pos, littleEndian));
  }
  return values;
}

function computeRobustScale(view, pages, width, height, littleEndian) {
  const histogram = new Uint32Array(65536);
  const pixelsPerPage = width * height;
  let total = 0;

  for (const page of pages) {
    iteratePageSamples(view, page, pixelsPerPage, littleEndian, (value) => {
      histogram[value] += 1;
      total += 1;
    });
  }

  const lowTarget = Math.floor(total * 0.001);
  const highTarget = Math.floor(total * 0.999);
  let running = 0;
  let low = 0;
  let high = 65535;

  for (let value = 0; value < histogram.length; value += 1) {
    running += histogram[value];
    if (running >= lowTarget) {
      low = value;
      break;
    }
  }

  running = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    running += histogram[value];
    if (running >= highTarget) {
      high = value;
      break;
    }
  }

  if (high <= low) high = low + 1;
  return { low, high, range: high - low };
}

function writePageToRgba(view, page, rgba, width, height, littleEndian, scale) {
  const pixelsPerPage = width * height;
  let pixelIndex = 0;

  iteratePageSamples(view, page, pixelsPerPage, littleEndian, (value) => {
    const gray = Math.max(0, Math.min(255, Math.round(((value - scale.low) / scale.range) * 255)));
    const out = pixelIndex * 4;
    rgba[out] = gray;
    rgba[out + 1] = gray;
    rgba[out + 2] = gray;
    rgba[out + 3] = 255;
    pixelIndex += 1;
  });
}

function iteratePageSamples(view, page, pixelsPerPage, littleEndian, visit) {
  if (page.offset !== undefined) {
    for (let i = 0; i < pixelsPerPage; i += 1) {
      visit(view.getUint16(page.offset + i * 2, littleEndian));
    }
    return;
  }

  let visited = 0;
  for (let strip = 0; strip < page.offsets.length; strip += 1) {
    const offset = page.offsets[strip];
    const count = page.counts[strip];
    const samples = Math.floor(count / 2);
    for (let i = 0; i < samples && visited < pixelsPerPage; i += 1) {
      visit(view.getUint16(offset + i * 2, littleEndian));
      visited += 1;
    }
  }
}

function postSlice(fileName, ifd, index, total) {
  const rgba = new Uint8ClampedArray(self.UTIF.toRGBA8(ifd));
  const suffix = total > 1 ? ` #${String(index + 1).padStart(3, "0")}` : "";
  self.postMessage(
    {
      type: "slice",
      total,
      name: `${fileName}${suffix}`,
      width: ifd.width,
      height: ifd.height,
      rgba: rgba.buffer,
    },
    [rgba.buffer],
  );
}
