# 连续切片三维重构网页 App

这是一个纯前端三维重构预览工具，适合快速查看已经配准后的连续切片、ROI 切片序列或多页 TIFF 堆栈。图像读取和重构都在浏览器本地完成，不会上传数据。

## 启动

在本目录运行：

```bash
python3 -m http.server 8123
```

然后打开：

```text
http://127.0.0.1:8123/
```

## 桌面安装包

本项目已经配置 Electron 桌面壳，支持打包为 macOS Apple Silicon 和 Windows x64 安装包。

安装依赖：

```bash
npm install
```

准备本地离线依赖：

```bash
npm run prepare:vendor
```

生成 macOS M 芯片安装包：

```bash
npm run dist:mac
```

生成 Windows x64 安装包：

```bash
npm run dist:win
```

构建产物会输出到 `release/`。当前已生成：

- `Serial Section 3D Reconstruction-1.0.0-mac-arm64.dmg`
- `Serial Section 3D Reconstruction-1.0.0-arm64-mac.zip`
- `Serial Section 3D Reconstruction-1.0.0-win-x64.exe`
- `Serial Section 3D Reconstruction-1.0.0-win-x64.zip`

注意：当前安装包没有 Apple Developer ID 或 Windows 代码签名证书签名。首次打开 macOS 版本时，可能需要在“系统设置 > 隐私与安全性”中允许打开；Windows 也可能出现 SmartScreen 提示。

## 支持输入

- 连续 PNG/JPG/TIF/TIFF 切片，按文件名自然排序。
- 多页 TIFF，一个文件里的每一页会作为一张 z 轴切片。
- 多个堆叠 TIFF，每个 TIFF 会作为一个独立三维结构导入。
- ImageJ 16-bit 灰度 stack TIFF，例如 `images=95/slices=95` 这类连续像素堆栈。
- 尺寸不一致的切片会自动缩放到第一张切片的尺寸。

## 主要功能

- 切片预览和 z 序列滑动检查。
- 多结构叠加显示，每个导入的 TIFF 都可以单独开关显示。
- 结构重命名，用于把 `CD31-roi.tif` 这类文件改成更清晰的结构名称。
- 每个结构单独设置颜色映射、结构颜色、最小强度阈值和最大强度阈值。
- 清晰点云式三维重构，点云默认使用深度写入，避免侧视角半透明叠加造成的虚化。
- 半透明切片堆叠，适合检查连续 tif 对齐情况。
- 可选三维边框/包围盒，边框颜色和宽度可自定义。
- 主视窗不显示背景网格；保留 Three.js 三维坐标轴用于判断空间方向。
- 阈值、窗位、窗宽、层间距、采样步长、不透明度和点大小调整。
- 单色强度、原始灰度、深度伪彩、热度强度显示。
- 反相信号选项，适合 HE 明场图像中“暗组织、亮背景”的情况。
- PLY 点云导出，可在 MeshLab、CloudCompare、Blender 等软件中继续处理。
- 旋转动画导出：可设置旋转轴、帧数、帧率、旋转圈数和实时预览速度。优先 MP4，浏览器不支持时自动退到 WebM，也可导出 GIF。GIF 编码脚本和 worker 已放在本地，避免 CDN worker 跨域问题。
- 三维逐层浏览：可只显示当前 Z 层，或从第 1 层累积显示到当前层，便于检查堆叠顺序和层间结构变化。

## 建议工作流

1. 先用 VALIS 或已有 Python 脚本完成连续切片配准。
2. 导出对齐后的 ROI 切片序列或多页 TIFF。
3. 在本网页中一次导入一个或多个堆叠 TIFF。
4. 在“结构列表”中选择某个结构，在“当前结构”里重命名、改颜色映射，并调整最小/最大强度阈值。
5. 通过 z 层间距、采样步长、点大小和透明度快速调出合理三维效果。
6. 需要进一步建模时，导出 PLY 点云到专业 3D 软件中做网格化、平滑或定量分析。

## 注意

高分辨率全切片图像会很占内存。建议先导入 ROI 或降采样切片；如果点数过多，可以把“采样步长”调大。
