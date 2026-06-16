#!/usr/bin/env bash

# Exit on any error
set -e

# Resolve absolute path of directory containing this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Target location for desktop entries
TARGET_DIR="$HOME/.local/share/applications"
mkdir -p "$TARGET_DIR"

echo "Installing photo-editor-llinux launcher..."

# Create a customized desktop entry with the actual absolute paths
cat <<EOF > "$TARGET_DIR/photo-editor-llinux.desktop"
[Desktop Entry]
Name=photo-editor-llinux
Comment=Simple Linux Image Viewer & Photo Editor
Exec=$DIR/start-app.sh %F
Icon=$DIR/assets/app_icon.png
Terminal=false
Type=Application
Categories=Graphics;2DGraphics;RasterGraphics;Viewer;
MimeType=image/png;image/jpeg;image/gif;image/bmp;image/webp;image/svg+xml;image/tiff;
Keywords=image;viewer;photo;editor;paint;markup;shotwell;gimp;
StartupNotify=true
EOF

chmod +x "$TARGET_DIR/photo-editor-llinux.desktop"

# Register the mime-types and update desktop database
echo "Updating desktop database..."
update-desktop-database "$TARGET_DIR"

echo "Registering default associations..."
# Associate photo-editor-llinux with standard image formats
for mime in image/png image/jpeg image/gif image/bmp image/webp image/svg+xml image/tiff; do
    xdg-mime default photo-editor-llinux.desktop "$mime"
done

echo "Successfully installed! photo-editor-llinux is now your default image viewer/editor."
