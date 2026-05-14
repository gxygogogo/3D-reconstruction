const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const vendor = path.join(root, "vendor");
const threeRoot = path.join(root, "node_modules", "three");
const utifRoot = path.join(root, "node_modules", "utif");

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function requireFile(filePath, packageName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${packageName} file: ${filePath}. Run npm install first.`);
  }
}

const files = [
  {
    source: path.join(threeRoot, "build", "three.module.js"),
    target: path.join(vendor, "three.module.js"),
    packageName: "three",
  },
  {
    source: path.join(threeRoot, "examples", "jsm", "controls", "OrbitControls.js"),
    target: path.join(vendor, "jsm", "controls", "OrbitControls.js"),
    packageName: "three",
  },
  {
    source: path.join(utifRoot, "UTIF.js"),
    target: path.join(vendor, "UTIF.js"),
    packageName: "utif",
  },
];

for (const file of files) {
  requireFile(file.source, file.packageName);
  copyFile(file.source, file.target);
}

console.log("Vendor files prepared.");
