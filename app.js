/* ==========================================================================
   Linux Photo Editor - Application Logic
   ========================================================================== */

// Application State
let image = null;             // Loaded Image (HTMLImageElement or HTMLCanvasElement)
let annotations = [];         // Array of annotation objects
let selectedId = null;         // ID of the selected annotation
let activeTool = 'select';     // Current tool: select, rect, circle, arrow, line, pen, eraser, crop, text
let lastTool = 'select';

// Interaction State
let interactState = 'idle';    // idle, drawing, moving, resizing, panning, erasing, moving-crop, resizing-crop
let startX = 0;                // Mouse down X (image space)
let startY = 0;                // Mouse down Y (image space)
let currentX = 0;              // Current Mouse X (image space)
let currentY = 0;              // Current Mouse Y (image space)
let activeHandleIndex = -1;    // Index of the active resize handle (0-7)
let startShapeState = null;    // Deep copy of shape when starting move/resize
let spacePressed = false;      // Track Spacebar for panning
let cropBox = null;            // Cropping box boundary {x, y, w, h}
let selectionBox = null;       // Selection box boundary {x, y, w, h}

// Zoom & Panning
let zoom = 1.0;
let panX = 0;
let panY = 0;
let dragStartX = 0;            // Panning drag start screen X
let dragStartY = 0;            // Panning drag start screen Y

// Undo / Redo Stacks
let undoStack = [];
let redoStack = [];

// Styles Settings (Markup Settings)
let strokeColor = '#FF3B30';   // Default Linux Red
let fillColor = 'transparent';  // Transparent
let strokeWidth = 3;
let fontSize = 24;
let fontFamily = 'Outfit, sans-serif';

// DOM Elements
let canvas, ctx, workspace, canvasContainer, textEditorInput;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupMenuDropdowns();
    setupToolbar();
    setupCanvasEvents();
    setupKeyboardShortcuts();
});

function initDOMElements() {
    canvas = document.getElementById('photo-canvas');
    ctx = canvas.getContext('2d');
    workspace = document.getElementById('workspace');
    canvasContainer = document.getElementById('canvas-container');
    textEditorInput = document.getElementById('text-editor-input');
}

// ==========================================================================
// dropdown menu logic
// ==========================================================================
function setupMenuDropdowns() {
    // Close dropdowns on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-trigger')) {
            document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('show'));
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        }
    });

    const triggers = document.querySelectorAll('.dropdown-trigger');
    triggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = trigger.getAttribute('data-dropdown');
            const targetDropdown = document.getElementById(targetId);

            // Close other dropdowns
            document.querySelectorAll('.menu-dropdown').forEach(d => {
                if (d.id !== targetId) d.classList.remove('show');
            });
            document.querySelectorAll('.menu-item').forEach(m => {
                if (m !== trigger) m.classList.remove('active');
            });

            // Toggle target
            targetDropdown.classList.toggle('show');
            trigger.classList.toggle('active');

            // Position dropdown below trigger
            const rect = trigger.getBoundingClientRect();
            targetDropdown.style.left = `${rect.left}px`;
            targetDropdown.style.top = `${rect.bottom}px`;
        });
    });

    // File Dropdown Menu Actions
    document.getElementById('menu-open-trigger').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('menu-sample-trigger').addEventListener('click', loadSampleImage);
    document.getElementById('menu-blank-trigger').addEventListener('click', () => loadBlankCanvas(1000, 700));
    document.getElementById('menu-save-trigger').addEventListener('click', exportImage);
    document.getElementById('menu-export-trigger').addEventListener('click', exportImage);

    // Edit Dropdown Actions
    document.getElementById('menu-undo-trigger').addEventListener('click', undo);
    document.getElementById('menu-redo-trigger').addEventListener('click', redo);
    document.getElementById('menu-delete-trigger').addEventListener('click', deleteSelected);
    document.getElementById('menu-clear-trigger').addEventListener('click', clearAll);

    // Tools Dropdown Actions
    document.querySelectorAll('.tool-select-item').forEach(item => {
        item.addEventListener('click', () => {
            const tool = item.getAttribute('data-tool');
            setTool(tool);
        });
    });

    // Help Dropdowns
    document.getElementById('menu-help-trigger').addEventListener('click', () => {
        document.getElementById('help-popup').style.display = 'flex';
    });
    document.getElementById('menu-shortcuts-trigger').addEventListener('click', () => {
        document.getElementById('shortcuts-popup').style.display = 'flex';
    });
}

// ==========================================================================
// Editor Markup Toolbar (Tools selection, Color picker, Styles)
// ==========================================================================
function setupToolbar() {
    // Toolbar toggle
    const toggleBtn = document.getElementById('btn-toggle-markup');
    const markupBar = document.getElementById('markup-toolbar');

    toggleBtn.addEventListener('click', () => {
        toggleBtn.classList.toggle('active');
        markupBar.classList.toggle('hidden');
        setTimeout(() => {
            resetZoomAndPan();
            drawAll();
        }, 150);
    });

    // Tool click selection
    const toolBtns = document.querySelectorAll('#markup-toolbar .tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            setTool(tool);
        });
    });

    // Style dropdown triggers (Stroke, Fill, Thickness, Font)
    setupStyleTrigger('stroke-color-trigger', 'stroke-color-menu');
    setupStyleTrigger('fill-color-trigger', 'fill-color-menu');
    setupStyleTrigger('thickness-trigger', 'thickness-menu');
    setupStyleTrigger('font-trigger', 'font-menu');

    // Stroke presets click
    const strokePresets = document.querySelectorAll('#stroke-color-menu .color-preset');
    strokePresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.getAttribute('data-color');
            setStrokeColor(color);
            document.getElementById('stroke-color-menu').classList.remove('show');
        });
    });
    // Custom Stroke Input
    const strokeCustom = document.getElementById('stroke-color-input');
    strokeCustom.addEventListener('input', (e) => {
        setStrokeColor(e.target.value);
    });

    // Fill presets click
    const fillPresets = document.querySelectorAll('#fill-color-menu .color-preset');
    fillPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.getAttribute('data-color');
            setFillColor(color);
            document.getElementById('fill-color-menu').classList.remove('show');
        });
    });
    // Custom Fill Input & Opacity
    const fillCustom = document.getElementById('fill-color-input');
    const fillOpacity = document.getElementById('fill-opacity-input');
    const updateCustomFill = () => {
        const hex = fillCustom.value;
        const opacity = parseFloat(fillOpacity.value);
        // Convert hex to RGBA
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        setFillColor(`rgba(${r}, ${g}, ${b}, ${opacity})`);
    };
    fillCustom.addEventListener('input', updateCustomFill);
    fillOpacity.addEventListener('input', updateCustomFill);

    // Thickness menu options
    const thicknessOptions = document.querySelectorAll('#thickness-menu .dropdown-option');
    thicknessOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            thicknessOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const th = parseInt(opt.getAttribute('data-thickness'));
            setThickness(th);
            document.getElementById('thickness-menu').classList.remove('show');
        });
    });
    // Thickness slider
    const thicknessSlider = document.getElementById('thickness-slider');
    thicknessSlider.addEventListener('input', (e) => {
        setThickness(parseInt(e.target.value));
    });

    // Font format selectors
    const fontSizeSelect = document.getElementById('font-size-select');
    const fontFamilySelect = document.getElementById('font-family-select');

    fontSizeSelect.addEventListener('change', (e) => {
        fontSize = parseInt(e.target.value);
        updateSelectedTextProperties();
    });
    fontFamilySelect.addEventListener('change', (e) => {
        fontFamily = e.target.value;
        updateSelectedTextProperties();
    });

    // Action buttons inside markup toolbar
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-delete').addEventListener('click', deleteSelected);

    // Crop actions buttons
    document.getElementById('btn-crop-apply').addEventListener('click', applyCrop);
    document.getElementById('btn-crop-cancel').addEventListener('click', () => {
        setTool('select');
    });
    document.getElementById('btn-rotate-90').addEventListener('click', rotateImage90);

    // Initial color previews
    updateColorPreviews();
}

function setupStyleTrigger(triggerId, menuId) {
    const trigger = document.getElementById(triggerId);
    const menu = document.getElementById(menuId);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close others
        document.querySelectorAll('.style-dropdown').forEach(m => {
            if (m.id !== menuId) m.classList.remove('show');
        });

        menu.classList.toggle('show');

        if (menu.classList.contains('show')) {
            const rect = trigger.getBoundingClientRect();
            menu.style.left = `${rect.left}px`;
            menu.style.top = `${rect.bottom + 4}px`;
        }
    });

    // Close on body click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.style-group')) {
            menu.classList.remove('show');
        }
    });
}

function updateColorPreviews() {
    document.getElementById('stroke-color-preview').style.backgroundColor = strokeColor;
    const fillPreview = document.getElementById('fill-color-preview');
    if (fillColor === 'transparent') {
        fillPreview.style.backgroundColor = 'transparent';
        fillPreview.style.backgroundImage = 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';
        fillPreview.style.backgroundSize = '8px 8px';
        fillPreview.style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
    } else {
        fillPreview.style.backgroundImage = 'none';
        fillPreview.style.backgroundColor = fillColor;
    }
}

function setStrokeColor(color) {
    strokeColor = color;
    document.getElementById('stroke-color-input').value = color.startsWith('#') ? color : '#ff3b30';
    updateColorPreviews();

    // Apply style to selected shape
    if (selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && ann.strokeColor !== undefined) {
            pushUndo();
            ann.strokeColor = color;
            drawAll();
        }
    }
}

function setFillColor(color) {
    fillColor = color;
    updateColorPreviews();

    // Apply style to selected shape
    if (selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && ann.fillColor !== undefined) {
            pushUndo();
            ann.fillColor = color;
            drawAll();
        }
    }
}

function setThickness(th) {
    strokeWidth = th;
    document.getElementById('thickness-slider').value = th;
    document.getElementById('thickness-val').textContent = `${th}px`;

    // Apply style to selected shape
    if (selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && ann.strokeWidth !== undefined) {
            pushUndo();
            ann.strokeWidth = th;
            drawAll();
        }
    }
}

function updateSelectedTextProperties() {
    if (selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && ann.type === 'text') {
            pushUndo();
            ann.fontSize = fontSize;
            ann.fontFamily = fontFamily;
            drawAll();
        }
    }
}

function setTool(tool) {
    if (tool === 'crop' && !image) {
        showToast('Please open an image first', true);
        return;
    }

    lastTool = activeTool;
    activeTool = tool;

    // Update menu checkmarks (simulated)
    document.querySelectorAll('.tool-select-item').forEach(item => {
        if (item.getAttribute('data-tool') === tool) {
            item.style.fontWeight = 'bold';
        } else {
            item.style.fontWeight = 'normal';
        }
    });

    // Update active toolbar button state
    document.querySelectorAll('#markup-toolbar .tool-btn').forEach(btn => {
        if (btn.getAttribute('data-tool') === tool) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Clean up text typing state if tool changes
    if (interactState === 'typing') {
        commitText();
    }

    // Handle Crop mode visibility
    const cropActionsBar = document.getElementById('crop-actions-bar');
    if (tool === 'crop') {
        cropBox = {
            x: image.width * 0.1,
            y: image.height * 0.1,
            w: image.width * 0.8,
            h: image.height * 0.8
        };
        if (cropActionsBar) cropActionsBar.classList.remove('hidden');
    } else {
        cropBox = null;
        if (cropActionsBar) cropActionsBar.classList.add('hidden');
    }

    // Set cursor styles
    if (tool === 'select') {
        workspace.style.cursor = 'default';
        document.getElementById('footer-tool').textContent = 'Select Tool';
        if (image && !selectionBox) {
            selectionBox = {
                x: image.width * 0.1,
                y: image.height * 0.1,
                w: image.width * 0.8,
                h: image.height * 0.8
            };
        }
    } else if (tool === 'eraser') {
        workspace.style.cursor = 'cell';
        document.getElementById('footer-tool').textContent = 'Eraser Tool';
    } else if (tool === 'crop') {
        workspace.style.cursor = 'default';
        document.getElementById('footer-tool').textContent = 'Crop Tool';
    } else if (tool === 'pen') {
        workspace.style.cursor = 'crosshair';
        document.getElementById('footer-tool').textContent = 'Pen Tool';
    } else if (tool === 'text') {
        workspace.style.cursor = 'text';
        document.getElementById('footer-tool').textContent = 'Text Tool';
    } else {
        workspace.style.cursor = 'crosshair';
        document.getElementById('footer-tool').textContent = `Draw ${tool.charAt(0).toUpperCase() + tool.slice(1)}`;
    }

    // Clear selection if switching away from select tool
    if (tool !== 'select' && selectedId !== null) {
        selectedId = null;
    }
    drawAll();
}

// ==========================================================================
// Canvas Events & Interaction Logic
// ==========================================================================
function setupCanvasEvents() {
    // Zoom In / Out Buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => { zoomAtCenter(1.25); });
    document.getElementById('btn-zoom-out').addEventListener('click', () => { zoomAtCenter(0.8); });
    document.getElementById('btn-zoom-reset').addEventListener('click', resetZoomAndPan);

    // Empty view buttons
    document.getElementById('empty-btn-open').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('empty-btn-sample').addEventListener('click', loadSampleImage);
    document.getElementById('empty-btn-blank').addEventListener('click', () => loadBlankCanvas(1000, 700));

    // File Input trigger
    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Workspace Drag & Drop Image
    const dropOverlay = document.getElementById('drop-overlay');
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('active');
    });
    workspace.addEventListener('dragleave', () => {
        dropOverlay.classList.remove('active');
    });
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Panning & Drawing Canvas events
    workspace.addEventListener('mousedown', handleMouseDown);
    workspace.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Zoom with scroll wheel
    workspace.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Inline Text Input blur / escape
    textEditorInput.addEventListener('blur', commitText);
    textEditorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            textEditorInput.blur();
        } else if (e.key === 'Escape') {
            textEditorInput.value = ''; // Discard changes
            textEditorInput.blur();
        }
    });

    // Double click to edit text annotations
    workspace.addEventListener('dblclick', handleDoubleClick);
}

// Convert screen mouse position to display canvas space
function getCanvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale display coordinates to canvas coordinate space
    const canvasX = (x / rect.width) * canvas.width;
    const canvasY = (y / rect.height) * canvas.height;

    return { x: canvasX, y: canvasY };
}

// Get Image space coordinates (raw pixel values)
function toImageSpace(canvasX, canvasY) {
    const x = (canvasX - panX) / zoom;
    const y = (canvasY - panY) / zoom;
    return { x, y };
}

function handleMouseDown(e) {
    if (!image) return;

    // Middle click OR Selection Tool + Spacebar = Pan
    if (e.button === 1 || spacePressed || (activeTool === 'select' && e.button === 0 && e.shiftKey)) {
        interactState = 'panning';
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        workspace.style.cursor = 'grabbing';
        return;
    }

    if (e.button !== 0) return; // Left click only for markup

    const mousePos = getCanvasMousePos(e);
    const imgPos = toImageSpace(mousePos.x, mousePos.y);

    startX = imgPos.x;
    startY = imgPos.y;
    currentX = imgPos.x;
    currentY = imgPos.y;

    if (activeTool === 'select') {
        // 1. Check if clicking inside selected annotation's handles
        if (selectedId !== null) {
            const ann = annotations.find(a => a.id === selectedId);
            if (ann) {
                const handleIndex = getHandleAtPoint(ann, imgPos.x, imgPos.y);
                if (handleIndex !== -1) {
                    pushUndo();
                    interactState = 'resizing';
                    activeHandleIndex = handleIndex;
                    startShapeState = JSON.parse(JSON.stringify(ann)); // Deep copy
                    return;
                }
            }
        }

        // 2. Hit test annotations (reverse search for top-most)
        const hitAnn = getAnnotationAtPoint(imgPos.x, imgPos.y);
        if (hitAnn) {
            pushUndo();
            selectedId = hitAnn.id;
            interactState = 'moving';
            startShapeState = JSON.parse(JSON.stringify(hitAnn)); // Deep copy
            drawAll();
        } else {
            selectedId = null;

            // Check if clicking selection handles
            if (selectionBox) {
                const handles = getCropHandles(selectionBox);
                const hs = 12 / zoom; // Interactive hit area size
                let hitHandleIndex = -1;
                for (let i = 0; i < handles.length; i++) {
                    if (Math.abs(imgPos.x - handles[i].x) < hs && Math.abs(imgPos.y - handles[i].y) < hs) {
                        hitHandleIndex = i;
                        break;
                    }
                }
                if (hitHandleIndex !== -1) {
                    interactState = 'resizing-selection';
                    activeHandleIndex = hitHandleIndex;
                    startShapeState = JSON.parse(JSON.stringify(selectionBox));
                    return;
                }

                // Check if clicking inside the selection box (with tolerance for negative width/height)
                const sx = Math.min(selectionBox.x, selectionBox.x + selectionBox.w);
                const sy = Math.min(selectionBox.y, selectionBox.y + selectionBox.h);
                const sw = Math.abs(selectionBox.w);
                const sh = Math.abs(selectionBox.h);
                if (imgPos.x >= sx && imgPos.x <= sx + sw &&
                    imgPos.y >= sy && imgPos.y <= sy + sh) {
                    interactState = 'moving-selection';
                    startShapeState = JSON.parse(JSON.stringify(selectionBox));
                    return;
                }
            }

            // Start drawing a new selection box
            interactState = 'drawing-selection';
            selectionBox = {
                x: imgPos.x,
                y: imgPos.y,
                w: 0,
                h: 0
            };
            drawAll();
        }
    } else if (activeTool === 'eraser') {
        interactState = 'erasing';
        pushUndo();
        const hitAnn = getAnnotationAtPoint(imgPos.x, imgPos.y);
        if (hitAnn) {
            annotations = annotations.filter(a => a.id !== hitAnn.id);
            selectedId = null;
            drawAll();
        }
    } else if (activeTool === 'crop') {
        if (cropBox) {
            // 1. Check if clicking inside handles
            const handles = getCropHandles(cropBox);
            const hs = 12 / zoom; // Interactive hit area size
            let hitHandleIndex = -1;
            for (let i = 0; i < handles.length; i++) {
                if (Math.abs(imgPos.x - handles[i].x) < hs && Math.abs(imgPos.y - handles[i].y) < hs) {
                    hitHandleIndex = i;
                    break;
                }
            }
            if (hitHandleIndex !== -1) {
                interactState = 'resizing-crop';
                activeHandleIndex = hitHandleIndex;
                startShapeState = JSON.parse(JSON.stringify(cropBox));
                return;
            }

            // 2. Check if clicking inside the crop box
            if (imgPos.x >= cropBox.x && imgPos.x <= cropBox.x + cropBox.w &&
                imgPos.y >= cropBox.y && imgPos.y <= cropBox.y + cropBox.h) {
                interactState = 'moving-crop';
                startShapeState = JSON.parse(JSON.stringify(cropBox));
                return;
            }
        }
    } else if (activeTool === 'text') {
        startTextEditing(imgPos.x, imgPos.y, e.clientX, e.clientY);
    } else {
        // Drawing other shapes
        interactState = 'drawing';
        pushUndo();
        const newAnnId = Date.now().toString();

        let newAnn = {
            id: newAnnId,
            type: activeTool,
            strokeColor: strokeColor,
            strokeWidth: strokeWidth
        };

        if (activeTool === 'rect') {
            newAnn.x = startX;
            newAnn.y = startY;
            newAnn.w = 0;
            newAnn.h = 0;
            newAnn.fillColor = fillColor;
        } else if (activeTool === 'circle') {
            newAnn.cx = startX;
            newAnn.cy = startY;
            newAnn.r = 0;
            newAnn.fillColor = fillColor;
        } else if (activeTool === 'arrow' || activeTool === 'line') {
            newAnn.x1 = startX;
            newAnn.y1 = startY;
            newAnn.x2 = startX;
            newAnn.y2 = startY;
        } else if (activeTool === 'pen') {
            newAnn.points = [{ x: startX, y: startY }];
        }

        annotations.push(newAnn);
        selectedId = newAnnId;
        drawAll();
    }
}

function handleMouseMove(e) {
    if (!image) return;

    const mousePos = getCanvasMousePos(e);
    const imgPos = toImageSpace(mousePos.x, mousePos.y);

    currentX = imgPos.x;
    currentY = imgPos.y;

    if (interactState === 'panning') {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        panX += dx;
        panY += dy;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        drawAll();
        return;
    }

    if (interactState === 'erasing') {
        const hitAnn = getAnnotationAtPoint(imgPos.x, imgPos.y);
        if (hitAnn) {
            annotations = annotations.filter(a => a.id !== hitAnn.id);
            selectedId = null;
            drawAll();
        }
        return;
    }

    if (interactState === 'drawing') {
        const ann = annotations.find(a => a.id === selectedId);
        if (!ann) return;

        if (ann.type === 'rect') {
            ann.w = imgPos.x - startX;
            ann.h = imgPos.y - startY;
        } else if (ann.type === 'circle') {
            ann.r = Math.sqrt((imgPos.x - startX) ** 2 + (imgPos.y - startY) ** 2);
        } else if (ann.type === 'arrow' || ann.type === 'line') {
            ann.x2 = imgPos.x;
            ann.y2 = imgPos.y;
        } else if (ann.type === 'pen') {
            ann.points.push({ x: imgPos.x, y: imgPos.y });
        }
        drawAll();
        return;
    }

    if (interactState === 'moving' && selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (!ann || !startShapeState) return;

        const dx = imgPos.x - startX;
        const dy = imgPos.y - startY;

        if (ann.type === 'rect') {
            ann.x = startShapeState.x + dx;
            ann.y = startShapeState.y + dy;
        } else if (ann.type === 'circle') {
            ann.cx = startShapeState.cx + dx;
            ann.cy = startShapeState.cy + dy;
        } else if (ann.type === 'arrow' || ann.type === 'line') {
            ann.x1 = startShapeState.x1 + dx;
            ann.y1 = startShapeState.y1 + dy;
            ann.x2 = startShapeState.x2 + dx;
            ann.y2 = startShapeState.y2 + dy;
        } else if (ann.type === 'text') {
            ann.x = startShapeState.x + dx;
            ann.y = startShapeState.y + dy;
        } else if (ann.type === 'pen') {
            ann.points = startShapeState.points.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        }
        drawAll();
        return;
    }

    if (interactState === 'moving-crop' && cropBox && startShapeState) {
        const dx = imgPos.x - startX;
        const dy = imgPos.y - startY;
        let newX = startShapeState.x + dx;
        let newY = startShapeState.y + dy;

        // Boundaries checks
        newX = Math.max(0, Math.min(image.width - cropBox.w, newX));
        newY = Math.max(0, Math.min(image.height - cropBox.h, newY));

        cropBox.x = newX;
        cropBox.y = newY;
        drawAll();
        return;
    }

    if (interactState === 'resizing' && selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (!ann || !startShapeState) return;

        resizeAnnotation(ann, activeHandleIndex, imgPos.x, imgPos.y);
        drawAll();
        return;
    }

    if (interactState === 'drawing-selection' && selectionBox) {
        selectionBox.w = imgPos.x - startX;
        selectionBox.h = imgPos.y - startY;
        drawAll();
        return;
    }

    if (interactState === 'moving-selection' && selectionBox && startShapeState) {
        const dx = imgPos.x - startX;
        const dy = imgPos.y - startY;
        let newX = startShapeState.x + dx;
        let newY = startShapeState.y + dy;

        // Boundaries checks
        newX = Math.max(0, Math.min(image.width - selectionBox.w, newX));
        newY = Math.max(0, Math.min(image.height - selectionBox.h, newY));

        selectionBox.x = newX;
        selectionBox.y = newY;
        drawAll();
        return;
    }

    if (interactState === 'resizing-selection' && selectionBox && startShapeState) {
        resizeCropBox(selectionBox, activeHandleIndex, imgPos.x, imgPos.y);
        drawAll();
        return;
    }

    // Set cursors based on hover positions in Selection Tool mode
    if (activeTool === 'select' && interactState === 'idle') {
        // Hovering handles?
        if (selectedId !== null) {
            const ann = annotations.find(a => a.id === selectedId);
            if (ann) {
                const handleIndex = getHandleAtPoint(ann, imgPos.x, imgPos.y);
                if (handleIndex !== -1) {
                    workspace.style.cursor = getResizeCursor(ann, handleIndex);
                    return;
                }
            }
        }

        // Hovering shape?
        const hitAnn = getAnnotationAtPoint(imgPos.x, imgPos.y);
        if (hitAnn) {
            workspace.style.cursor = 'move';
            return;
        }

        // Hovering selectionBox handles?
        if (selectionBox) {
            const handles = getCropHandles(selectionBox);
            const hs = 10 / zoom;
            let hitHandleIndex = -1;
            for (let i = 0; i < handles.length; i++) {
                if (Math.abs(imgPos.x - handles[i].x) < hs && Math.abs(imgPos.y - handles[i].y) < hs) {
                    hitHandleIndex = i;
                    break;
                }
            }
            if (hitHandleIndex !== -1) {
                workspace.style.cursor = getResizeCursor({ type: 'rect' }, hitHandleIndex);
                return;
            }

            // Hovering inside selectionBox?
            const sx = Math.min(selectionBox.x, selectionBox.x + selectionBox.w);
            const sy = Math.min(selectionBox.y, selectionBox.y + selectionBox.h);
            const sw = Math.abs(selectionBox.w);
            const sh = Math.abs(selectionBox.h);
            if (imgPos.x >= sx && imgPos.x <= sx + sw &&
                imgPos.y >= sy && imgPos.y <= sy + sh) {
                workspace.style.cursor = 'move';
                return;
            }
        }

        workspace.style.cursor = 'default';
    }

    // Set cursors based on hover positions in Crop mode
    if (activeTool === 'crop' && interactState === 'idle' && cropBox) {
        // Hovering handles?
        const handles = getCropHandles(cropBox);
        const hs = 10 / zoom;
        let hitHandleIndex = -1;
        for (let i = 0; i < handles.length; i++) {
            if (Math.abs(imgPos.x - handles[i].x) < hs && Math.abs(imgPos.y - handles[i].y) < hs) {
                hitHandleIndex = i;
                break;
            }
        }
        if (hitHandleIndex !== -1) {
            workspace.style.cursor = getResizeCursor({ type: 'rect' }, hitHandleIndex);
            return;
        }

        // Hovering inside cropbox?
        if (imgPos.x >= cropBox.x && imgPos.x <= cropBox.x + cropBox.w &&
            imgPos.y >= cropBox.y && imgPos.y <= cropBox.y + cropBox.h) {
            workspace.style.cursor = 'move';
        } else {
            workspace.style.cursor = 'default';
        }
    }
}

function handleMouseUp(e) {
    if (interactState === 'panning') {
        interactState = 'idle';
        workspace.style.cursor = spacePressed ? 'grab' : 'default';
        return;
    }

    if (interactState === 'erasing') {
        interactState = 'idle';
        const prevAnnotations = undoStack.length > 0 ? JSON.parse(undoStack[undoStack.length - 1]) : [];
        if (JSON.stringify(annotations) === JSON.stringify(prevAnnotations)) {
            undoStack.pop();
        } else {
            showToast('Shape(s) erased');
        }
        return;
    }

    if (interactState === 'drawing') {
        // If drawing resulted in a shape with 0 area or length, discard it
        const ann = annotations.find(a => a.id === selectedId);
        if (ann) {
            let invalid = false;
            if (ann.type === 'rect' && Math.abs(ann.w) < 3 && Math.abs(ann.h) < 3) invalid = true;
            if (ann.type === 'circle' && ann.r < 3) invalid = true;
            if ((ann.type === 'line' || ann.type === 'arrow') && Math.sqrt((ann.x2 - ann.x1) ** 2 + (ann.y2 - ann.y1) ** 2) < 3) invalid = true;
            if (ann.type === 'pen' && ann.points.length < 2) invalid = true;

            if (invalid) {
                annotations = annotations.filter(a => a.id !== selectedId);
                selectedId = null;
                undoStack.pop(); // Revert the undo state we pushed on mouseDown
            }
        }
        interactState = 'idle';
        drawAll();
        return;
    }

    if (interactState === 'moving' || interactState === 'resizing') {
        // Check if anything actually changed to avoid adding duplicate undo items
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && startShapeState && JSON.stringify(ann) === JSON.stringify(startShapeState)) {
            // Nothing changed! Pop the stack to revert the mouseDown push
            undoStack.pop();
        }
        interactState = 'idle';
        activeHandleIndex = -1;
        startShapeState = null;
        drawAll();
    }

    if (interactState === 'moving-crop' || interactState === 'resizing-crop') {
        interactState = 'idle';
        activeHandleIndex = -1;
        startShapeState = null;
        drawAll();
    }

    if (interactState === 'drawing-selection' || interactState === 'moving-selection' || interactState === 'resizing-selection') {
        if (selectionBox) {
            // Normalize selectionBox width and height so they are always positive
            if (selectionBox.w < 0) {
                selectionBox.x += selectionBox.w;
                selectionBox.w = Math.abs(selectionBox.w);
            }
            if (selectionBox.h < 0) {
                selectionBox.y += selectionBox.h;
                selectionBox.h = Math.abs(selectionBox.h);
            }
            // If selection is too small, reset/clear it
            if (selectionBox.w < 5 || selectionBox.h < 5) {
                selectionBox = null;
            }
        }
        interactState = 'idle';
        activeHandleIndex = -1;
        startShapeState = null;
        drawAll();
    }
}

function handleMouseWheel(e) {
    if (!image) return;
    e.preventDefault();

    const mousePos = getCanvasMousePos(e);
    const imgPos = toImageSpace(mousePos.x, mousePos.y);

    const zoomFactor = 1.12;
    let newZoom = zoom;

    if (e.deltaY < 0) {
        newZoom *= zoomFactor;
    } else {
        newZoom /= zoomFactor;
    }

    // Bounds between 5% and 800%
    newZoom = Math.max(0.05, Math.min(8, newZoom));

    // Recalculate panning offsets to zoom in at pointer location
    panX = mousePos.x - imgPos.x * newZoom;
    panY = mousePos.y - imgPos.y * newZoom;
    zoom = newZoom;

    drawAll();
    updateZoomText();
}

function zoomAtCenter(factor) {
    if (!image) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const imgPos = toImageSpace(cx, cy);

    zoom = Math.max(0.05, Math.min(8, zoom * factor));
    panX = cx - imgPos.x * zoom;
    panY = cy - imgPos.y * zoom;

    drawAll();
    updateZoomText();
}

function resetZoomAndPan() {
    if (!image) return;

    const wWidth = workspace.clientWidth;
    const wHeight = workspace.clientHeight;

    // Fit image inside container with 15px padding
    const padding = 30;
    const scaleX = (wWidth - padding) / image.width;
    const scaleY = (wHeight - padding) / image.height;

    zoom = Math.min(scaleX, scaleY, 1.0); // Don't scale up past 100%

    panX = (wWidth - image.width * zoom) / 2;
    panY = (wHeight - image.height * zoom) / 2;

    drawAll();
    updateZoomText();
}

function updateZoomText() {
    document.getElementById('zoom-text').textContent = `${Math.round(zoom * 100)}%`;
}

// ==========================================================================
// Text Tool Inline Input Editing Layer
// ==========================================================================
let editingTextAnnId = null;

function startTextEditing(imgX, imgY, screenX, screenY, existingText = '') {
    interactState = 'typing';
    editingTextAnnId = existingText ? selectedId : null;

    // Position text area exactly over canvas position in screen space
    const canvasRect = canvas.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();

    // Convert image space back to canvas pixels relative to workspace viewport
    const displayX = imgX * zoom + panX + canvasRect.left - workspaceRect.left;
    const displayY = imgY * zoom + panY + canvasRect.top - workspaceRect.top;

    textEditorInput.style.display = 'block';
    textEditorInput.style.left = `${displayX}px`;
    textEditorInput.style.top = `${displayY}px`;
    textEditorInput.style.fontSize = `${fontSize * zoom}px`;
    textEditorInput.style.fontFamily = fontFamily;
    textEditorInput.style.color = strokeColor;
    textEditorInput.style.minWidth = `${150 * zoom}px`;
    textEditorInput.style.minHeight = `${fontSize * zoom * 1.5}px`;
    textEditorInput.value = existingText;

    // Hide the actual shape being edited so we don't draw double text
    if (editingTextAnnId) {
        const ann = annotations.find(a => a.id === editingTextAnnId);
        if (ann) ann.isEditing = true;
        drawAll();
    }

    setTimeout(() => {
        textEditorInput.focus();
        textEditorInput.select();
    }, 10);
}

function commitText() {
    if (interactState !== 'typing') return;

    const textVal = textEditorInput.value.trim();
    textEditorInput.style.display = 'none';

    if (editingTextAnnId) {
        // Editing existing text
        const ann = annotations.find(a => a.id === editingTextAnnId);
        if (ann) {
            ann.isEditing = false;
            if (textVal === '') {
                // Delete if cleared
                pushUndo();
                annotations = annotations.filter(a => a.id !== editingTextAnnId);
                selectedId = null;
            } else if (ann.text !== textVal) {
                // Save edit
                pushUndo();
                ann.text = textVal;
            }
        }
    } else if (textVal !== '') {
        // Creating new text
        pushUndo();
        const newAnnId = Date.now().toString();
        annotations.push({
            id: newAnnId,
            type: 'text',
            x: startX,
            y: startY,
            text: textVal,
            color: strokeColor,
            fontSize: fontSize,
            fontFamily: fontFamily
        });
        selectedId = newAnnId;
    }

    interactState = 'idle';
    editingTextAnnId = null;
    drawAll();
}

function handleDoubleClick(e) {
    if (!image || activeTool !== 'select') return;

    const mousePos = getCanvasMousePos(e);
    const imgPos = toImageSpace(mousePos.x, mousePos.y);

    const hitAnn = getAnnotationAtPoint(imgPos.x, imgPos.y);
    if (hitAnn && hitAnn.type === 'text') {
        selectedId = hitAnn.id;
        startTextEditing(hitAnn.x, hitAnn.y, e.clientX, e.clientY, hitAnn.text);
    }
}

// ==========================================================================
// Hit Testing & Selection Helpers
// ==========================================================================
function getAnnotationAtPoint(x, y) {
    // Loop backwards so we select overlaying shapes first
    for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (ann.isEditing) continue; // Skip hit testing on active editor

        if (ann.type === 'rect') {
            const x1 = Math.min(ann.x, ann.x + ann.w);
            const x2 = Math.max(ann.x, ann.x + ann.w);
            const y1 = Math.min(ann.y, ann.y + ann.h);
            const y2 = Math.max(ann.y, ann.y + ann.h);

            if (ann.fillColor !== 'transparent') {
                if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return ann;
            } else {
                // Click close to borders
                const margin = 8 / zoom;
                const hitBorder = (Math.abs(x - x1) <= margin || Math.abs(x - x2) <= margin) && y >= y1 && y <= y2 ||
                    (Math.abs(y - y1) <= margin || Math.abs(y - y2) <= margin) && x >= x1 && x <= x2;
                // Or allow hitting inside box with slight margin to make selection easy
                const hitInside = x >= x1 && x <= x2 && y >= y1 && y <= y2;
                if (hitBorder || hitInside) return ann;
            }
        } else if (ann.type === 'circle') {
            const dist = Math.sqrt((x - ann.cx) ** 2 + (y - ann.cy) ** 2);
            if (ann.fillColor !== 'transparent') {
                if (dist <= ann.r + 5 / zoom) return ann;
            } else {
                const margin = 8 / zoom;
                if (Math.abs(dist - ann.r) <= margin) return ann;
                // Also select if click inside circle
                if (dist <= ann.r) return ann;
            }
        } else if (ann.type === 'line' || ann.type === 'arrow') {
            const dist = getDistToSegment(x, y, ann.x1, ann.y1, ann.x2, ann.y2);
            if (dist <= (8 + ann.strokeWidth / 2) / zoom) return ann;
        } else if (ann.type === 'text') {
            const bounds = getAnnotationBounds(ann);
            if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) return ann;
        } else if (ann.type === 'pen') {
            for (let j = 0; j < ann.points.length - 1; j++) {
                const dist = getDistToSegment(x, y, ann.points[j].x, ann.points[j].y, ann.points[j + 1].x, ann.points[j + 1].y);
                if (dist <= (8 + ann.strokeWidth / 2) / zoom) return ann;
            }
        }
    }
    return null;
}

function getHandleAtPoint(ann, px, py) {
    const handles = getHandlesForAnnotation(ann);
    if (!handles) return -1;

    // Check handles hits in Screen space coordinates!
    const sx = px * zoom + panX;
    const sy = py * zoom + panY;

    for (let i = 0; i < handles.length; i++) {
        const hx = handles[i].x * zoom + panX;
        const hy = handles[i].y * zoom + panY;
        const dist = Math.sqrt((sx - hx) ** 2 + (sy - hy) ** 2);
        if (dist <= 7) return i; // 7px screen hit tolerance
    }
    return -1;
}

// Distance from point to line segment
function getDistToSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Bounding Box calculations
function getAnnotationBounds(ann) {
    if (ann.type === 'rect') {
        return {
            minX: Math.min(ann.x, ann.x + ann.w),
            minY: Math.min(ann.y, ann.y + ann.h),
            maxX: Math.max(ann.x, ann.x + ann.w),
            maxY: Math.max(ann.y, ann.y + ann.h)
        };
    } else if (ann.type === 'circle') {
        return {
            minX: ann.cx - ann.r,
            minY: ann.cy - ann.r,
            maxX: ann.cx + ann.r,
            maxY: ann.cy + ann.r
        };
    } else if (ann.type === 'line' || ann.type === 'arrow') {
        return {
            minX: Math.min(ann.x1, ann.x2),
            minY: Math.min(ann.y1, ann.y2),
            maxX: Math.max(ann.x1, ann.x2),
            maxY: Math.max(ann.y1, ann.y2)
        };
    } else if (ann.type === 'text') {
        const lines = ann.text.split('\n');
        ctx.save();
        ctx.font = `${ann.fontSize}px ${ann.fontFamily}`;
        const widths = lines.map(l => ctx.measureText(l).width);
        ctx.restore();
        const textWidth = Math.max(...widths, 40);
        const textHeight = lines.length * ann.fontSize * 1.2;
        return {
            minX: ann.x,
            minY: ann.y,
            maxX: ann.x + textWidth,
            maxY: ann.y + textHeight
        };
    } else if (ann.type === 'pen') {
        const xs = ann.points.map(p => p.x);
        const ys = ann.points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        };
    }
}

// Bounding Box Handles
function getHandlesForAnnotation(ann) {
    if (ann.type === 'rect') {
        const x1 = ann.x;
        const y1 = ann.y;
        const x2 = ann.x + ann.w;
        const y2 = ann.y + ann.h;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return [
            { x: x1, y: y1 }, // TL (0)
            { x: mx, y: y1 }, // TC (1)
            { x: x2, y: y1 }, // TR (2)
            { x: x2, y: my }, // MR (3)
            { x: x2, y: y2 }, // BR (4)
            { x: mx, y: y2 }, // BC (5)
            { x: x1, y: y2 }, // BL (6)
            { x: x1, y: my }  // ML (7)
        ];
    } else if (ann.type === 'circle') {
        const cx = ann.cx;
        const cy = ann.cy;
        const r = ann.r;
        return [
            { x: cx - r, y: cy - r }, // TL (0)
            { x: cx, y: cy - r }, // TC (1)
            { x: cx + r, y: cy - r }, // TR (2)
            { x: cx + r, y: cy },     // MR (3)
            { x: cx + r, y: cy + r }, // BR (4)
            { x: cx, y: cy + r }, // BC (5)
            { x: cx - r, y: cy + r }, // BL (6)
            { x: cx - r, y: cy }      // ML (7)
        ];
    } else if (ann.type === 'line' || ann.type === 'arrow') {
        return [
            { x: ann.x1, y: ann.y1 }, // Start (0)
            { x: ann.x2, y: ann.y2 }  // End (1)
        ];
    }
    // Pen and Text annotations move as whole vectors, no drag handles required
    return null;
}

// Cursor styling for active handles
function getResizeCursor(ann, handleIndex) {
    if (ann.type === 'line' || ann.type === 'arrow') return 'move';

    // Bounding Box handles cursors
    switch (handleIndex) {
        case 0:
        case 4:
            return 'nwse-resize';
        case 1:
        case 5:
            return 'ns-resize';
        case 2:
        case 6:
            return 'nesw-resize';
        case 3:
        case 7:
            return 'ew-resize';
        default:
            return 'default';
    }
}

// Resizing logic for shapes
function resizeAnnotation(ann, handleIndex, px, py) {
    if (ann.type === 'rect') {
        const left = startShapeState.x;
        const top = startShapeState.y;
        const right = startShapeState.x + startShapeState.w;
        const bottom = startShapeState.y + startShapeState.h;

        switch (handleIndex) {
            case 0: // TL
                ann.x = px;
                ann.y = py;
                ann.w = right - px;
                ann.h = bottom - py;
                break;
            case 1: // TC
                ann.y = py;
                ann.h = bottom - py;
                break;
            case 2: // TR
                ann.w = px - left;
                ann.y = py;
                ann.h = bottom - py;
                break;
            case 3: // MR
                ann.w = px - left;
                break;
            case 4: // BR
                ann.w = px - left;
                ann.h = py - top;
                break;
            case 5: // BC
                ann.h = py - top;
                break;
            case 6: // BL
                ann.x = px;
                ann.w = right - px;
                ann.h = py - top;
                break;
            case 7: // ML
                ann.x = px;
                ann.w = right - px;
                break;
        }
    } else if (ann.type === 'circle') {
        const cx = startShapeState.cx;
        const cy = startShapeState.cy;

        switch (handleIndex) {
            case 1: // TC
            case 5: // BC
                ann.r = Math.abs(py - cy);
                break;
            case 3: // MR
            case 7: // ML
                ann.r = Math.abs(px - cx);
                break;
            case 0: // TL
            case 2: // TR
            case 4: // BR
            case 6: // BL
                // Distance formula from center / sqrt(2) to approximate bounding resize
                ann.r = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / Math.sqrt(2);
                break;
        }
    } else if (ann.type === 'line' || ann.type === 'arrow') {
        if (handleIndex === 0) {
            ann.x1 = px;
            ann.y1 = py;
        } else {
            ann.x2 = px;
            ann.y2 = py;
        }
    }
}

// Nudge selected annotation via keyboard arrow keys
function nudgeSelected(dx, dy) {
    if (selectedId === null) return;
    const ann = annotations.find(a => a.id === selectedId);
    if (!ann) return;

    pushUndo();
    if (ann.type === 'rect') {
        ann.x += dx;
        ann.y += dy;
    } else if (ann.type === 'circle') {
        ann.cx += dx;
        ann.cy += dy;
    } else if (ann.type === 'arrow' || ann.type === 'line') {
        ann.x1 += dx; ann.y1 += dy;
        ann.x2 += dx; ann.y2 += dy;
    } else if (ann.type === 'text') {
        ann.x += dx;
        ann.y += dy;
    } else if (ann.type === 'pen') {
        ann.points.forEach(p => {
            p.x += dx;
            p.y += dy;
        });
    }
    drawAll();
}

// ==========================================================================
// Drawing Functions (Canvas Render)
// ==========================================================================
function drawAnnotation(dCtx, ann) {
    if (ann.isEditing) return; // Hide drawing during textarea input focus

    dCtx.strokeStyle = ann.strokeColor;
    dCtx.lineWidth = ann.strokeWidth;
    dCtx.fillStyle = ann.fillColor;
    dCtx.lineCap = 'round';
    dCtx.lineJoin = 'round';

    if (ann.type === 'rect') {
        dCtx.beginPath();
        dCtx.rect(ann.x, ann.y, ann.w, ann.h);
        if (ann.fillColor !== 'transparent') dCtx.fill();
        dCtx.stroke();
    } else if (ann.type === 'circle') {
        dCtx.beginPath();
        dCtx.arc(ann.cx, ann.cy, ann.r, 0, Math.PI * 2);
        if (ann.fillColor !== 'transparent') dCtx.fill();
        dCtx.stroke();
    } else if (ann.type === 'line') {
        dCtx.beginPath();
        dCtx.moveTo(ann.x1, ann.y1);
        dCtx.lineTo(ann.x2, ann.y2);
        dCtx.stroke();
    } else if (ann.type === 'arrow') {
        // Line
        dCtx.beginPath();
        dCtx.moveTo(ann.x1, ann.y1);
        dCtx.lineTo(ann.x2, ann.y2);
        dCtx.stroke();

        // Arrow head pointing towards (x2, y2)
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        const headLength = Math.max(10, ann.strokeWidth * 3.5);

        dCtx.fillStyle = ann.strokeColor;
        dCtx.beginPath();
        dCtx.moveTo(ann.x2, ann.y2);
        dCtx.lineTo(ann.x2 - headLength * Math.cos(angle - Math.PI / 6), ann.y2 - headLength * Math.sin(angle - Math.PI / 6));
        dCtx.lineTo(ann.x2 - headLength * Math.cos(angle + Math.PI / 6), ann.y2 - headLength * Math.sin(angle + Math.PI / 6));
        dCtx.closePath();
        dCtx.fill();
    } else if (ann.type === 'pen') {
        if (ann.points.length < 2) return;
        dCtx.beginPath();
        dCtx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
            dCtx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        dCtx.stroke();
    } else if (ann.type === 'text') {
        dCtx.fillStyle = ann.color;
        dCtx.font = `${ann.fontSize}px ${ann.fontFamily}`;
        dCtx.textBaseline = 'top';
        const lines = ann.text.split('\n');
        lines.forEach((line, idx) => {
            dCtx.fillText(line, ann.x, ann.y + idx * ann.fontSize * 1.2);
        });
    }
}

function drawSelectionAndHandles(dCtx, ann) {
    const handles = getHandlesForAnnotation(ann);

    // Draw bounding box if box type OR text/pen
    if (ann.type === 'rect' || ann.type === 'circle' || ann.type === 'text' || ann.type === 'pen') {
        const bounds = getAnnotationBounds(ann);
        // Convert to Screen space
        const x1 = bounds.minX * zoom + panX;
        const y1 = bounds.minY * zoom + panY;
        const x2 = bounds.maxX * zoom + panX;
        const y2 = bounds.maxY * zoom + panY;

        dCtx.strokeStyle = '#0A84FF';
        dCtx.lineWidth = 1.5;
        dCtx.setLineDash([4, 3]);
        dCtx.beginPath();
        dCtx.rect(x1, y1, x2 - x1, y2 - y1);
        dCtx.stroke();
        dCtx.setLineDash([]); // Reset
    }

    // Draw handle circles if supported
    if (handles) {
        handles.forEach(h => {
            const sx = h.x * zoom + panX;
            const sy = h.y * zoom + panY;

            dCtx.fillStyle = '#FFFFFF';
            dCtx.strokeStyle = '#0A84FF';
            dCtx.lineWidth = 2;
            dCtx.beginPath();
            dCtx.arc(sx, sy, 5.5, 0, Math.PI * 2);
            dCtx.fill();
            dCtx.stroke();
        });
    }
}

function drawAll() {
    if (!image) {
        document.getElementById('empty-state-view').style.display = 'flex';
        canvasContainer.style.display = 'none';

        // Reset status
        document.getElementById('footer-dimensions').textContent = '- x - pixels';
        document.getElementById('footer-status').textContent = 'Ready';
        return;
    }

    document.getElementById('empty-state-view').style.display = 'none';
    canvasContainer.style.display = 'block';

    // Canvas dimensions to fit workspace client size
    const rect = workspace.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear Workspace
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image & drawings inside transform context
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Render photo / canvas
    ctx.drawImage(image, 0, 0);

    // Render annotations
    annotations.forEach(ann => {
        drawAnnotation(ctx, ann);
    });

    // Render crop overlay if active
    if (activeTool === 'crop' && cropBox) {
        drawCropOverlay(ctx);
    }

    // Render selection box if active
    if (activeTool === 'select' && selectionBox) {
        drawSelectionBox(ctx);
    }

    ctx.restore();

    // Render selection box & handles in screen coordinates
    if (selectedId !== null) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann) {
            drawSelectionAndHandles(ctx, ann);
        }
    }
}

// ==========================================================================
// Cropping Mode Helper Functions
// ==========================================================================
function drawCropOverlay(dCtx) {
    // 1. Semi-transparent dark overlay outside the cropBox
    dCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';

    // Top box
    dCtx.fillRect(0, 0, image.width, cropBox.y);
    // Bottom box
    dCtx.fillRect(0, cropBox.y + cropBox.h, image.width, image.height - (cropBox.y + cropBox.h));
    // Left box
    dCtx.fillRect(0, cropBox.y, cropBox.x, cropBox.h);
    // Right box
    dCtx.fillRect(cropBox.x + cropBox.w, cropBox.y, image.width - (cropBox.x + cropBox.w), cropBox.h);

    // 2. Dashed white crop border
    dCtx.strokeStyle = '#ffffff';
    dCtx.lineWidth = 2 / zoom;
    dCtx.setLineDash([6 / zoom, 4 / zoom]);
    dCtx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
    dCtx.setLineDash([]); // Reset dash

    // 3. Render 8 resize handles
    const hs = 8 / zoom; // Handle visual size
    dCtx.fillStyle = '#007AFF'; // Linux Blue
    dCtx.strokeStyle = '#ffffff';
    dCtx.lineWidth = 1.5 / zoom;

    const handles = getCropHandles(cropBox);
    handles.forEach(h => {
        dCtx.beginPath();
        dCtx.rect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        dCtx.fill();
        dCtx.stroke();
    });
}

function drawSelectionBox(dCtx) {
    if (!selectionBox) return;

    // Draw dotted line
    dCtx.strokeStyle = '#0A84FF'; // Linux System Blue
    dCtx.lineWidth = 1.5 / zoom;
    dCtx.setLineDash([6 / zoom, 4 / zoom]); // Dotted border
    dCtx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    dCtx.setLineDash([]); // Reset dash

    // Draw handles
    const hs = 8 / zoom;
    dCtx.fillStyle = '#007AFF'; // Linux Blue
    dCtx.strokeStyle = '#ffffff';
    dCtx.lineWidth = 1.5 / zoom;

    const handles = getCropHandles(selectionBox);
    handles.forEach(h => {
        dCtx.beginPath();
        dCtx.rect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        dCtx.fill();
        dCtx.stroke();
    });
}

function getCropHandles(cb) {
    return [
        { x: cb.x, y: cb.y }, // top-left (0)
        { x: cb.x + cb.w / 2, y: cb.y }, // top-center (1)
        { x: cb.x + cb.w, y: cb.y }, // top-right (2)
        { x: cb.x + cb.w, y: cb.y + cb.h / 2 }, // middle-right (3)
        { x: cb.x + cb.w, y: cb.y + cb.h }, // bottom-right (4)
        { x: cb.x + cb.w / 2, y: cb.y + cb.h }, // bottom-center (5)
        { x: cb.x, y: cb.y + cb.h }, // bottom-left (6)
        { x: cb.x, y: cb.y + cb.h / 2 } // middle-left (7)
    ];
}

function resizeCropBox(cb, index, mx, my) {
    // Keep it within bounds of image width/height
    mx = Math.max(0, Math.min(image.width, mx));
    my = Math.max(0, Math.min(image.height, my));

    const minSize = 15;

    switch (index) {
        case 0: // Top-Left
            const x2_0 = cb.x + cb.w;
            const y2_0 = cb.y + cb.h;
            cb.x = Math.min(x2_0 - minSize, mx);
            cb.y = Math.min(y2_0 - minSize, my);
            cb.w = x2_0 - cb.x;
            cb.h = y2_0 - cb.y;
            break;
        case 1: // Top-Center
            const y2_1 = cb.y + cb.h;
            cb.y = Math.min(y2_1 - minSize, my);
            cb.h = y2_1 - cb.y;
            break;
        case 2: // Top-Right
            const y2_2 = cb.y + cb.h;
            cb.w = Math.max(minSize, mx - cb.x);
            cb.y = Math.min(y2_2 - minSize, my);
            cb.h = y2_2 - cb.y;
            break;
        case 3: // Middle-Right
            cb.w = Math.max(minSize, mx - cb.x);
            break;
        case 4: // Bottom-Right
            cb.w = Math.max(minSize, mx - cb.x);
            cb.h = Math.max(minSize, my - cb.y);
            break;
        case 5: // Bottom-Center
            cb.h = Math.max(minSize, my - cb.y);
            break;
        case 6: // Bottom-Left
            const x2_6 = cb.x + cb.w;
            cb.x = Math.min(x2_6 - minSize, mx);
            cb.w = x2_6 - cb.x;
            cb.h = Math.max(minSize, my - cb.y);
            break;
        case 7: // Middle-Left
            const x2_7 = cb.x + cb.w;
            cb.x = Math.min(x2_7 - minSize, mx);
            cb.w = x2_7 - cb.x;
            break;
    }
}

function rotateImage90() {
    if (!image) {
        showToast('Please open an image first', true);
        return;
    }
    pushUndo();

    const w = image.width;
    const h = image.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = h;
    tempCanvas.height = w;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.translate(h / 2, w / 2);
    tempCtx.rotate(90 * Math.PI / 180);
    tempCtx.drawImage(image, -w / 2, -h / 2);

    annotations.forEach(ann => {
        if (ann.type === 'rect') {
            const oldX = ann.x;
            const oldY = ann.y;
            const oldW = ann.w;
            const oldH = ann.h;

            const rX = oldW < 0 ? oldX + oldW : oldX;
            const rY = oldH < 0 ? oldY + oldH : oldY;
            const rW = Math.abs(oldW);
            const rH = Math.abs(oldH);

            ann.x = h - rY - rH;
            ann.y = rX;
            ann.w = rH;
            ann.h = rW;
        } else if (ann.type === 'circle') {
            const oldCx = ann.cx;
            ann.cx = h - ann.cy;
            ann.cy = oldCx;
        } else if (ann.type === 'arrow' || ann.type === 'line') {
            const oldX1 = ann.x1;
            const oldY1 = ann.y1;
            ann.x1 = h - oldY1;
            ann.y1 = oldX1;

            const oldX2 = ann.x2;
            const oldY2 = ann.y2;
            ann.x2 = h - oldY2;
            ann.y2 = oldX2;
        } else if (ann.type === 'text') {
            const oldX = ann.x;
            ann.x = h - ann.y;
            ann.y = oldX;
        } else if (ann.type === 'pen') {
            ann.points.forEach(p => {
                const oldX = p.x;
                p.x = h - p.y;
                p.y = oldX;
            });
        }
    });

    if (selectionBox) {
        const oldX = selectionBox.x;
        const oldY = selectionBox.y;
        const oldW = selectionBox.w;
        const oldH = selectionBox.h;

        const rX = oldW < 0 ? oldX + oldW : oldX;
        const rY = oldH < 0 ? oldY + oldH : oldY;
        const rW = Math.abs(oldW);
        const rH = Math.abs(oldH);

        selectionBox.x = h - rY - rH;
        selectionBox.y = rX;
        selectionBox.w = rH;
        selectionBox.h = rW;
    }

    const rotatedImg = new Image();
    rotatedImg.onload = () => {
        image = rotatedImg;
        document.getElementById('footer-dimensions').textContent = `${rotatedImg.width} x ${rotatedImg.height} pixels`;
        resetZoomAndPan();
        drawAll();
        showToast('Rotated 90° Clockwise');
    };
    rotatedImg.src = tempCanvas.toDataURL();
}

function cropToSelection() {
    if (!image) return;
    if (!selectionBox) {
        showToast('No active selection to crop. Draw one with the select tool.', true);
        return;
    }

    let x = selectionBox.x;
    let y = selectionBox.y;
    let w = selectionBox.w;
    let h = selectionBox.h;

    if (w < 0) {
        x += w;
        w = Math.abs(w);
    }
    if (h < 0) {
        y += h;
        h = Math.abs(h);
    }

    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    w = Math.min(image.width - x, Math.floor(w));
    h = Math.min(image.height - y, Math.floor(h));

    if (w < 10 || h < 10) {
        showToast('Selection area too small to crop!', true);
        return;
    }

    pushUndo();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(image, x, y, w, h, 0, 0, w, h);

    const croppedImg = new Image();
    croppedImg.onload = () => {
        image = croppedImg;

        annotations.forEach(ann => {
            if (ann.type === 'rect') {
                ann.x -= x;
                ann.y -= y;
            } else if (ann.type === 'circle') {
                ann.cx -= x;
                ann.cy -= y;
            } else if (ann.type === 'arrow' || ann.type === 'line') {
                ann.x1 -= x;
                ann.y1 -= y;
                ann.x2 -= x;
                ann.y2 -= y;
            } else if (ann.type === 'text') {
                ann.x -= x;
                ann.y -= y;
            } else if (ann.type === 'pen') {
                ann.points.forEach(p => {
                    p.x -= x;
                    p.y -= y;
                });
            }
        });

        annotations = annotations.filter(ann => {
            if (ann.type === 'rect') {
                return ann.x + ann.w > 0 && ann.x < w && ann.y + ann.h > 0 && ann.y < h;
            }
            if (ann.type === 'circle') {
                return ann.cx + ann.r > 0 && ann.cx - ann.r < w && ann.cy + ann.r > 0 && ann.cy - ann.r < h;
            }
            if (ann.type === 'text') {
                return ann.x > -100 && ann.x < w + 100 && ann.y > -50 && ann.y < h + 50;
            }
            return true;
        });

        selectionBox = {
            x: w * 0.1,
            y: h * 0.1,
            w: w * 0.8,
            h: h * 0.8
        };

        document.getElementById('footer-dimensions').textContent = `${w} x ${h} pixels`;
        resetZoomAndPan();
        drawAll();
        showToast('Cropped to selection!');
    };
    croppedImg.src = tempCanvas.toDataURL();
}

function applyCrop() {
    if (!image || !cropBox) return;

    // Ensure cropBox coordinates are bounded inside the image
    const x = Math.max(0, Math.floor(cropBox.x));
    const y = Math.max(0, Math.floor(cropBox.y));
    const w = Math.min(image.width - x, Math.floor(cropBox.w));
    const h = Math.min(image.height - y, Math.floor(cropBox.h));

    if (w < 10 || h < 10) {
        showToast('Crop area too small!', true);
        return;
    }

    pushUndo();

    // Create a temporary canvas to slice the image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw only the cropped region from the current image
    tempCtx.drawImage(image, x, y, w, h, 0, 0, w, h);

    // Create new Image object
    const croppedImg = new Image();
    croppedImg.onload = () => {
        // Update global image object
        image = croppedImg;

        // Adjust existing annotations relative to the new origin
        annotations.forEach(ann => {
            if (ann.type === 'rect') {
                ann.x -= x;
                ann.y -= y;
            } else if (ann.type === 'circle') {
                ann.cx -= x;
                ann.cy -= y;
            } else if (ann.type === 'arrow' || ann.type === 'line') {
                ann.x1 -= x;
                ann.y1 -= y;
                ann.x2 -= x;
                ann.y2 -= y;
            } else if (ann.type === 'text') {
                ann.x -= x;
                ann.y -= y;
            } else if (ann.type === 'pen') {
                ann.points.forEach(p => {
                    p.x -= x;
                    p.y -= y;
                });
            }
        });

        // Filter out annotations that are completely outside the cropped image
        annotations = annotations.filter(ann => {
            if (ann.type === 'rect') {
                return ann.x + ann.w > 0 && ann.x < w && ann.y + ann.h > 0 && ann.y < h;
            }
            if (ann.type === 'circle') {
                return ann.cx + ann.r > 0 && ann.cx - ann.r < w && ann.cy + ann.r > 0 && ann.cy - ann.r < h;
            }
            if (ann.type === 'text') {
                return ann.x > -100 && ann.x < w + 100 && ann.y > -50 && ann.y < h + 50;
            }
            return true;
        });

        // Update dimensions footer text
        document.getElementById('footer-dimensions').textContent = `${w} x ${h} pixels`;

        // Exit crop mode
        setTool('select');
        resetZoomAndPan();
        drawAll();
        showToast('Crop applied! Click Save in toolbar to write file.');
    };
    croppedImg.src = tempCanvas.toDataURL();
}

// Resize listener
window.addEventListener('resize', () => {
    if (image) {
        drawAll();
    }
});

// ==========================================================================
// Image Loading & Canvas Blank Generation
// ==========================================================================
function loadImage(src) {
    document.getElementById('footer-status').textContent = 'Opening image...';

    const img = new Image();
    img.onload = () => {
        image = img;
        annotations = [];
        undoStack = [];
        redoStack = [];
        selectedId = null;
        selectionBox = {
            x: img.width * 0.1,
            y: img.height * 0.1,
            w: img.width * 0.8,
            h: img.height * 0.8
        };

        resetZoomAndPan();

        document.getElementById('footer-status').textContent = 'Ready';
        document.getElementById('footer-dimensions').textContent = `${img.width} x ${img.height} px`;

        // Extract title
        let title = 'Untitled Image';
        if (src.startsWith('data:image')) {
            title = 'Imported Photo';
        } else {
            title = src.substring(src.lastIndexOf('/') + 1);
        }
        document.getElementById('window-title-text').textContent = title;

        // Enable Save menu
        document.getElementById('menu-save-trigger').classList.remove('disabled');

        showToast('Image opened successfully!');
        drawAll();
    };
    img.onerror = () => {
        document.getElementById('footer-status').textContent = 'Error loading image';
        showToast('Could not load image file.', true);
    };
    img.src = src;
}

function loadBlankCanvas(width, height) {
    document.getElementById('footer-status').textContent = 'Creating blank canvas...';

    const blank = document.createElement('canvas');
    blank.width = width;
    blank.height = height;
    const bCtx = blank.getContext('2d');

    // Draw plain canvas white layer
    bCtx.fillStyle = '#FFFFFF';
    bCtx.fillRect(0, 0, width, height);

    image = blank;
    annotations = [];
    undoStack = [];
    redoStack = [];
    selectedId = null;
    selectionBox = {
        x: width * 0.1,
        y: height * 0.1,
        w: width * 0.8,
        h: height * 0.8
    };

    resetZoomAndPan();

    document.getElementById('footer-status').textContent = 'Ready';
    document.getElementById('footer-dimensions').textContent = `${width} x ${height} px`;
    document.getElementById('window-title-text').textContent = 'Untitled Canvas';
    document.getElementById('menu-save-trigger').classList.remove('disabled');

    showToast('Created blank canvas!');
    drawAll();
}

function loadSampleImage() {
    loadImage('assets/wallpaper.png');
}

// ==========================================================================
// Save & Merge Annotations (High-Res Export)
// ==========================================================================
function exportImage() {
    if (!image) return;

    document.getElementById('footer-status').textContent = 'Exporting photo...';

    // Create offscreen canvas at EXACT raw image pixel dimensions
    const outCanvas = document.createElement('canvas');
    outCanvas.width = image.width;
    outCanvas.height = image.height;

    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';

    // Draw raw image
    outCtx.drawImage(image, 0, 0);

    // Draw all vectors in raw pixel coordinates (1:1 scale)
    annotations.forEach(ann => {
        drawAnnotation(outCtx, ann);
    });

    // Save/Download Link
    let title = document.getElementById('window-title-text').textContent;
    if (title.includes('.')) {
        title = title.substring(0, title.lastIndexOf('.')) + '-marked.png';
    } else {
        title += '-marked.png';
    }

    if (window.electronAPI) {
        window.electronAPI.saveFile(outCanvas.toDataURL('image/png'), title)
            .then(res => {
                document.getElementById('footer-status').textContent = 'Ready';
                if (res.success) {
                    showToast(`Photo saved successfully to: ${res.filePath}`);
                } else if (res.reason !== 'canceled') {
                    showToast(`Error saving photo: ${res.reason}`, true);
                }
            })
            .catch(err => {
                document.getElementById('footer-status').textContent = 'Ready';
                showToast(`Error: ${err.message}`, true);
            });
    } else {
        const link = document.createElement('a');
        link.download = title;
        link.href = outCanvas.toDataURL('image/png');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        document.getElementById('footer-status').textContent = 'Ready';
        showToast('Photo exported successfully!');
    }
}

// ==========================================================================
// Undo / Redo / Delete State Management
// ==========================================================================
function getCurrentImageSrc() {
    if (!image) return null;
    if (image instanceof HTMLCanvasElement) {
        return image.toDataURL();
    }
    return image.src || null;
}

function pushUndo() {
    undoStack.push(JSON.stringify({
        annotations: annotations,
        imageSrc: getCurrentImageSrc()
    }));
    redoStack = []; // Clear redo stack on new action
}

function undo() {
    if (undoStack.length === 0) return;

    redoStack.push(JSON.stringify({
        annotations: annotations,
        imageSrc: getCurrentImageSrc()
    }));

    const state = JSON.parse(undoStack.pop());
    annotations = state.annotations;
    selectedId = null;

    if (state.imageSrc && (!image || getCurrentImageSrc() !== state.imageSrc)) {
        const img = new Image();
        img.onload = () => {
            image = img;
            document.getElementById('footer-dimensions').textContent = `${img.width} x ${img.height} px`;
            drawAll();
        };
        img.src = state.imageSrc;
    } else {
        drawAll();
    }
    showToast('Undo');
}

function redo() {
    if (redoStack.length === 0) return;

    undoStack.push(JSON.stringify({
        annotations: annotations,
        imageSrc: getCurrentImageSrc()
    }));

    const state = JSON.parse(redoStack.pop());
    annotations = state.annotations;
    selectedId = null;

    if (state.imageSrc && (!image || getCurrentImageSrc() !== state.imageSrc)) {
        const img = new Image();
        img.onload = () => {
            image = img;
            document.getElementById('footer-dimensions').textContent = `${img.width} x ${img.height} px`;
            drawAll();
        };
        img.src = state.imageSrc;
    } else {
        drawAll();
    }
    showToast('Redo');
}

function deleteSelected() {
    if (selectedId === null) return;
    pushUndo();
    annotations = annotations.filter(a => a.id !== selectedId);
    selectedId = null;
    drawAll();
    showToast('Shape deleted');
}

function clearAll() {
    if (!image || annotations.length === 0) return;
    if (confirm('Are you sure you want to delete all markup annotations?')) {
        pushUndo();
        annotations = [];
        selectedId = null;
        drawAll();
        showToast('Cleared all');
    }
}

// Toast Notifications
let toastTimeout;
function showToast(message, isError = false) {
    const toast = document.getElementById('toast-notification');
    toast.textContent = message;
    toast.style.borderColor = isError ? 'rgba(255, 69, 58, 0.4)' : 'rgba(255, 255, 255, 0.12)';
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ==========================================================================
// Keyboard Event Listeners & Shortcuts
// ==========================================================================
function setupKeyboardShortcuts() {
    // Spacebar down for panning
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === ' ' || e.code === 'Space') {
            if (!spacePressed) {
                spacePressed = true;
                if (interactState === 'idle') {
                    workspace.style.cursor = 'grab';
                }
            }
            // Prevent scrolling webpage
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.code === 'Space') {
            spacePressed = false;
            if (interactState === 'idle') {
                if (activeTool === 'select' || activeTool === 'crop') {
                    workspace.style.cursor = 'default';
                } else if (activeTool === 'eraser') {
                    workspace.style.cursor = 'cell';
                } else if (activeTool === 'text') {
                    workspace.style.cursor = 'text';
                } else {
                    workspace.style.cursor = 'crosshair';
                }
            }
        }
    });

    // Hotkey triggers
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        // Command / Ctrl key shortcuts
        const isCmd = e.metaKey || e.ctrlKey;

        if (isCmd && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            undo();
        } else if (isCmd && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
        } else if (isCmd && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            exportImage();
        } else if (isCmd && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            document.getElementById('file-input').click();
        } else if (isCmd && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            cropToSelection();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            deleteSelected();
        }

        // Tool Quick Keys (single key triggers)
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    setTool('select');
                    break;
                case 'r':
                    setTool('rect');
                    break;
                case 'c':
                    setTool('crop');
                    break;
                case 'o':
                    setTool('circle');
                    break;
                case 'a':
                    setTool('arrow');
                    break;
                case 'l':
                    setTool('line');
                    break;
                case 'p':
                    setTool('pen');
                    break;
                case 'e':
                    setTool('eraser');
                    break;
                case 't':
                    setTool('text');
                    break;
            }
        }

        // Selection nudges (Arrow keys)
        if (selectedId !== null) {
            const shiftVal = e.shiftKey ? 10 : 1;
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    nudgeSelected(0, -shiftVal);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    nudgeSelected(0, shiftVal);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    nudgeSelected(-shiftVal, 0);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nudgeSelected(shiftVal, 0);
                    break;
            }
        }
    });

    // Close Modals on click outside or escape
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }
    });
}
