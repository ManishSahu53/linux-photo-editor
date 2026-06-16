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

## Installation & Desktop Integration

You can install `photo-editor-llinux` as your default system image viewer and editor (similar to Shotwell or GNOME Image Viewer). This registers the application with your desktop environment and links it as the default utility to open images from your file manager.

### 1. Install Dependencies
Navigate to the project directory and install the dependencies:
```bash
npm install
```

### 2. Run the Desktop Integration Script
To register desktop links and set file type associations, run:
```bash
./install.sh
```
This script configures a desktop launcher at `~/.local/share/applications/photo-editor-llinux.desktop` and sets it as the default viewer for common image formats (PNG, JPEG, WebP, GIF, SVG, BMP, TIFF).

### 3. Launching
After running the installation script, you can:
* Launch `photo-editor-llinux` from your desktop application menu.
* Double-click any image file in your file manager to open and edit it.
* Run standard terminal commands to view files directly, e.g.:
  ```bash
  photo-editor-llinux path/to/image.jpg
  ```

Alternatively, to run the application in development without installing desktop shortcuts:
```bash
bash start-app.sh [path/to/image.jpg]
# or
npm start -- [path/to/image.jpg]
```

### 4. Build & Package (Optional)
To package the app into a native, standalone Linux executable/installer:
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
