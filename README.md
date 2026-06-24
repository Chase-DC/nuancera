# Nuancera

**语言 / Language:** [中文](#中文) · [English](#english)

> **Nuancera** 是一个完全离线的 macOS 配色工具，面向科研图表、期刊论文插图和学术幻灯片。它把出版级配色、色盲安全检查、PDF 配色提取、调色板管理和多格式导出放在同一个本地应用里。
>
> **Nuancera** is a fully offline macOS palette tool for scientific figures, journal graphics, and academic slides. It brings publication-grade palettes, colorblind-safety checks, PDF color extraction, palette management, and multi-format exports into one local app.

Current version / 当前版本: **0.0.6**

---

<a name="中文"></a>
## 中文

### About / 项目简介

Nuancera 专为需要严谨视觉表达的科研作者、研究生、编辑和幻灯片制作者设计。它不依赖云端服务，不上传文件，也不调用远程 API；安装依赖后，颜色计算、PDF 渲染、期刊识别、配色保存与导出都在本机完成。

它适合这些场景：

- 为论文图、GraphPad/Illustrator/R/Python 图表和答辩幻灯片快速建立统一配色。
- 从已发表 PDF 中提取主要颜色，沉淀为自己的期刊配色库。
- 检查调色板在常见色觉缺陷下是否仍可区分。
- 将配色导出为 HEX、JSON、GIMP `.gpl`、Adobe `.ase` 或 PNG 色卡。
- 在中文、英文、法文界面之间切换，保持离线工作流一致。

### 核心特性

- **完全离线**：运行期无网络请求、无遥测、无远程字体、无 API 调用。`index.html` 使用严格 CSP，`main.js` 拦截非本地请求。
- **颜色输入与转换**：HEX / RGB / HSL / CMYK 实时互转，点按任意数值即可复制。
- **配色构建**：组合 2-8 个颜色，拖拽排序、锁定、删除；整套配色给出色盲判定。每个色块可一键收藏到「颜色库」。
- **应用预览**：把配色套到柱状图、折线图、幻灯片标题块，文字自动选取高对比色。
- **预设库**：33 套精选配色，支持按类型、风格、色盲安全筛选。包含 viridis、cividis、mako、rocket、crest、flare、magma，ColorBrewer，全套 Okabe-Ito，以及低饓和编辑风配色。
- **配色建议**：基于一个颜色生成二元互补、三元互补、邻近色、分裂互补、单色系方案，并可查找「包含此颜色的期刊配色」。
- **期刊配色库**：内置出版级推荐配色，并可按期刊保存从 PDF 提取的配色，支持分区、影响因子、简写标签等元数据。
- **PDF 配色提取**：本地 pdf.js 渲染前 N 页，去除白底、黑字和低饱和灰，再在 CIE Lab 空间聚类，得到主色、辅色和点缀色。
- **期刊识别**：导入 PDF 时可离线识别期刊名称、简写、ISSN、影响因子、类别、JCR 分区和 DOI。内置 1008 本期刊数据，识别优先级为 ISSN > 全名 > 简写；无法识别时留空，不臆测。
- **本地颜色库**：不限数量保存个人常用单色和配色。
- **多格式导出**：HEX `.txt`、`.json`、GIMP `.gpl`、Adobe `.ase`、PNG 色卡。
- **多语言**：中文 / English / Français，默认中文。

### 安装与运行

如果仓库 [Releases](https://github.com/Chase-DC/nuancera/releases) 页面已经发布 `.dmg`，直接下载并拖入「应用程序」即可。若没有可下载成品，可从源码运行：

**1. 安装 Node.js（一次性，需要联网）**

到 [nodejs.org](https://nodejs.org) 下载 macOS Apple Silicon (arm64) 的 LTS 安装包并安装。终端验证：

```bash
node -v
```

**2. 克隆并安装依赖（一次性，需要联网）**

```bash
git clone https://github.com/Chase-DC/nuancera.git
cd nuancera
npm install
```

`npm install` 会下载 Electron 和 pdf.js；`postinstall` 会把 pdf.js 拷到 `renderer/vendor/pdfjs/`。安装完成后，应用运行不再需要联网。

**3. 启动开发版**

```bash
npm start
```

窗口弹出后即可关掉 Wi-Fi，核心功能仍应照常工作。

**4. 打包成可双击 App**

```bash
npm run dist
```

完成后在 `dist/` 中打开 `.dmg` 并把 App 拖入「应用程序」，或直接运行 `dist/mac-arm64/Nuancera.app`。未签名 App 首次打开时，右键选择「打开」，再确认「打开」（只需一次）。

### 离线验证

启动 Nuancera 后断开所有网络，确认以下功能都可用：

- 颜色输入与格式转换
- 预设与配色建议
- PDF 配色提取
- 颜色库保存与读取
- HEX / JSON / GPL / ASE / PNG 导出

### PDF 配色提取原理

1. 内置 pdf.js 将 PDF 前 N 页渲染到离屏画布。
2. 读取像素并去噪：去除近白页底、近黑文字、低饱和灰、坐标轴、网格和抗锯齿噪声。
3. 保留的彩色像素按出现频率加权，在 CIE Lab 空间进行 k-means 聚类。
4. 根据面积和分布给出主色、辅色、点缀色角色。
5. 结果以可编辑色块展示，可载入构建区或存入期刊配色库。

已用已知配色的图做过端到端验证：源色可被准确还原，黑白底能被正确剔除。

### 数据存放位置

Nuancera 的用户数据保存在本机：

```text
~/Library/Application Support/Nuancera/palette-library.json
```

这是一个可读的本地 JSON 文件，同时保存「已存配色」和「颜色库」。数据不会上传。

### 发布与下载说明

源码仓库不会自动生成可下载 App。若要向用户提供 `.dmg`：

1. 在项目根目录运行 `npm run dist`。
2. 找到 `dist/Nuancera-0.0.6-arm64.dmg` 或对应版本的 `.dmg` 文件。
3. 打开 GitHub 仓库页面，进入 **Releases**。
4. 点击 **Draft a new release**，填写 tag，例如 `v0.0.6`。
5. 将 `.dmg` 拖到 **Attach binaries** 区域并发布。

### 版本号规则

每次发布时同步更新：

- `package.json` 中的 `version`
- `renderer/js/i18n.js` 中的 `APP_VERSION`
- README 顶部的当前版本

当前项目约定每次小版本递增 `+0.01`。

---

<a name="english"></a>
## English

### About

Nuancera is built for researchers, graduate students, editors, and slide makers who need careful visual language for scientific work. It does not depend on cloud services, upload files, or call remote APIs. After dependencies are installed, color computation, PDF rendering, journal detection, palette storage, and exports all happen locally on your Mac.

Use it to:

- Build consistent palettes for papers, GraphPad/Illustrator/R/Python figures, and defense slides.
- Extract dominant colors from published PDFs and save them into a personal journal-palette library.
- Check whether a palette remains distinguishable under common color-vision deficiencies.
- Export palettes as HEX, JSON, GIMP `.gpl`, Adobe `.ase`, or PNG swatch sheets.
- Work in Chinese, English, or French without leaving an offline workflow.

### Highlights

- **Fully offline**: no runtime network requests, telemetry, remote fonts, or API calls. A strict CSP plus a network blocker prevent non-local requests.
- **Color conversion**: live HEX / RGB / HSL / CMYK conversion; click any value to copy.
- **Palette builder**: combine 2-8 colors, reorder by drag, lock/delete swatches, and get palette-level colorblind-safety feedback. Star any swatch to save it to the Color Library.
- **Applied previews**: preview palettes on bar charts, line charts, and slide title blocks with automatic high-contrast text.
- **Curated presets**: 33 palette sets, filterable by type, mood, and colorblind safety. Includes viridis, cividis, mako, rocket, crest, flare, magma, ColorBrewer, Okabe-Ito, and low-saturation editorial palettes.
- **Suggestion engine**: generate complementary, triadic, analogous, split-complementary, and monochromatic palettes from a base color, or find journal palettes containing a similar color.
- **Journal palettes**: publication-grade defaults plus PDF-imported palettes grouped by journal, with quartile, impact factor, abbreviation, and category metadata.
- **PDF color extraction**: bundled pdf.js renders pages locally, removes background/text/noise pixels, clusters remaining colors in CIE Lab, and labels primary/secondary/accent roles.
- **Offline journal detection**: PDF import can identify journal name, abbreviation, ISSN, impact factor, category, JCR quartile, and DOI. The bundled table covers 1008 journals. Matching priority: ISSN > full name > abbreviation; unknown journals are left blank rather than guessed.
- **Local libraries**: save unlimited colors and palettes on your own machine.
- **Exports**: HEX `.txt`, `.json`, GIMP `.gpl`, Adobe `.ase`, and PNG swatch sheets.
- **Languages**: 中文 / English / Français; Chinese is the default.

### Install & Run

If a `.dmg` is available on the [Releases](https://github.com/Chase-DC/nuancera/releases) page, download it and drag Nuancera into Applications. Otherwise run from source:

**1. Install Node.js once**

Download the macOS Apple Silicon (arm64) LTS installer from [nodejs.org](https://nodejs.org), then verify:

```bash
node -v
```

**2. Clone and install dependencies**

```bash
git clone https://github.com/Chase-DC/nuancera.git
cd nuancera
npm install
```

`npm install` downloads Electron and pdf.js. The `postinstall` script copies pdf.js into `renderer/vendor/pdfjs/`. After installation, app runtime is offline.

**3. Start the development app**

```bash
npm start
```

Once the window opens, you can turn Wi-Fi off and the core workflow should continue working.

**4. Build a double-clickable app**

```bash
npm run dist
```

Open the `.dmg` in `dist/` and drag Nuancera to Applications, or run `dist/mac-arm64/Nuancera.app` directly. For the first launch of an unsigned build, right-click the app, choose Open, then confirm Open.

### Offline Verification

Launch Nuancera, disconnect networking, and confirm these still work:

- color input and conversion
- presets and suggestions
- PDF color extraction
- saving and loading the color library
- HEX / JSON / GPL / ASE / PNG exports

### How PDF Extraction Works

1. Bundled pdf.js renders the first N pages to an offscreen canvas.
2. Pixel cleanup removes near-white page backgrounds, near-black text, low-saturation grays, axes, gridlines, and antialiasing noise.
3. Remaining colored pixels are weighted by frequency and clustered in CIE Lab using k-means.
4. Lightweight heuristics assign primary, secondary, and accent roles.
5. Results appear as editable swatches and can be loaded into the builder or saved to the journal-palette library.

The extraction flow has been validated with known-color figures: source colors are recovered accurately while black/white backgrounds are removed.

### Local Data

Nuancera stores user data locally at:

```text
~/Library/Application Support/Nuancera/palette-library.json
```

This readable JSON file holds saved palettes and the color library. It is never uploaded.

### Releases

The source repository does not automatically produce downloadable apps. To publish a `.dmg`:

1. Run `npm run dist` from the project root.
2. Locate `dist/Nuancera-0.0.6-arm64.dmg` or the matching versioned `.dmg`.
3. Open the GitHub repository page and go to **Releases**.
4. Click **Draft a new release** and create a tag such as `v0.0.6`.
5. Attach the `.dmg` and publish the release.

### Versioning

When releasing, keep these in sync:

- `version` in `package.json`
- `APP_VERSION` in `renderer/js/i18n.js`
- the current version shown at the top of this README

This project currently uses a small-version increment convention of `+0.01`.

### Project Layout

```text
nuancera/
├── package.json
├── main.js
├── preload.js
├── LICENSE
├── README.md
├── build/icon.png
├── scripts/
│   ├── copy-vendor.js
│   └── build-presets.js
└── renderer/
    ├── index.html
    ├── styles.css
    ├── data/
    │   ├── presets.json
    │   └── presets.js
    ├── vendor/pdfjs/
    └── js/
        ├── i18n.js
        ├── color-utils.js
        ├── vision.js
        ├── cluster.js
        ├── exporters.js
        ├── pdf-extract.js
        └── app.js
```

MIT licensed.
