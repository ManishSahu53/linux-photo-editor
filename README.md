# Linux Preview - Interactive Photo Editor & Markup Simulator

A premium, web-based image markup editor designed to mimic the native Linux **Preview** app. Built using vanilla HTML5, CSS3, and JavaScript, it features a glassmorphic user interface layered on a simulated Linux desktop environment with interactive window controls, menus, shortcut sheets, and a bottom Dock.

## Features

- **Linux Window Controls:**
  - Double-click the title bar to maximize or restore the window.
  - Drag the title bar to move the window.
  - Traffic light buttons to close (hide), minimize (to Dock), and zoom (maximize).
- **Core Editor Markup Tools:**
  - **Selection Tool (`S`):** Click, select, drag to move, and resize vector shapes using 8 bounding-box handles.
  - **Rectangle Tool (`R`):** Click and drag to draw rectangular frames with optional solid or translucent fill colors.
  - **Circle Tool (`C`):** Draw circular/elliptical zones.
  - **Arrow Tool (`A`):** Draw pointer arrows pointing towards the mouse release point.
  - **Line Tool (`L`):** Draw linear dividers/strokes.
  - **Pen Tool (`P`):** Freehand sketch drawings.
  - **Text Tool (`T`):** Click to insert inline text, write in-place inside an overlay editor. Double-click text in selection mode to edit content.
- **Styling Customizations:**
  - **Border/Line Color:** Select from Linux System Palette colors or specify custom colors.
  - **Fill Color:** Solid, semi-transparent (opacity slider), or transparent fill color.
  - **Stroke Thickness:** Slider scale adjustment (1px to 30px).
  - **Font controls:** Customize size (12pt to 96pt) and family (Outfit sans-serif, Georgia, Courier monospace, Playfair display).
- **Quality & Vector Scale Support:**
  - **Crisp High-Res Render Loop:** Canvas display coordinates adapt to the zoom factor, while the vector math uses **raw image coordinate spaces**.
  - **Lossless PNG Export:** When saving/exporting, annotations are merged at the original resolution of the uploaded image.
  - **Drag & Drop:** Upload local images by dragging and dropping them anywhere inside the workspace window.
  - **Blank canvas generation:** Start drawing on a clean 1000x700 pixel white canvas if no image is available.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `O` | Open Image File |
| `Ctrl` + `S` | Export Image as PNG (Lossless) |
| `Ctrl` + `Z` | Undo last change |
| `Ctrl` + `Y` | Redo last change |
| `Backspace` / `Delete` | Delete selected vector shape |
| `S` | Selection Tool |
| `R` | Rectangle Tool |
| `C` | Circle Tool |
| `A` | Arrow Tool |
| `L` | Line Tool |
| `P` | Pen Tool |
| `T` | Text Tool |
| `Space` + Drag Mouse | Pan canvas workspace |
| `Arrow Keys` | Nudge selected shape (Hold `Shift` for 10px) |

---

## Getting Started

Since the editor is built using vanilla web standard code, it doesn't require any compilers or complex setup.

### Option 1: Serve locally (Recommended)
To run the editor, you can start a simple server inside this folder and open `http://localhost:8088` in your browser.

```bash
# Start a simple HTTP server (Python 3)
python3 -m http.server 8088
```

### Option 2: Open directly
Alternatively, you can open `index.html` directly in any web browser:
`file:///path/to/photo-editor/index.html`

---

## Project Structure

```
photo-editor/
├── index.html        # App layout, menus, Dock and dialogs
├── style.css         # Linux Sonoma glassmorphic stylesheet
├── app.js            # Vector drawing & window state engine
├── README.md         # Documentation
└── assets/
    ├── app_icon.png  # Premium photo-editor app icon
    └── wallpaper.png # Linux Sonoma default colorful wallpaper
```
