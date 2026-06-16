# photo-editor-llinux

An elegant, standalone Linux desktop photo editor and image annotation utility built with Electron, HTML5, CSS3, and JavaScript. Featuring a premium glassmorphic user interface, it provides comprehensive markup tools and pixel editing operations inside a desktop window.

---

## Features

### 🌟 New Interactive Enhancements
* **Dotted Marquee Selection:** A dedicated rectangular selection tool. Selecting the pointer/select tool initializes a default marquee box styled with an active dotted boundary. You can resize it via 8 handles, drag to move it, or drag across any empty space on the canvas to draw a brand-new selection.
* **Crop to Selection (`Ctrl + K`):** Crop the current canvas instantly to the active selection box bounds. Triggers translation and clipping of all existing vector shapes to align them perfectly to the cropped image coordinate system.
* **90° Image Rotation:** Rotate the canvas and loaded image 90° clockwise at the click of a button. Automatically transforms and rotates all underlying annotations and marquee selections synchronously.
* **Complete Undo/Redo Support:** Both vector actions and raster mutations (such as cropping and rotating) are serialized in the history stack, making every action fully undoable/redoable.

### 🎨 Core Annotations & Customizations
* **Move & Select (`S`):** Select, translate, and resize individual vector shapes.
* **Vector Markup Tools:**
  * **Rectangle (`R`) & Circle (`O`):** Draw shapes with outline colors and translucent or solid fills.
  * **Arrow (`A`) & Line (`L`):** Draw pointing lines or simple straight line breaks.
  * **Pencil (`P`):** Sketch freehand lines.
  * **Text (`T`):** Input inline text with font size and family adjustments. Double-click to edit existing text.
* **Styling Bar:** Customize stroke thickness, border color, and fill opacity.
* **Export:** Offscreen 1:1 scale rendering to export the annotated image as a lossless PNG.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `O` | Open Image File |
| `Ctrl` + `S` | Export Image as PNG (Lossless) |
| `Ctrl` + `K` | Crop Canvas to Selection |
| `Ctrl` + `Z` | Undo last action |
| `Ctrl` + `Y` | Redo last action |
| `Backspace` / `Delete` | Delete selected vector shape |
| `S` | Selection Tool |
| `R` | Rectangle Tool |
| `C` | Crop Tool |
| `O` | Circle Tool |
| `A` | Arrow Tool |
| `L` | Line Tool |
| `P` | Pen Tool |
| `T` | Text Box |
| `Space` + Drag Mouse | Pan canvas workspace |
| `Arrow Keys` | Nudge selected shape (Hold `Shift` for 10px) |

---

## How to Run the Application

`photo-editor-llinux` is packaged as an Electron desktop application. Ensure you have [Node.js](https://nodejs.org/) installed before running.

### 1. Install Dependencies
Navigate to the project directory and install the required Electron binaries:
```bash
npm install
```

### 2. Launch the Desktop App
You can run the application directly using the launcher script:
```bash
bash start-app.sh
```

Alternatively, launch it via npm:
```bash
npm start
```

### 3. Build & Package (Optional)
To package the app into a native Linux executable/installer, run:
```bash
npm run package
```

---

## Project Structure

```text
photo-editor/
├── index.html        # Glassmorphic user interface structure
├── style.css         # Desktop and canvas styling sheet
├── app.js            # Main application state, render loop & canvas math
├── main.js           # Electron main process configuration
├── preload.js        # IPC communication preload script
├── start-app.sh      # Shell script shortcut to launch the app
├── package.json      # Dependencies and execution commands
└── assets/
    ├── app_icon.png  # Desktop launcher app icon
    └── wallpaper.png # Workspace viewport fallback background
```
