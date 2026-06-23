# Nuancera

**语言 / Language:** [中文](#中文) · [English](#english)

> 一个**完全离线**的 macOS 配色工具，为高水平期刊（Nature / Science / Cell 风格）图表与学术幻灯片设计。运行全程无需联网、无遥测、无远程字体、无任何 API 调用。Apple Silicon 原生。
>
> A fully **offline** macOS color-palette tool for high-impact journal figures and academic slides. No network, no telemetry, no remote fonts, no API calls. Native on Apple Silicon.

当前版本 / Version: **v0.06**

---

<a name="中文"></a>
## 中文

### 1. 从零运行（首次设置）

**第 1 步 — 安装 Node.js（一次性，需要联网）**
到 Node.js 官网下载 macOS **Apple Silicon (arm64)** 的 LTS 安装包并安装。终端验证：

```bash
node -v
```

**第 2 步 — 安装依赖（一次性，需要联网）**

```bash
cd "/Users/chasedc/Deepsee-v4/PaletteStudio"
npm install
```

会下载 Electron 和 pdf.js 到项目里；`postinstall` 自动把 pdf.js 拷到 `renderer/vendor/pdfjs/`。**这是最后一次用到网络。**

**第 3 步 — 启动**

```bash
npm start
```

窗口弹出后即可**关掉 Wi-Fi**，所有功能照常。

**装进「应用程序」（可双击的图标）**

```bash
npm run dist
```

完成后在 `dist/` 里：打开 `.dmg` 把 App 拖入「应用程序」，或直接用 `dist/mac-arm64/Nuancera.app`。首次打开未签名 App：右键 →「打开」→「打开」（只需一次）。

### 2. 验证离线（验收测试）

启动后断开所有网络，确认颜色输入/转换、预设、配色建议、PDF 提取、保存、导出全部可用。两层保障：`index.html` 的严格 CSP + `main.js` 的网络拦截器（取消一切非本地请求）。

### 3. 功能

- **颜色输入与转换**：HEX / RGB / HSL / CMYK 实时互转，点按任意数值即可复制。
- **配色构建**：组合 2–8 个颜色，拖拽排序、锁定、删除；整套配色给出色盲判定。**每个色块右上角有星标（悬停显示），点亮即自动收藏到「颜色库」。**
- **应用预览**：把配色套到柱状图、折线图、幻灯片标题块（文字自动取高对比色）。
- **预设库**：33 套精选配色，可按类型 / 风格 / 色盲安全筛选。含 viridis、cividis、mako、rocket、crest、flare、magma，ColorBrewer 全系，色盲安全的 Okabe–Ito，以及自制的低饱和编辑风配色。科学色谱取值直接采样自 matplotlib/seaborn。
- **配色建议**：输入一个基准色（**与构建区共享同一个颜色**，切换标签保持一致），用下拉选择方案 —— **二元互补色、三元互补色、邻近色、分裂互补、单色系**，以及**「含有此颜色的期刊配色」**（从期刊级配色中挑出包含相近颜色的组合）。每条都标注色盲安全与文字对比度，可一键载入。
- **期刊配色库（新模块）**：默认推荐顶级期刊常见的出版级配色；并按期刊归类保存你从 PDF 导入的配色（含分区 / 影响因子 / 简写标签）。
- **颜色库（不限数量）**：你个人的单色收藏，随时放入配色。
- **从 PDF 提取**：见第 4 节。导入时会**自动识别期刊名称、简写、影响因子、类别、JCR 分区、DOI**，并可存入「期刊配色库」。期刊库内置 **1008 本期刊**（名称/简写/ISSN/类别来自 2026 JCR 顶刊榜单，IF 来自 IF‑2025 列表；分区仅对知名旗舰刊填了 Q1，其余留空可编辑），数据来自你提供的 `IF-2025.xlsx` 与 `2026JCR Top600.xlsx`，全部离线，存于 `renderer/data/journals.js`。识别按 ISSN > 全名 > 简写 优先匹配，识别不到则留空不臆测。
- **导出**：HEX 列表 `.txt`、`.json`、GIMP `.gpl`、Adobe `.ase`（真正的二进制格式）、PNG 色卡。
- **多语言**：右上角可切换**中文 / English / Français**，界面全文一致切换；默认中文。

### 4. PDF 配色提取原理

1. 本地内置的 pdf.js 把前 N 页渲染到离屏画布（无网络）。
2. 读取像素并**去噪**：去掉近白页底、近黑文字、低饱和灰（坐标轴/网格/抗锯齿）。保留的彩色像素按出现频率（≈面积）加权。
3. 在 CIE Lab 空间做 **k-means 聚类**（k-means++ 初始化 + 确定性随机，结果可复现），按面积排序。
4. 轻量启发式给出**主色 / 辅色 / 点缀色**角色。
5. 结果以可编辑色块展示，可载入构建区或存入配色库。

> 已用已知配色的图做过端到端验证：源色以 ΔE≈0 被还原，黑白底被正确剔除。

### 5. 数据存放位置

```
~/Library/Application Support/Nuancera/palette-library.json
```

一个可读的本地 JSON（同时存「已存配色」和「颜色库」）。在「已存配色」里点「在访达中显示文件」可定位。绝不上传。

### 6. 在 GitHub 上以 MIT 协议开源发布

本项目已含 `LICENSE`（MIT）。发布步骤：

1. 在 GitHub 网页新建一个空仓库，名为 `nuancera`（不要勾选自动生成 README / .gitignore / license）。
2. 在项目目录执行：

```bash
cd "/Users/chasedc/Deepsee-v4/PaletteStudio"
git init
git add .
git commit -m "Nuancera v0.06"
git branch -M main
git remote add origin https://github.com/<你的用户名>/nuancera.git
git push -u origin main
```

`.gitignore` 已排除 `node_modules/`、`dist/`、`renderer/vendor/`，别人 clone 后 `npm install && npm start` 即可运行。

### 7. 版本号规则

每次调整版本号 **+0.01**（v0.01 → v0.02 …），同时更新 `renderer/js/i18n.js` 里的 `APP_VERSION` 和 `package.json` 的 `version`。

---

<a name="english"></a>
## English

### 1. Run from scratch
1. Install **Node.js LTS (macOS arm64)** once; verify with `node -v`.
2. `cd "/Users/chasedc/Deepsee-v4/PaletteStudio" && npm install` (downloads Electron + pdf.js; postinstall bundles pdf.js locally — the last time the internet is used).
3. `npm start`. Then you can turn Wi-Fi off entirely.
4. Optional double-click app: `npm run dist` → open the `.dmg` in `dist/` and drag **Nuancera** to Applications. First launch of the unsigned app: right-click → Open → Open (once).

### 2. Verify offline
Launch, disconnect all networking, confirm input/convert, presets, suggestions, PDF extraction, saving and exports all work. Enforced by a strict CSP plus a network blocker in `main.js`.

### 3. Features
- HEX/RGB/HSL/**CMYK** live conversion; click any value to copy.
- Build a 2–8 color palette; drag-reorder, lock, delete; palette-wide colorblind verdict. **A hover-revealed star on each swatch saves that color to the Color Library.**
- Applied previews (bar chart, line plot, slide title with auto-contrast text).
- 33 curated presets (viridis/cividis/mako/rocket/crest/flare/magma, ColorBrewer, Okabe–Ito, editorial sets), filterable by type/mood/colorblind. Scientific colormap values sampled from matplotlib/seaborn.
- **Suggestions engine**: from a base color (**shared with Build** — the same color across tabs), a dropdown offers complementary (binary), triadic (ternary), analogous, split-complementary, monochromatic, and **journal palettes containing your color** (journal-grade palettes that include a color close to your base). Each flagged for colorblind safety and text contrast.
- **Journal Palettes module**: default recommendations of publication-grade palettes, plus your imported palettes grouped by journal (with quartile / impact factor / abbreviation).
- **Color Library** — unlimited personal stash of individual colors.
- PDF color extraction (local pdf.js render → de-noise → Lab k-means → roles), with **offline auto-detection of journal name, abbreviation, impact factor, category, JCR quartile and DOI** and save into the journal library. The bundled table holds **1008 journals** (name/abbrev/ISSN/category from the 2026 JCR top list, IF from the IF‑2025 list; quartile filled only for well-known flagships, otherwise blank/editable). Matching priority: ISSN → full name → abbreviation; unknown journals are left blank rather than guessed.
- Exports: `.txt`, `.json`, `.gpl`, binary `.ase`, PNG sheet.
- **Languages**: switch 中文 / English / Français in the top-right; Chinese is the default.

### 4. How PDF extraction works
Bundled pdf.js renders pages locally → noise pixels (white background, black ink, low-saturation grays) are dropped → remaining colors are k-means clustered in CIE Lab, weighted by area → primary/secondary/accent roles. Validated end-to-end (source colors recovered at ΔE ≈ 0).

### 5. Where data lives
`~/Library/Application Support/Nuancera/palette-library.json` — a readable local JSON holding both saved palettes and the color library. Never uploaded.

### 6. Open-sourcing on GitHub (MIT)
This repo includes an MIT `LICENSE`. Create an empty `nuancera` repo on GitHub, then:
```bash
cd "/Users/chasedc/Deepsee-v4/PaletteStudio"
git init && git add . && git commit -m "Nuancera v0.06"
git branch -M main
git remote add origin https://github.com/<your-username>/nuancera.git
git push -u origin main
```
`.gitignore` excludes `node_modules/`, `dist/`, `renderer/vendor/`; a fresh clone just needs `npm install && npm start`.

### 7. Versioning
Bump **+0.01** each change; keep `APP_VERSION` in `renderer/js/i18n.js` and `version` in `package.json` in sync.

### Project layout
```
PaletteStudio/
├── package.json · main.js · preload.js · LICENSE · README.md
├── build/icon.png                 app icon
├── scripts/  copy-vendor.js · build-presets.js
└── renderer/
    ├── index.html · styles.css
    ├── data/  presets.json · presets.js
    ├── vendor/pdfjs/              bundled pdf.js (created on install)
    └── js/  i18n.js · color-utils.js · vision.js · cluster.js · exporters.js · pdf-extract.js · app.js
```

MIT licensed.
