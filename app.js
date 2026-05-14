import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const palette = ["#36c6a2", "#f66b6b", "#8aa4ff", "#f0b84f", "#d980ff", "#66d9ef"];

const els = {
  viewer: document.querySelector("#viewer"),
  emptyState: document.querySelector("#emptyState"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  volumeList: document.querySelector("#volumeList"),
  loadState: document.querySelector("#loadState"),
  sliceCount: document.querySelector("#sliceCount"),
  volumeSize: document.querySelector("#volumeSize"),
  pointCount: document.querySelector("#pointCount"),
  sliceCanvas: document.querySelector("#sliceCanvas"),
  sliceSlider: document.querySelector("#sliceSlider"),
  sliceLabel: document.querySelector("#sliceLabel"),
  sampleStep: document.querySelector("#sampleStep"),
  zScale: document.querySelector("#zScale"),
  zSmooth: document.querySelector("#zSmooth"),
  opacity: document.querySelector("#opacity"),
  pointSize: document.querySelector("#pointSize"),
  showBounds: document.querySelector("#showBounds"),
  borderWidth: document.querySelector("#borderWidth"),
  borderColor: document.querySelector("#borderColor"),
  rotationAxis: document.querySelector("#rotationAxis"),
  animationFps: document.querySelector("#animationFps"),
  videoFrames: document.querySelector("#videoFrames"),
  gifFrames: document.querySelector("#gifFrames"),
  animationTurns: document.querySelector("#animationTurns"),
  liveRotationSpeed: document.querySelector("#liveRotationSpeed"),
  layerBrowseEnabled: document.querySelector("#layerBrowseEnabled"),
  layerBrowseMode: document.querySelector("#layerBrowseMode"),
  layerIndex: document.querySelector("#layerIndex"),
  layerBrowseState: document.querySelector("#layerBrowseState"),
  volumeName: document.querySelector("#volumeName"),
  colorMode: document.querySelector("#colorMode"),
  volumeColor: document.querySelector("#volumeColor"),
  minThreshold: document.querySelector("#minThreshold"),
  maxThreshold: document.querySelector("#maxThreshold"),
  heBackground: document.querySelector("#heBackground"),
  heDarkBackground: document.querySelector("#heDarkBackground"),
  opacitySliceSpec: document.querySelector("#opacitySliceSpec"),
  sliceOpacity: document.querySelector("#sliceOpacity"),
  volumeVisible: document.querySelector("#volumeVisible"),
  invertSignal: document.querySelector("#invertSignal"),
  activeVolumeState: document.querySelector("#activeVolumeState"),
  backgroundMode: document.querySelector("#backgroundMode"),
  renderAxis: document.querySelector("#renderAxis"),
  applyRenderAxisBtn: document.querySelector("#applyRenderAxisBtn"),
  autoRotate: document.querySelector("#autoRotate"),
  rebuildBtn: document.querySelector("#rebuildBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  fitBtn: document.querySelector("#fitBtn"),
  exportPlyBtn: document.querySelector("#exportPlyBtn"),
  exportVideoBtn: document.querySelector("#exportVideoBtn"),
  exportGifBtn: document.querySelector("#exportGifBtn"),
  renderStatus: document.querySelector("#renderStatus"),
  modeButtons: document.querySelectorAll("[data-render-mode]"),
};

const state = {
  volumes: [],
  activeVolumeId: null,
  renderMode: "points",
  object: null,
  pointCloudData: [],
  rebuildTimer: null,
  nextVolumeId: 1,
  isRecording: false,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#070a10");

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(0, -420, 260);

const axesScene = new THREE.Scene();
const axesCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
axesCamera.position.set(0, 0, 180);
axesCamera.lookAt(0, 0, 0);
const axesHelper = new THREE.AxesHelper(70);
axesScene.add(axesHelper);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
els.viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.addEventListener("start", () => {
  if (!state.isRecording) {
    els.autoRotate.checked = false;
    els.renderAxis.value = "free";
  }
});

function activeVolume() {
  return state.volumes.find((volume) => volume.id === state.activeVolumeId) || null;
}

function getGlobalSettings() {
  return {
    sampleStep: Number(els.sampleStep.value),
    zScale: Number(els.zScale.value),
    zSmooth: Number(els.zSmooth.value),
    opacity: Number(els.opacity.value),
    pointSize: Number(els.pointSize.value),
    showBounds: els.showBounds.checked,
    borderWidth: Number(els.borderWidth.value),
    borderColor: els.borderColor.value,
    layerBrowseEnabled: els.layerBrowseEnabled.checked,
    layerBrowseMode: els.layerBrowseMode.value,
    layerIndex: Number(els.layerIndex.value) - 1,
  };
}

function getAnimationSettings(kind = "video") {
  return {
    axis: els.rotationAxis.value,
    fps: Number(els.animationFps.value),
    frames: Number(kind === "gif" ? els.gifFrames.value : els.videoFrames.value),
    turns: Number(els.animationTurns.value),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function naturalSort(files) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function updateOutputs() {
  for (const input of document.querySelectorAll(".control input")) {
    const out = document.querySelector(`#${input.id}Val`);
    if (out) out.value = input.value;
  }
}

function setStatus(text) {
  els.renderStatus.textContent = text;
}

function volumeCenter() {
  return new THREE.Vector3(0, 0, 0);
}

function lockOrbitCenter() {
  controls.target.copy(volumeCenter());
}

function resizeRenderer() {
  const rect = els.viewer.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

function renderScene() {
  lockOrbitCenter();
  const rect = els.viewer.getBoundingClientRect();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, rect.width, rect.height);
  renderer.render(scene, camera);

  const axesSize = Math.min(118, rect.width * 0.18, rect.height * 0.18);
  const margin = 18;
  axesHelper.quaternion.copy(camera.quaternion).invert();
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(margin, margin, axesSize, axesSize);
  renderer.setViewport(margin, margin, axesSize, axesSize);
  renderer.render(axesScene, axesCamera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, rect.width, rect.height);
}

function getIntensity(r, g, b, invert) {
  const value = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  return invert ? 255 - value : value;
}

function normalizeIntensity(intensity, minThreshold, maxThreshold) {
  const range = Math.max(1, maxThreshold - minThreshold);
  return clamp((intensity - minThreshold) / range, 0, 1);
}

function depthColor(t, target) {
  target.setHSL(0.62 - t * 0.48, 0.88, 0.58);
}

function signalColor(t, target) {
  target.setRGB(clamp(1.7 * t, 0, 1), clamp(1.4 * t - 0.15, 0, 1), clamp(0.55 - t * 0.42, 0, 1));
}

function mappedColor(volume, r, g, b, intensity, depthT, target) {
  const t = normalizeIntensity(intensity, volume.minThreshold, volume.maxThreshold);
  if (volume.colorMode === "he") {
    target.setRGB(r / 255, g / 255, b / 255);
  } else if (volume.colorMode === "source") {
    target.setScalar(t);
  } else if (volume.colorMode === "depth") {
    depthColor(depthT, target);
    target.multiplyScalar(0.35 + t * 0.75);
  } else if (volume.colorMode === "signal") {
    signalColor(t, target);
  } else {
    target.set(volume.color);
    target.multiplyScalar(0.25 + t * 0.85);
  }
  return target;
}

function isHeBackground(r, g, b, volume) {
  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const nearWhite = brightness >= volume.heBackground && chroma < 34;
  const nearBlack = brightness <= volume.heDarkBackground && chroma < 40;
  return nearWhite || nearBlack;
}

function voxelIsVisible(volume, r, g, b, intensity) {
  if (volume.colorMode === "he") {
    return !isHeBackground(r, g, b, volume);
  }
  return intensity >= volume.minThreshold && intensity <= volume.maxThreshold;
}

function sampleVoxel(volume, x, y, z, radius) {
  if (!radius) {
    const slice = volume.slices[z];
    const i = (y * slice.width + x) * 4;
    return {
      r: slice.rgba[i],
      g: slice.rgba[i + 1],
      b: slice.rgba[i + 2],
    };
  }

  const from = Math.max(0, z - radius);
  const to = Math.min(volume.slices.length - 1, z + radius);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let layer = from; layer <= to; layer += 1) {
    const slice = volume.slices[layer];
    const i = (y * slice.width + x) * 4;
    r += slice.rgba[i];
    g += slice.rgba[i + 1];
    b += slice.rgba[i + 2];
    count += 1;
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

function createBoundingBox(volume, settings) {
  const geometry = new THREE.BoxGeometry(volume.width, volume.height, Math.max((volume.slices.length - 1) * settings.zScale, 1));
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({
    color: settings.borderColor,
    transparent: true,
    opacity: 0.95,
    linewidth: settings.borderWidth,
    depthTest: true,
    depthWrite: false,
  });
  const box = new THREE.LineSegments(edges, material);
  box.name = `${volume.name} 边框`;
  return box;
}

function getRotationValue(object, axis) {
  return object.rotation[axis];
}

function setRotationValue(object, axis, value) {
  object.rotation[axis] = value;
}

function layerIsVisible(z, settings) {
  if (!settings.layerBrowseEnabled) return true;
  if (settings.layerBrowseMode === "accumulate") return z <= settings.layerIndex;
  return z === settings.layerIndex;
}

function layerOpacity(z, settings) {
  return settings.opacity;
}

function sliceOpacityForVolume(volume, z, settings) {
  return volume.opacitySlices.has(z) ? settings.opacity * volume.sliceOpacity : settings.opacity;
}

function parseSliceSpec(spec, maxSlices) {
  const slices = new Set();
  for (const rawPart of spec.split(/[,\s;，；]+/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*[-~:]\s*(\d+)$/);
    if (range) {
      const start = clamp(Number(range[1]), 1, maxSlices);
      const end = clamp(Number(range[2]), 1, maxSlices);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      for (let layer = from; layer <= to; layer += 1) {
        slices.add(layer - 1);
      }
      continue;
    }
    const single = Number(part);
    if (Number.isFinite(single) && single >= 1 && single <= maxSlices) {
      slices.add(single - 1);
    }
  }
  return slices;
}

function drawSlice(index = Number(els.sliceSlider.value)) {
  const volume = activeVolume();
  const slice = volume?.slices[index];
  const ctx = els.sliceCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.sliceCanvas.width, els.sliceCanvas.height);
  if (!volume || !slice) {
    els.sliceLabel.textContent = "未加载";
    return;
  }

  const tmp = document.createElement("canvas");
  tmp.width = slice.width;
  tmp.height = slice.height;
  tmp.getContext("2d").putImageData(new ImageData(slice.rgba, slice.width, slice.height), 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, els.sliceCanvas.width, els.sliceCanvas.height);
  els.sliceLabel.textContent = `${volume.name} · ${index + 1} / ${volume.slices.length}`;
}

function updateMeta() {
  const totalSlices = state.volumes.reduce((sum, volume) => sum + volume.slices.length, 0);
  const totalPoints = state.pointCloudData.length;
  const volume = activeVolume();
  const maxLayers = Math.max(...state.volumes.map((item) => item.slices.length), 1);

  els.sliceCount.textContent = String(totalSlices);
  els.volumeSize.textContent = volume ? `${volume.width}×${volume.height}` : "-";
  els.pointCount.textContent = totalPoints ? totalPoints.toLocaleString("zh-CN") : "0";
  els.sliceSlider.disabled = !volume;
  els.sliceSlider.max = String(Math.max((volume?.slices.length || 1) - 1, 0));
  els.sliceSlider.value = String(Math.min(Number(els.sliceSlider.value), Number(els.sliceSlider.max)));
  els.layerIndex.max = String(maxLayers);
  els.layerIndex.value = String(clamp(Number(els.layerIndex.value), 1, maxLayers));
  els.layerBrowseMode.disabled = !els.layerBrowseEnabled.checked || !state.volumes.length;
  els.layerIndex.disabled = !els.layerBrowseEnabled.checked || !state.volumes.length;
  els.layerBrowseState.textContent = els.layerBrowseEnabled.checked
    ? `${els.layerIndex.value} / ${maxLayers}`
    : "关闭";
  drawSlice();
  renderVolumeList();
  syncActiveControls();
  updateOutputs();
}

function syncActiveControls() {
  const volume = activeVolume();
  const disabled = !volume;
  els.activeVolumeState.textContent = volume ? `${volume.slices.length} 层` : "未选择";

  for (const input of [
    els.volumeName,
    els.colorMode,
    els.volumeColor,
    els.minThreshold,
    els.maxThreshold,
    els.heBackground,
    els.heDarkBackground,
    els.opacitySliceSpec,
    els.sliceOpacity,
    els.volumeVisible,
    els.invertSignal,
  ]) {
    input.disabled = disabled;
  }

  if (!volume) {
    els.volumeName.value = "";
    return;
  }

  els.volumeName.value = volume.name;
  els.colorMode.value = volume.colorMode;
  els.volumeColor.value = volume.color;
  els.minThreshold.value = String(volume.minThreshold);
  els.maxThreshold.value = String(volume.maxThreshold);
  els.heBackground.value = String(volume.heBackground);
  els.heDarkBackground.value = String(volume.heDarkBackground);
  els.opacitySliceSpec.value = volume.opacitySliceSpec;
  els.sliceOpacity.value = String(volume.sliceOpacity);
  els.volumeVisible.checked = volume.visible;
  els.invertSignal.checked = volume.invertSignal;
  updateOutputs();
}

function renderVolumeList() {
  els.volumeList.innerHTML = state.volumes
    .map((volume) => {
      const active = volume.id === state.activeVolumeId ? " active" : "";
      const hidden = volume.visible ? "" : " muted";
      return `
        <button class="volume-item${active}${hidden}" data-volume-id="${volume.id}">
          <span class="swatch" style="background:${volume.color}"></span>
          <span class="volume-text">
            <strong>${escapeHtml(volume.name)}</strong>
            <small>${volume.slices.length} 层 · ${volume.width}×${volume.height} · ${volume.colorMode === "he" ? `HE 亮>${volume.heBackground} 暗<${volume.heDarkBackground}` : `${volume.minThreshold}-${volume.maxThreshold}`}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function resizeImageDataToBase(volume, rgba, width, height) {
  if (width === volume.width && height === volume.height) {
    return { rgba, width, height };
  }

  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  source.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);

  const target = document.createElement("canvas");
  target.width = volume.width;
  target.height = volume.height;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, volume.width, volume.height);
  return {
    rgba: ctx.getImageData(0, 0, volume.width, volume.height).data,
    width: volume.width,
    height: volume.height,
  };
}

async function readRasterImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return [{ name: file.name, width: bitmap.width, height: bitmap.height, rgba: imageData.data }];
}

async function readTiff(file) {
  if (!window.Worker) {
    throw new Error("当前浏览器不支持后台解码 Worker，无法安全读取大型 TIFF。");
  }

  const worker = new Worker(new URL("./tiff-worker.js", import.meta.url), { type: "classic" });
  const buffer = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const slices = [];

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "meta") {
        els.loadState.textContent = `解析 ${file.name}：共 ${message.total} 页`;
        setStatus(`正在后台解码 ${file.name}`);
      }
      if (message.type === "slice") {
        slices.push({
          name: message.name,
          width: message.width,
          height: message.height,
          rgba: new Uint8ClampedArray(message.rgba),
        });
        els.loadState.textContent = `解析 ${file.name}：${slices.length} / ${message.total}`;
      }
      if (message.type === "done") {
        worker.terminate();
        resolve(slices);
      }
      if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(error.message || "TIFF 后台解码失败。"));
    };

    worker.postMessage({ fileName: file.name, buffer }, [buffer]);
  });
}

function makeVolume(file, decodedSlices) {
  const color = palette[(state.nextVolumeId - 1) % palette.length];
  const volume = {
    id: `vol-${state.nextVolumeId++}`,
    name: file.name.replace(/\.(tif|tiff|png|jpg|jpeg)$/i, ""),
    sourceName: file.name,
    color,
    colorMode: "solid",
    minThreshold: 45,
    maxThreshold: 255,
    heBackground: 230,
    heDarkBackground: 45,
    opacitySliceSpec: "",
    opacitySlices: new Set(),
    sliceOpacity: 0.35,
    visible: true,
    invertSignal: false,
    width: decodedSlices[0].width,
    height: decodedSlices[0].height,
    slices: [],
  };

  volume.slices = decodedSlices.map((slice) => {
    const resized = resizeImageDataToBase(volume, slice.rgba, slice.width, slice.height);
    return { ...resized, name: slice.name };
  });
  return volume;
}

async function loadFiles(fileList) {
  const files = naturalSort(fileList);
  if (!files.length) return;

  els.loadState.textContent = "读取中...";
  setStatus("正在解析图像");

  for (const file of files) {
    const isTiff = /\.tiff?$/i.test(file.name) || /tiff/i.test(file.type);
    const decoded = isTiff ? await readTiff(file) : await readRasterImage(file);
    if (!decoded.length) continue;

    const volume = makeVolume(file, decoded);
    state.volumes.push(volume);
    state.activeVolumeId = volume.id;
    els.loadState.textContent = `已导入 ${state.volumes.length} 个结构`;
    updateMeta();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  rebuildVolume({ fitView: true, preserveObjectRotation: false });
}

function createPointCloud(settings) {
  const group = new THREE.Group();
  const points = [];
  let totalRendered = 0;

  for (const volume of state.volumes) {
    if (!volume.visible) continue;

    const positions = [];
    const colors = [];
    const tmpColor = new THREE.Color();
    const xOffset = volume.width / 2;
    const yOffset = volume.height / 2;
    const zOffset = ((volume.slices.length - 1) * settings.zScale) / 2;

    for (let z = 0; z < volume.slices.length; z += 1) {
      if (!layerIsVisible(z, settings)) continue;
      const slice = volume.slices[z];
      const depthT = volume.slices.length > 1 ? z / (volume.slices.length - 1) : 0;

      for (let y = 0; y < slice.height; y += settings.sampleStep) {
        for (let x = 0; x < slice.width; x += settings.sampleStep) {
          const { r, g, b } = sampleVoxel(volume, x, y, z, settings.zSmooth);
          const intensity = getIntensity(r, g, b, volume.invertSignal);
          if (!voxelIsVisible(volume, r, g, b, intensity)) continue;

          const px = x - xOffset;
          const py = yOffset - y;
          const pz = z * settings.zScale - zOffset;
          positions.push(px, py, pz);
          mappedColor(volume, r, g, b, intensity, depthT, tmpColor);
          const opacityScale = sliceOpacityForVolume(volume, z, settings) / Math.max(settings.opacity, 0.001);
          colors.push(tmpColor.r * opacityScale, tmpColor.g * opacityScale, tmpColor.b * opacityScale);
          points.push({
            x: px,
            y: py,
            z: pz,
            r: Math.round(tmpColor.r * opacityScale * 255),
            g: Math.round(tmpColor.g * opacityScale * 255),
            b: Math.round(tmpColor.b * opacityScale * 255),
            volume: volume.name,
          });
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size: settings.pointSize,
      vertexColors: true,
      transparent: false,
      opacity: 1,
      depthTest: true,
      depthWrite: true,
      sizeAttenuation: false,
    });

    const cloud = new THREE.Points(geometry, material);
    cloud.name = volume.name;
    group.add(cloud);
    if (settings.showBounds) {
      group.add(createBoundingBox(volume, settings));
    }
    totalRendered += positions.length / 3;
  }

  state.pointCloudData = points;
  els.pointCount.textContent = totalRendered.toLocaleString("zh-CN");
  return group;
}

function createSliceStack(settings) {
  const group = new THREE.Group();
  const tmpColor = new THREE.Color();
  state.pointCloudData = [];

  for (const volume of state.volumes) {
    if (!volume.visible) continue;
    const zOffset = ((volume.slices.length - 1) * settings.zScale) / 2;

    volume.slices.forEach((slice, z) => {
      if (!layerIsVisible(z, settings)) return;
      const canvas = document.createElement("canvas");
      canvas.width = slice.width;
      canvas.height = slice.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const adjusted = new Uint8ClampedArray(slice.rgba.length);
      const depthT = volume.slices.length > 1 ? z / (volume.slices.length - 1) : 0;

      for (let i = 0; i < slice.rgba.length; i += 4) {
        const pixel = i / 4;
        const x = pixel % slice.width;
        const y = Math.floor(pixel / slice.width);
        const { r, g, b } = sampleVoxel(volume, x, y, z, settings.zSmooth);
        const intensity = getIntensity(r, g, b, volume.invertSignal);
        const inRange = voxelIsVisible(volume, r, g, b, intensity);
        mappedColor(volume, r, g, b, intensity, depthT, tmpColor);
        adjusted[i] = Math.round(tmpColor.r * 255);
        adjusted[i + 1] = Math.round(tmpColor.g * 255);
        adjusted[i + 2] = Math.round(tmpColor.b * 255);
        adjusted[i + 3] = inRange ? Math.round(sliceOpacityForVolume(volume, z, settings) * 255) : 0;
      }

      ctx.putImageData(new ImageData(adjusted, slice.width, slice.height), 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(slice.width, slice.height), material);
      plane.position.set(0, 0, z * settings.zScale - zOffset);
      plane.userData.dispose = () => texture.dispose();
      group.add(plane);
    });

    if (settings.showBounds) {
      group.add(createBoundingBox(volume, settings));
    }
  }

  return group;
}

function disposeObject(object) {
  if (!object) return;
  object.traverse((child) => {
    child.userData.dispose?.();
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((mat) => mat.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
  scene.remove(object);
}

function rebuildVolume({ fitView = false, preserveObjectRotation = true } = {}) {
  const previousRotation = state.object?.rotation.clone();
  disposeObject(state.object);
  state.object = null;
  state.pointCloudData = [];
  if (!state.volumes.length) {
    els.emptyState.style.display = "grid";
    updateMeta();
    return;
  }

  const settings = getGlobalSettings();
  state.object = state.renderMode === "points" ? createPointCloud(settings) : createSliceStack(settings);
  if (preserveObjectRotation && previousRotation) {
    state.object.rotation.copy(previousRotation);
  }
  scene.add(state.object);
  els.emptyState.style.display = "none";
  setStatus(`已重建 ${state.volumes.filter((volume) => volume.visible).length} 个结构`);
  updateMeta();
  if (fitView) {
    fitCamera();
  }
}

function scheduleRebuild() {
  updateOutputs();
  updateLayerBrowseState();
  window.clearTimeout(state.rebuildTimer);
  state.rebuildTimer = window.setTimeout(() => rebuildVolume(), 150);
}

function updateLayerBrowseState() {
  const maxLayers = Math.max(...state.volumes.map((item) => item.slices.length), 1);
  els.layerIndex.max = String(maxLayers);
  els.layerIndex.value = String(clamp(Number(els.layerIndex.value), 1, maxLayers));
  if (els.layerBrowseEnabled.checked && activeVolume()) {
    els.sliceSlider.value = String(Math.min(Number(els.layerIndex.value) - 1, Number(els.sliceSlider.max)));
    drawSlice();
  }
  els.layerBrowseMode.disabled = !els.layerBrowseEnabled.checked || !state.volumes.length;
  els.layerIndex.disabled = !els.layerBrowseEnabled.checked || !state.volumes.length;
  els.layerBrowseState.textContent = els.layerBrowseEnabled.checked
    ? `${els.layerIndex.value} / ${maxLayers}`
    : "关闭";
}

function getVisibleBounds() {
  const visible = state.volumes.filter((volume) => volume.visible);
  const largest = visible[0] || state.volumes[0];
  if (!largest) return null;

  const maxDepth = Math.max(...visible.map((volume) => volume.slices.length * Number(els.zScale.value)), 80);
  const maxWidth = Math.max(...visible.map((volume) => volume.width), largest.width);
  const maxHeight = Math.max(...visible.map((volume) => volume.height), largest.height);
  return { maxDepth, maxWidth, maxHeight };
}

function getCameraDistance(bounds) {
  const maxDim = Math.max(bounds.maxWidth, bounds.maxHeight, bounds.maxDepth);
  return Math.max(maxDim * 1.35, 180);
}

function fitCamera() {
  const bounds = getVisibleBounds();
  if (!bounds) return;

  els.renderAxis.value = "free";
  const maxDim = Math.max(bounds.maxWidth, bounds.maxHeight, bounds.maxDepth);
  camera.position.set(0, -maxDim * 1.25, maxDim * 0.72);
  camera.up.set(0, 0, 1);
  lockOrbitCenter();
  camera.lookAt(controls.target);
  controls.update();
}

function applyRenderAxisView() {
  const axis = els.renderAxis.value;
  if (axis === "free") return;

  const bounds = getVisibleBounds();
  if (!bounds) {
    setStatus("请先导入图像，再应用轴向视角");
    return;
  }

  const distance = getCameraDistance(bounds);
  const views = {
    "z-positive": { position: [0, 0, distance], up: [0, 1, 0], label: "沿 +Z 轴" },
    "z-negative": { position: [0, 0, -distance], up: [0, 1, 0], label: "沿 -Z 轴" },
    "x-positive": { position: [distance, 0, 0], up: [0, 0, 1], label: "沿 +X 轴" },
    "x-negative": { position: [-distance, 0, 0], up: [0, 0, 1], label: "沿 -X 轴" },
    "y-positive": { position: [0, distance, 0], up: [0, 0, 1], label: "沿 +Y 轴" },
    "y-negative": { position: [0, -distance, 0], up: [0, 0, 1], label: "沿 -Y 轴" },
  };
  const view = views[axis];
  camera.position.set(...view.position);
  camera.up.set(...view.up);
  lockOrbitCenter();
  camera.lookAt(controls.target);
  controls.update();
  els.autoRotate.checked = false;
  setStatus(`已应用${view.label}渲染视角`);
}

function clearVolume() {
  disposeObject(state.object);
  state.object = null;
  state.volumes = [];
  state.activeVolumeId = null;
  state.pointCloudData = [];
  els.fileInput.value = "";
  els.emptyState.style.display = "grid";
  els.loadState.textContent = "等待导入";
  setStatus("未渲染");
  updateMeta();
}

function exportPly() {
  if (!state.pointCloudData.length) {
    setStatus("请先使用点云模式重建，再导出 PLY");
    return;
  }

  const header = [
    "ply",
    "format ascii 1.0",
    `element vertex ${state.pointCloudData.length}`,
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    "end_header",
  ].join("\n");
  const rows = state.pointCloudData.map((p) => `${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)} ${p.r} ${p.g} ${p.b}`);
  const blob = new Blob([header, "\n", rows.join("\n")], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "multi-structure-reconstruction.ply";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("PLY 点云已导出");
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bestVideoMimeType() {
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function exportVideo() {
  if (!state.object || state.isRecording) return;
  if (!renderer.domElement.captureStream || !window.MediaRecorder) {
    setStatus("当前浏览器不支持视频录制，请尝试导出 GIF。");
    return;
  }

  state.isRecording = true;
  const previousAutoRotate = els.autoRotate.checked;
  els.autoRotate.checked = false;
  els.exportVideoBtn.disabled = true;
  els.exportGifBtn.disabled = true;
  setStatus("正在录制旋转动画...");

  const mimeType = bestVideoMimeType();
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const animation = getAnimationSettings("video");
  const stream = renderer.domElement.captureStream(animation.fps);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  const originalRotation = getRotationValue(state.object, animation.axis);
  recorder.start();
  for (let frame = 0; frame < animation.frames; frame += 1) {
    setRotationValue(state.object, animation.axis, originalRotation + (Math.PI * 2 * animation.turns * frame) / animation.frames);
    controls.update();
    renderScene();
    await waitFrame();
  }
  recorder.stop();
  await done;
  stream.getTracks().forEach((track) => track.stop());
  setRotationValue(state.object, animation.axis, originalRotation);
  els.autoRotate.checked = previousAutoRotate;
  els.exportVideoBtn.disabled = false;
  els.exportGifBtn.disabled = false;
  state.isRecording = false;

  saveBlob(new Blob(chunks, { type: mimeType || "video/webm" }), `reconstruction-animation.${extension}`);
  setStatus(`动画已导出为 ${extension.toUpperCase()}`);
}

async function loadGifEncoder() {
  if (window.GIF) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./gif.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("GIF 编码库加载失败，请检查网络后重试。"));
    document.head.appendChild(script);
  });
}

async function exportGif() {
  if (!state.object || state.isRecording) return;

  state.isRecording = true;
  const previousAutoRotate = els.autoRotate.checked;
  els.autoRotate.checked = false;
  els.exportVideoBtn.disabled = true;
  els.exportGifBtn.disabled = true;
  setStatus("正在准备 GIF 编码器...");

  try {
    await loadGifEncoder();
    const gif = new window.GIF({
      workers: 2,
      quality: 12,
      width: renderer.domElement.width,
      height: renderer.domElement.height,
      workerScript: "./gif.worker.js",
    });

    const animation = getAnimationSettings("gif");
    const originalRotation = getRotationValue(state.object, animation.axis);
    for (let frame = 0; frame < animation.frames; frame += 1) {
      setRotationValue(state.object, animation.axis, originalRotation + (Math.PI * 2 * animation.turns * frame) / animation.frames);
      controls.update();
      renderScene();
      gif.addFrame(renderer.domElement, { copy: true, delay: Math.round(1000 / animation.fps) });
      if (frame % 8 === 0) {
        setStatus(`正在采集 GIF 帧：${frame + 1} / ${animation.frames}`);
        await waitFrame();
      }
    }

    const blob = await new Promise((resolve) => {
      gif.on("finished", resolve);
      gif.render();
    });
    setRotationValue(state.object, animation.axis, originalRotation);
    saveBlob(blob, "reconstruction-animation.gif");
    setStatus("GIF 动画已导出");
  } catch (error) {
    setStatus(error.message);
    console.error(error);
  } finally {
    els.autoRotate.checked = previousAutoRotate;
    els.exportVideoBtn.disabled = false;
    els.exportGifBtn.disabled = false;
    state.isRecording = false;
  }
}

function applyActiveVolumeChange() {
  const volume = activeVolume();
  if (!volume) return;

  volume.name = els.volumeName.value.trim() || volume.sourceName;
  volume.colorMode = els.colorMode.value;
  volume.color = els.volumeColor.value;
  volume.visible = els.volumeVisible.checked;
  volume.invertSignal = els.invertSignal.checked;
  volume.minThreshold = Number(els.minThreshold.value);
  volume.maxThreshold = Number(els.maxThreshold.value);
  volume.heBackground = Number(els.heBackground.value);
  volume.heDarkBackground = Number(els.heDarkBackground.value);
  volume.opacitySliceSpec = els.opacitySliceSpec.value.trim();
  volume.opacitySlices = parseSliceSpec(volume.opacitySliceSpec, volume.slices.length);
  volume.sliceOpacity = Number(els.sliceOpacity.value);
  if (volume.minThreshold > volume.maxThreshold) {
    const changedMax = document.activeElement === els.maxThreshold;
    if (changedMax) {
      volume.minThreshold = volume.maxThreshold;
      els.minThreshold.value = String(volume.minThreshold);
    } else {
      volume.maxThreshold = volume.minThreshold;
      els.maxThreshold.value = String(volume.maxThreshold);
    }
  }
  updateOutputs();
  renderVolumeList();
  scheduleRebuild();
}

function animate() {
  requestAnimationFrame(animate);
  if (els.autoRotate.checked && state.object && !state.isRecording) {
    state.object.rotation[els.rotationAxis.value] += 0.002 * Number(els.liveRotationSpeed.value);
  }
  controls.update();
  renderScene();
}

els.fileInput.addEventListener("change", (event) => loadFiles(event.target.files).catch((error) => {
  els.loadState.textContent = "读取失败";
  setStatus(error.message);
  console.error(error);
}));

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
}

els.dropZone.addEventListener("drop", (event) => {
  loadFiles(event.dataTransfer.files).catch((error) => {
    els.loadState.textContent = "读取失败";
    setStatus(error.message);
    console.error(error);
  });
});

els.volumeList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-volume-id]");
  if (!item) return;
  state.activeVolumeId = item.dataset.volumeId;
  els.sliceSlider.value = "0";
  updateMeta();
});

els.sliceSlider.addEventListener("input", () => drawSlice());
els.rebuildBtn.addEventListener("click", rebuildVolume);
els.clearBtn.addEventListener("click", clearVolume);
els.fitBtn.addEventListener("click", fitCamera);
els.applyRenderAxisBtn.addEventListener("click", applyRenderAxisView);
els.renderAxis.addEventListener("change", applyRenderAxisView);
els.exportPlyBtn.addEventListener("click", exportPly);
els.exportVideoBtn.addEventListener("click", exportVideo);
els.exportGifBtn.addEventListener("click", exportGif);

els.backgroundMode.addEventListener("change", () => {
  const dark = els.backgroundMode.value === "dark";
  scene.background = new THREE.Color(dark ? "#070a10" : "#f4f7fb");
});

for (const input of [
  els.sampleStep,
  els.zScale,
  els.zSmooth,
  els.opacity,
  els.pointSize,
  els.showBounds,
  els.borderWidth,
  els.borderColor,
  els.layerBrowseEnabled,
  els.layerBrowseMode,
  els.layerIndex,
]) {
  input.addEventListener("input", scheduleRebuild);
  input.addEventListener("change", scheduleRebuild);
}

for (const input of [
  els.volumeName,
  els.colorMode,
  els.volumeColor,
  els.minThreshold,
  els.maxThreshold,
  els.heBackground,
  els.heDarkBackground,
  els.opacitySliceSpec,
  els.sliceOpacity,
  els.volumeVisible,
  els.invertSignal,
]) {
  input.addEventListener("input", applyActiveVolumeChange);
  input.addEventListener("change", applyActiveVolumeChange);
}

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.modeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.renderMode = button.dataset.renderMode;
    rebuildVolume();
  });
});

const viewerResizeObserver = new ResizeObserver(resizeRenderer);
viewerResizeObserver.observe(els.viewer);

window.addEventListener("resize", resizeRenderer);
updateOutputs();
resizeRenderer();
clearVolume();
animate();
