# Nuancera

**语言 / Language:** [中文](#中文) · [English](#english)

> 一个**完全离线**的 macOS 配色工具，为高水平期刊（Nature / Science / Cell 风格）图表与学术幻灯片设计。运行全程无需联网、无遥测、无远程字体、无任何 API 调用。Apple Silicon 原生。
>
> A fully **offline** macOS color-palette tool for high-impact journal figures and academic slides. No network, no telemetry, no remote fonts, no API calls. Native on Apple Silicon.

当前版本 / Version: **v0.06**

---

<a name="中文"></a>
## 中文

### 1. 安装与运行

> 想直接用成品？如果作者在本仓库 **Releases** 页发布了 `.dmg`，下载拖进「应用程序」即可，无需以下步骤。否则按下面从源码运行。

**第 1 步 — 安装 Node.js（一次性，需要联网）**
到 [nodejs.org](https://nodejs.org) 下载 macOS **Apple Silicon (arm64)** 的 LTS 安装包并安装。终端验证：

```bash
node -v
```

**第 2 步 — 克隆并安装依赖（一次性，需要联网）**

```bash
git clone https://github.com/Chase-DC/nuancera.git
cd nuancera
npm install
```

`npm install` 会下载 Electron 和 pdf.js；`postinstall` 自动把 pdf.js 拷到 `renderer/vendor/pdfjs/`。**这是最后一次用到网络。**

**第 3 步 — 启动**

```bash
npm start
```

窗口弹出后即可**关掉 Wi-Fi**，所有功能照常。

**打包成可双击的 App**

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

### 6. 开源发布与「可下载成品」

本项目已含 `LICENSE`（MIT）。

**推送源码**（在项目根目录执行；先在 GitHub 新建一个空仓库 `nuancera`，不要勾选自动生成 README/.gitignore/license）：

```bash
git init
git add .
git commit -m "Nuancera v0.06"
git branch -M main
git remote add origin https://github.com/<你的用户名>/nuancera.git
git push -u origin main
```

`.gitignore` 已排除 `node_modules/`、`dist/`、`renderer/vendor/`，别人 clone 后 `npm install && npm start` 即可运行。

**让 Releases 不为空（提供可下载的 App）**：GitHub 的 **Releases / Packages 默认是空的**，需要你手动发布。源码仓库不会自动生成成品。要给用户一个直接下载的 `.dmg`：

1. `npm run dist` 生成 `dist/Nuancera-0.0.6-arm64.dmg`
2. GitHub 仓库页 → **Releases** → **Draft a new release** → 填 tag（如 `v0.0.6`）
3. 把那个 `.dmg` 拖到 **Attach binaries** 区域 → **Publish release**

发布后，Releases 页就会有可下载的成品 App（注意未签名，用户首次需右键打开）。

### 7. 版本号规则

每次调整版本号 **+0.01**（v0.01 → v0.02 …），同时更新 `renderer/js/i18n.js` 里的 `APP_VERSION` 和 `package.json` 的 `version`。

---

<a name="english"></a>
## English

### 1. Install & run
> Prefer a ready-made app? If the author published a `.dmg` under **Releases**, just download it and drag it to Applications — no steps below needed. Otherwise run from source:

1. Install **Node.js LTS (macOS arm64)** once; verify with `node -v`.
2. Clone & install:
   ```bash
   git clone https://github.com/Chase-DC/nuancera.git
   cd nuancera
   npm install
   ```
   (downloads Electron + pdf.js; postinstall bundles pdf.js locally — the last time the internet is used).
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

### 6. Publishing on GitHub + downloadable build
This repo includes an MIT `LICENSE`. Create an empty `nuancera` repo on GitHub (no auto README/.gitignore/license), then from the project root:
```bash
git init && git add . && git commit -m "Nuancera v0.06"
git branch -M main
git remote add origin https://github.com/<your-username>/nuancera.git
git push -u origin main
```
`.gitignore` excludes `node_modules/`, `dist/`, `renderer/vendor/`; a fresh clone just needs `npm install && npm start`.

**Releases / Packages are empty by default** — a source repo doesn't auto-generate builds. To offer a downloadable app: run `npm run dist`, then on GitHub go to **Releases → Draft a new release**, set a tag (e.g. `v0.0.6`), attach `dist/Nuancera-0.0.6-arm64.dmg`, and **Publish**.

### 7. Versioning
Bump **+0.01** each change; keep `APP_VERSION` in `renderer/js/i18n.js` and `version` in `package.json` in sync.

### Project layout
```
nuancera/
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
