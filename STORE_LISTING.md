# Microsoft Store Listing Notes

Use this file when completing Microsoft Partner Center submission fields.

## Privacy Policy URL

```text
https://github.com/Chase-DC/nuancera/blob/main/PRIVACY.md
```

If Partner Center rejects the GitHub page URL, use the raw file URL:

```text
https://raw.githubusercontent.com/Chase-DC/nuancera/main/PRIVACY.md
```

## Restricted Capability: runFullTrust

Partner Center question:

```text
Why do you need the runFullTrust capability, and how will it be used in your product?
```

Recommended answer:

```text
Nuancera is an Electron/Win32 desktop application packaged as MSIX for Microsoft Store distribution. The runFullTrust capability is required to launch the packaged desktop application process using Windows.FullTrustApplication.

Nuancera uses this capability to run its local desktop user interface and process user-selected local files for palette generation, PDF color extraction, color conversion, local palette management, and export features. The app is local-first: it does not require an account, does not upload user documents or palettes, and does not include analytics, advertising, or telemetry. It does not request administrator privileges and does not use runFullTrust to install drivers, background services, system extensions, or modify protected system settings.

Network access is limited to optional update checks against GitHub Releases and opening the release page if the user chooses to update.
```

## Store Listing: 中文(中国)

### Product name

```text
Nuancera
```

### Short description

```text
面向科研图表、论文插图和学术幻灯片的本地优先桌面配色工具。
```

### Description

```text
Nuancera 是一个本地优先的桌面配色工具，面向科研图表、期刊论文插图和学术幻灯片。它把出版级配色、色盲安全检查、PDF 配色提取、调色板管理和多格式导出放在同一个应用里。

主要功能：
- 构建 2-16 色调色板，支持拖拽排序、锁定、删除和保存。
- 支持 HEX、RGB、HSL、CMYK 颜色输入与转换。
- 内置科研和出版场景常用配色，包括 viridis、cividis、ColorBrewer 和 Okabe-Ito。
- 检查调色板在常见色觉缺陷下是否仍可区分。
- 从用户选择的 PDF 中本地提取主要颜色，并保存为期刊配色。
- 支持导出 HEX、JSON、GIMP GPL、Adobe ASE 和 PNG 色卡。
- 支持中文、英文和法语界面。

Nuancera 不需要账户，不上传用户文件，也不包含广告、分析或遥测。除可选的新版本检查外，核心工作流都在本机完成。
```

### Search terms

```text
palette, color, scientific figure, academic, PDF, colorblind, 配色, 调色板, 科研绘图, 论文插图
```

## Store Listing: English (United States)

### Product name

```text
Nuancera
```

### Short description

```text
A local-first desktop palette tool for scientific figures, journal graphics, and academic slides.
```

### Description

```text
Nuancera is a local-first desktop palette tool for scientific figures, journal graphics, and academic slides. It brings publication-grade palettes, colorblind-safety checks, PDF color extraction, palette management, and multi-format exports into one desktop app.

Key features:
- Build 2-16 color palettes with drag ordering, locking, deleting, and saving.
- Enter and convert colors in HEX, RGB, HSL, and CMYK.
- Use curated scientific and publication-ready palettes, including viridis, cividis, ColorBrewer, and Okabe-Ito.
- Check whether palettes remain distinguishable under common color-vision deficiencies.
- Extract dominant colors locally from user-selected PDFs and save them as journal palettes.
- Export palettes as HEX, JSON, GIMP GPL, Adobe ASE, and PNG swatch sheets.
- Work in Chinese, English, or French.

Nuancera does not require an account, does not upload user files, and does not include advertising, analytics, or telemetry. Apart from optional update checks, the core workflow runs locally on your device.
```

### Search terms

```text
palette, color, scientific figure, academic, PDF, colorblind, journal graphics, research, slides, export
```

## Store Listing: Français (France)

### Product name

```text
Nuancera
```

### Short description

```text
Un outil local de palettes pour figures scientifiques, graphiques de revues et diapositives académiques.
```

### Description

```text
Nuancera est un outil de palettes local pour les figures scientifiques, les graphiques de revues et les diapositives académiques. Il réunit des palettes prêtes pour la publication, des vérifications d'accessibilité des couleurs, l'extraction de couleurs depuis des PDF, la gestion de palettes et l'export dans plusieurs formats.

Fonctionnalités principales :
- Créer des palettes de 2 à 16 couleurs avec tri par glisser-déposer, verrouillage, suppression et sauvegarde.
- Saisir et convertir les couleurs en HEX, RGB, HSL et CMYK.
- Utiliser des palettes adaptées aux usages scientifiques et éditoriaux, notamment viridis, cividis, ColorBrewer et Okabe-Ito.
- Vérifier si les palettes restent distinguables pour les principaux types de déficience de vision des couleurs.
- Extraire localement les couleurs dominantes de PDF choisis par l'utilisateur et les enregistrer comme palettes de revue.
- Exporter les palettes en HEX, JSON, GIMP GPL, Adobe ASE et fiches PNG.
- Travailler en chinois, anglais ou français.

Nuancera ne nécessite pas de compte, ne téléverse pas les fichiers de l'utilisateur et n'inclut ni publicité, ni analyse, ni télémétrie. À l'exception des vérifications optionnelles de mise à jour, le flux de travail principal s'exécute localement sur votre appareil.
```

### Search terms

```text
palette, couleur, figure scientifique, PDF, accessibilite, daltonisme, recherche, publication, diapositives, export
```

## Submission Checklist

- Complete each Store listing language shown as unfinished in Partner Center.
- Upload at least one screenshot for each listing language, or reuse the same screenshots if Partner Center allows it.
- Fill privacy policy URL for each required language/submission page.
- Fill the `runFullTrust` restricted capability explanation in Submission options.
- Do not remove `runFullTrust` from the MSIX manifest for the Electron desktop package.
