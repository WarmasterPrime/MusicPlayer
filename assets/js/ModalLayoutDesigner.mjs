import { Modal } from "./Modal.mjs";
import { Api } from "./Api.mjs";
import { FeatureGate } from "./FeatureGate.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { UrlParams } from "./UrlParams.mjs";

/**
 * Manages the layout designer and layout loading system.
 */
export class ModalLayoutDesigner {

    static currentLayout = null;
    static activeComponents = [];
    static designerArea = null;
    static selectedComponent = null;
    static idSeq = 0;
    static designerResizeHandler = null;

    /** ID of the layout currently loaded from the URL ?layout= param, or null. */
    static sharedLayoutId = null;

    /**
     * Initializes the layout designer tab.
     */
    static async render() {
        // First, refresh feature gate to ensure we have latest tier info
        await FeatureGate.load();
        
        if (!FeatureGate.check("layout_designer")) {
            return `<div class='upgrade-prompt'>
                <div class='modal-form-title'>Creator Feature</div>
                <p>The Layout Designer is a premium feature for Creators. Upgrade your account to start designing custom layouts!</p>
                <button class='modal-form-btn' onclick="window.Modal.switchTab('store')">View Plans</button>
            </div>`;
        }

        let html = `
            <div class="layout-designer-tabs">
                <button class="opt-tab active" data-subtab="list">My Layouts</button>
                <button class="opt-tab" data-subtab="designer">Designer</button>
            </div>
            <div id="layout-subtab-content">
                ${await ModalLayoutDesigner.renderLayoutList()}
            </div>
        `;
        return html;
    }

    /**
     * Renders the list of saved layouts.
     */
    static async renderLayoutList() {
        try {
            let result = await Api.get("assets/php/layoutManager.php?action=list");
            let sharedId = ModalLayoutDesigner.sharedLayoutId;
            let html = `<div class="layout-list-container">`;

            // Shared layout banner
            if (sharedId) {
                let shareUrl = new URL(window.location);
                shareUrl.searchParams.set("layout", sharedId);
                html += `
                    <div class="shared-layout-banner">
                        <span>🔗 Viewing shared layout from URL</span>
                        <button class="modal-form-btn" id="unload-shared-layout" style="width:auto;font-size:12px;padding:4px 10px;">Unload</button>
                    </div>`;
            }

            html += `<button class="modal-form-btn" id="create-new-layout" style="margin-bottom: 15px;">+ Create New Layout</button>
                    <div class="layout-items">`;

            if (result.success && result.layouts && result.layouts.length > 0) {
                result.layouts.forEach(layout => {
                    let shareUrl = new URL(window.location);
                    shareUrl.searchParams.set("layout", layout.id);
                    // Strip other state params that aren't needed for sharing
                    html += `
                        <div class="layout-item ${layout.is_active ? 'active' : ''}" data-id="${layout.id}">
                            <div class="layout-info">
                                <span class="layout-name">${layout.name}</span>
                                <span class="layout-date">${new Date(layout.updated_at).toLocaleDateString()}</span>
                            </div>
                            <div class="layout-actions">
                                <button class="layout-action-btn edit" data-id="${layout.id}">Edit</button>
                                <button class="layout-action-btn delete" data-id="${layout.id}">Delete</button>
                                <button class="layout-action-btn share" data-id="${layout.id}" data-url="${shareUrl.href}" title="Copy shareable URL">🔗 Share</button>
                                ${layout.is_active ?
                                    `<button class="layout-action-btn unload" data-id="${layout.id}">Unload</button>` :
                                    `<button class="layout-action-btn load" data-id="${layout.id}">Load</button>`
                                }
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);">No layouts found. Create one to get started!</div>`;
            }

            html += `</div></div>`;
            return html;
        } catch (e) {
            return `<div class="modal-form-message error">Failed to load layouts.</div>`;
        }
    }

    /**
     * Renders the drag-and-drop designer interface.
     */
    static renderDesigner(layout = null) {
        ModalLayoutDesigner.currentLayout = layout;
        let html = `
            <div class="designer-main-container">
                <div class="designer-left-sidebar">
                    <div class="designer-section-title">Layers</div>
                    <div id="designer-layer-list" class="designer-layer-list"></div>
                    <div class="designer-section-title">Properties</div>
                    <div id="designer-properties-panel" class="designer-properties-panel">
                        <div style="text-align:center;color:rgba(255,255,255,0.3);padding:10px;">Select a component</div>
                    </div>
                </div>
                <div class="designer-center">
                    <div id="designer-canvas" class="designer-canvas">
                        <!-- Default layout items rendered here as placeholders -->
                    </div>
                    <div class="designer-controls">
                        <input type="text" id="layout-name-input" placeholder="Layout Name" value="${layout ? layout.name : ''}" />
                        <button class="modal-form-btn" id="save-layout-btn">Save Layout</button>
                    </div>
                </div>
                <div class="designer-right-sidebar">
                    <div class="designer-section-title">Components</div>
                    <div class="designer-component-list">
                        <div class="draggable-component" data-type="visualizer">Audio Visualizer</div>
                        <div class="draggable-component" data-type="song-display">Song / Artist</div>
                        <div class="draggable-component" data-type="album-name">Album Name</div>
                        <div class="draggable-component" data-type="progress-bar">Progress Bar</div>
                        <div class="draggable-component" data-type="lyrics">Lyrics</div>
                        <div class="draggable-component" data-type="source-url">Source URL</div>
                        <div class="draggable-component" data-type="publisher">Publisher</div>
                        <div class="draggable-component" data-type="composers">Composers</div>
                        <div class="draggable-component" data-type="custom-text">Custom Text</div>
                        <div class="draggable-component" data-type="custom-html">Custom HTML</div>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    /**
     * Attaches listeners for the layout designer tab.
     */
    static onMount() {
        let tabs = document.querySelectorAll(".layout-designer-tabs .opt-tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", async () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                let subtab = tab.getAttribute("data-subtab");
                let content = document.getElementById("layout-subtab-content");
                if (subtab === "list") {
                    content.innerHTML = await ModalLayoutDesigner.renderLayoutList();
                    ModalLayoutDesigner.attachListListeners();
                } else {
                    content.innerHTML = ModalLayoutDesigner.renderDesigner(ModalLayoutDesigner.currentLayout);
                    ModalLayoutDesigner.attachDesignerListeners();
                }
            });
        });

        ModalLayoutDesigner.attachListListeners();
    }

    static attachListListeners() {
        let createBtn = document.getElementById("create-new-layout");
        if (createBtn) {
            createBtn.addEventListener("click", () => {
                ModalLayoutDesigner.currentLayout = null;
                document.querySelector('[data-subtab="designer"]').click();
            });
        }

        // Unload shared layout button (shown in banner when viewing from URL)
        let unloadSharedBtn = document.getElementById("unload-shared-layout");
        if (unloadSharedBtn) {
            unloadSharedBtn.addEventListener("click", async () => {
                await ModalLayoutDesigner.unloadSharedLayout();
                let content = document.getElementById("layout-subtab-content");
                content.innerHTML = await ModalLayoutDesigner.renderLayoutList();
                ModalLayoutDesigner.attachListListeners();
            });
        }

        // Action buttons: load, unload, edit, delete, share
        document.querySelectorAll(".layout-action-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                let id = btn.getAttribute("data-id");
                if (btn.classList.contains("load")) {
                    await ModalLayoutDesigner.setActive(id, true);
                } else if (btn.classList.contains("unload")) {
                    await ModalLayoutDesigner.setActive(id, false);
                } else if (btn.classList.contains("edit")) {
                    // Only allow editing own layouts (not shared-from-URL layouts)
                    let result = await Api.get(`assets/php/layoutManager.php?action=get&id=${id}`);
                    if (result.success) {
                        ModalLayoutDesigner.currentLayout = result.layout;
                        document.querySelector('[data-subtab="designer"]').click();
                    }
                } else if (btn.classList.contains("delete")) {
                    if (confirm("Delete this layout?")) {
                        await Api.get(`assets/php/layoutManager.php?action=delete&id=${id}`);
                        let content = document.getElementById("layout-subtab-content");
                        content.innerHTML = await ModalLayoutDesigner.renderLayoutList();
                        ModalLayoutDesigner.attachListListeners();
                    }
                } else if (btn.classList.contains("share")) {
                    let shareUrl = btn.getAttribute("data-url");
                    if (shareUrl) {
                        try {
                            await navigator.clipboard.writeText(shareUrl);
                            Toast.success("Shareable link copied to clipboard!");
                        } catch (_) {
                            // Clipboard API may not be available in all contexts
                            prompt("Copy this link to share your layout:", shareUrl);
                        }
                    }
                }
            });
        });
    }

    static async setActive(id, active) {
        let result = await Api.get(`assets/php/layoutManager.php?action=set_active&id=${id}&active=${active ? 1 : 0}`);
        if (result.success) {
            Toast.success(active ? "Layout loaded!" : "Layout unloaded!");
            // Trigger actual page layout change
            ModalLayoutDesigner.applyActiveLayout();
            // Refresh list
            let content = document.getElementById("layout-subtab-content");
            content.innerHTML = await ModalLayoutDesigner.renderLayoutList();
            ModalLayoutDesigner.attachListListeners();
        }
    }

    static attachDesignerListeners() {
        // Drag and drop logic, property panel updates, etc.
        // (Implementation details for dragging components onto #designer-canvas)
        let canvas = document.getElementById("designer-canvas");
        let draggables = document.querySelectorAll(".draggable-component");

        ModalLayoutDesigner.updateDesignerCanvasSize();
        if (ModalLayoutDesigner.designerResizeHandler) {
            window.removeEventListener("resize", ModalLayoutDesigner.designerResizeHandler);
        }
        ModalLayoutDesigner.designerResizeHandler = function () {
            ModalLayoutDesigner.updateDesignerCanvasSize();
        };
        window.addEventListener("resize", ModalLayoutDesigner.designerResizeHandler);

        draggables.forEach(d => {
            d.draggable = true;
            d.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("type", d.getAttribute("data-type"));
            });
        });

        canvas.addEventListener("dragover", (e) => e.preventDefault());
        canvas.addEventListener("drop", (e) => {
            e.preventDefault();
            let type = e.dataTransfer.getData("type");
            let rect = canvas.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;
            ModalLayoutDesigner.addComponent(type, x, y);
        });

        let saveBtn = document.getElementById("save-layout-btn");
        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                let name = document.getElementById("layout-name-input").value || "Untitled Layout";
                let data = {
                    id: ModalLayoutDesigner.currentLayout ? ModalLayoutDesigner.currentLayout.id : null,
                    name: name,
                    layout_data: ModalLayoutDesigner.activeComponents
                };
                let result = await Api.send("assets/php/layoutManager.php?action=save", data);
                if (result.success) {
                    Toast.success("Layout saved!");
                    document.querySelector('[data-subtab="list"]').click();
                }
            });
        }
        
        // If editing, load components
        if (ModalLayoutDesigner.currentLayout) {
            try {
                let components = JSON.parse(ModalLayoutDesigner.currentLayout.layout_data);
                ModalLayoutDesigner.activeComponents = [];
                canvas.innerHTML = "";
                let migrated = ModalLayoutDesigner.migrateComponents(components);
                migrated.forEach(c => ModalLayoutDesigner.addComponent(c.type, c.x, c.y, c.props));
            } catch(e) {}
        } else {
            // Start with default components or empty
            ModalLayoutDesigner.activeComponents = [];
            canvas.innerHTML = "";
        }
    }

    static migrateComponents(components) {
        if (!Array.isArray(components)) return [];
        let comps = components.slice();

        let songName = comps.find(c => c && c.type === "song-name");
        let artistName = comps.find(c => c && c.type === "artist-name");
        if (songName || artistName) {
            let x = songName ? songName.x : artistName.x;
            let y = songName ? songName.y : artistName.y;
            let props = { ...(songName?.props || {}), ...(artistName?.props || {}) };
            if (!props.width) props.width = 40;
            if (!props.height) props.height = 6;
            comps = comps.filter(c => c && c.type !== "song-name" && c.type !== "artist-name");
            comps.push({ type: "song-display", x, y, props });
        }

        return comps;
    }

    static addComponent(type, x, y, props = {}) {
        let id = "comp-" + (Date.now()) + "-" + (++ModalLayoutDesigner.idSeq);
        let comp = { id, type, x, y, props: { ...ModalLayoutDesigner.getDefaultProps(type), ...props } };
        ModalLayoutDesigner.clampComponentToCanvas(comp);
        ModalLayoutDesigner.activeComponents.push(comp);
        ModalLayoutDesigner.renderComponentOnCanvas(comp);
        ModalLayoutDesigner.updateLayerList();
    }

    static getDefaultProps(type) {
        let base = { fontSize: "16px", color: "#ffffff", text: type.replace("-", " "), zIndex: ModalLayoutDesigner.activeComponents.length + 1 };
        if (type === "visualizer") return { ...base, width: 100, height: 90 };
        if (type === "progress-bar") return { ...base, width: 100, height: 2 };
        if (type === "song-display") return { ...base, width: 50, height: 8 };
        if (type === "custom-html") return { ...base, width: 40, height: 18 };
        if (type === "lyrics") return { ...base, fontSize: "18px", width: 60, height: 6, color: "#ffffff" };
        // textual components default box
        return { ...base, width: 40, height: 5 };
    }

    static clampComponentToCanvas(comp) {
        let w = parseFloat(comp.props?.width);
        let h = parseFloat(comp.props?.height);
        if (Number.isNaN(w) || w <= 0) w = 10;
        if (Number.isNaN(h) || h <= 0) h = 5;
        let halfW = w / 2;
        let halfH = h / 2;
        comp.x = Math.max(halfW, Math.min(100 - halfW, comp.x));
        comp.y = Math.max(halfH, Math.min(100 - halfH, comp.y));
    }

    static renderComponentOnCanvas(comp) {
        let canvas = document.getElementById("designer-canvas");
        let el = document.createElement("div");
        el.className = "designer-placed-component";
        el.id = comp.id;
        // Treat comp.x/comp.y as center point
        el.style.left = comp.x + "%";
        el.style.top = comp.y + "%";
        el.style.transform = "translate(-50%, -50%)";
        let isText = ModalLayoutDesigner.#textTypes.includes(comp.type);
        let wPct = comp.props.width || (isText ? 30 : 100);
        let hPct = comp.props.height || (isText ? 6 : 20);
        el.style.width = wPct + "%";
        el.style.height = hPct + "%";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.zIndex = comp.props.zIndex;
        el.innerText = comp.type;
        
        el.addEventListener("mousedown", (e) => {
            ModalLayoutDesigner.selectComponent(comp.id);
            
            // Drag within canvas logic
            let rect = canvas.getBoundingClientRect();
            let shiftX = e.clientX - el.getBoundingClientRect().left;
            let shiftY = e.clientY - el.getBoundingClientRect().top;

            function moveAt(pageX, pageY) {
                // Center-anchor: set center to cursor
                let xPx = pageX - rect.left;
                let yPx = pageY - rect.top;
                
                // Boundaries
                let halfW = el.offsetWidth / 2;
                let halfH = el.offsetHeight / 2;
                xPx = Math.max(halfW, Math.min(xPx, rect.width - halfW));
                yPx = Math.max(halfH, Math.min(yPx, rect.height - halfH));

                let xPct = (xPx / rect.width) * 100;
                let yPct = (yPx / rect.height) * 100;

                el.style.left = xPct + '%';
                el.style.top = yPct + '%';
                
                comp.x = xPct;
                comp.y = yPct;
                ModalLayoutDesigner.clampComponentToCanvas(comp);
                el.style.left = comp.x + '%';
                el.style.top = comp.y + '%';
                if (isText) ModalLayoutDesigner.resolveTextOverlap(el, comp);
                ModalLayoutDesigner.updatePropertiesPanel();
            }

            function onMouseMove(event) {
                moveAt(event.pageX, event.pageY);
            }

            document.addEventListener('mousemove', onMouseMove);

            document.onmouseup = function() {
                document.removeEventListener('mousemove', onMouseMove);
                document.onmouseup = null;
            };
        });
        
        el.ondragstart = function() { return false; };
        canvas.appendChild(el);
        if (isText) ModalLayoutDesigner.resolveTextOverlap(el, comp);
    }

    static selectComponent(id) {
        ModalLayoutDesigner.selectedComponent = ModalLayoutDesigner.activeComponents.find(c => c.id === id);
        document.querySelectorAll(".designer-placed-component").forEach(el => el.classList.remove("selected"));
        let el = document.getElementById(id);
        if (el) el.classList.add("selected");
        ModalLayoutDesigner.updateLayerList();
        ModalLayoutDesigner.updatePropertiesPanel();
    }

    static updateLayerList() {
        let list = document.getElementById("designer-layer-list");
        if (!list) return;
        list.innerHTML = ModalLayoutDesigner.activeComponents.map(c => `
            <div class="layer-item ${ModalLayoutDesigner.selectedComponent?.id === c.id ? 'active' : ''}" draggable="true" data-layer-id="${c.id}">
                <span class="layer-name">${c.type}</span>
                <button class="layer-delete" onclick="event.stopPropagation(); window.ModalLayoutDesigner.removeComponent('${c.id}')">&times;</button>
            </div>
        `).join("");
        // Attach selection and DnD ordering
        list.querySelectorAll(".layer-item").forEach(item => {
            item.addEventListener("click", function () {
                let id = this.getAttribute("data-layer-id");
                window.ModalLayoutDesigner.selectComponent(id);
            });
            item.addEventListener("dragstart", function (e) {
                e.dataTransfer.setData("layer-id", this.getAttribute("data-layer-id"));
            });
            item.addEventListener("dragover", function (e) { e.preventDefault(); });
            item.addEventListener("drop", function (e) {
                e.preventDefault();
                let fromId = e.dataTransfer.getData("layer-id");
                let toId = this.getAttribute("data-layer-id");
                if (!fromId || !toId || fromId === toId) return;
                let fromIdx = ModalLayoutDesigner.activeComponents.findIndex(x => x.id === fromId);
                let toIdx = ModalLayoutDesigner.activeComponents.findIndex(x => x.id === toId);
                if (fromIdx === -1 || toIdx === -1) return;
                let moved = ModalLayoutDesigner.activeComponents.splice(fromIdx, 1)[0];
                ModalLayoutDesigner.activeComponents.splice(toIdx, 0, moved);
                // Reassign z-index based on array order (last is top)
                for (let i = 0; i < ModalLayoutDesigner.activeComponents.length; i++) {
                    let c = ModalLayoutDesigner.activeComponents[i];
                    c.props.zIndex = i + 1;
                    let el = document.getElementById(c.id);
                    if (el) el.style.zIndex = c.props.zIndex;
                }
                ModalLayoutDesigner.updateLayerList();
            });
        });
    }

    static removeComponent(id) {
        ModalLayoutDesigner.activeComponents = ModalLayoutDesigner.activeComponents.filter(c => c.id !== id);
        let el = document.getElementById(id);
        if (el) el.remove();
        if (ModalLayoutDesigner.selectedComponent?.id === id) {
            ModalLayoutDesigner.selectedComponent = null;
            ModalLayoutDesigner.updatePropertiesPanel();
        }
        ModalLayoutDesigner.updateLayerList();
    }

    static updatePropertiesPanel() {
        let panel = document.getElementById("designer-properties-panel");
        if (!panel || !ModalLayoutDesigner.selectedComponent) return;
        
        let c = ModalLayoutDesigner.selectedComponent;
        let html = `
            <div class="prop-group">
                <label>X Position (%)</label>
                <input type="number" value="${c.x.toFixed(2)}" onchange="window.ModalLayoutDesigner.updateProp('x', this.value)" />
            </div>
            <div class="prop-group">
                <label>Y Position (%)</label>
                <input type="number" value="${c.y.toFixed(2)}" onchange="window.ModalLayoutDesigner.updateProp('y', this.value)" />
            </div>
            <div class="prop-group" style="display:flex;gap:5px;">
                <button class="layout-action-btn" onclick="window.ModalLayoutDesigner.centerComponent('h')">Center H</button>
                <button class="layout-action-btn" onclick="window.ModalLayoutDesigner.centerComponent('v')">Center V</button>
            </div>
        `;

        if (ModalLayoutDesigner.#textTypes.includes(c.type)) {
            html += `
                <div class="prop-group">
                    <label>Width (%)</label>
                    <input type="number" value="${c.props.width || 30}" onchange="window.ModalLayoutDesigner.updateProp('width', this.value, true)" />
                </div>
                <div class="prop-group">
                    <label>Height (%)</label>
                    <input type="number" value="${c.props.height || 6}" onchange="window.ModalLayoutDesigner.updateProp('height', this.value, true)" />
                </div>
            `;
            if (c.type === "custom-text" || c.type === "custom-html") {
                html += `
                    <div class="prop-group">
                        <label>Content</label>
                        <textarea oninput="window.ModalLayoutDesigner.updateProp('text', this.value, true)" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:5px;border-radius:4px;font-size:12px;">${c.props.text || ''}</textarea>
                    </div>
                `;
            }
        }

        if (c.type === "visualizer" || c.type === "progress-bar") {
            html += `
                <div class="prop-group">
                    <label>Width (%)</label>
                    <input type="number" value="${c.props.width || 100}" onchange="window.ModalLayoutDesigner.updateProp('width', this.value, true)" />
                </div>
                <div class="prop-group">
                    <label>Height (%)</label>
                    <input type="number" value="${c.props.height || 20}" onchange="window.ModalLayoutDesigner.updateProp('height', this.value, true)" />
                </div>
            `;
        }

        html += `
            <div class="prop-group">
                <label>Font Size</label>
                <input type="text" value="${c.props.fontSize}" onchange="window.ModalLayoutDesigner.updateProp('fontSize', this.value, true)" />
            </div>
            <div class="prop-group">
                <label>Color</label>
                <input type="color" value="${c.props.color}" onchange="window.ModalLayoutDesigner.updateProp('color', this.value, true)" />
            </div>
        `;

        panel.innerHTML = html;
    }

    static centerComponent(axis) {
        if (!ModalLayoutDesigner.selectedComponent) return;
        let c = ModalLayoutDesigner.selectedComponent;
        let el = document.getElementById(c.id);
        let canvas = document.getElementById("designer-canvas");
        if (!el || !canvas) return;

        if (axis === 'h') {
            c.x = 50;
            ModalLayoutDesigner.clampComponentToCanvas(c);
            el.style.left = c.x + "%";
        } else if (axis === 'v') {
            c.y = 50;
            ModalLayoutDesigner.clampComponentToCanvas(c);
            el.style.top = c.y + "%";
        }
        ModalLayoutDesigner.updatePropertiesPanel();
    }

    static updateProp(key, value, isNested = false) {
        if (!ModalLayoutDesigner.selectedComponent) return;
        let val = (key === 'x' || key === 'y' || key === 'width' || key === 'height') ? parseFloat(value) : value;
        
        if (isNested) {
            ModalLayoutDesigner.selectedComponent.props[key] = val;
        } else {
            ModalLayoutDesigner.selectedComponent[key] = val;
        }
        // Update visual
        let el = document.getElementById(ModalLayoutDesigner.selectedComponent.id);
        if (el) {
            if (key === 'x') el.style.left = val + "%";
            if (key === 'y') el.style.top = val + "%";
            if (key === 'width') el.style.width = val + "%";
            if (key === 'height') el.style.height = val + "%";
            if (key === 'fontSize') el.style.fontSize = val;
            if (key === 'color') el.style.color = val;
        }
        ModalLayoutDesigner.clampComponentToCanvas(ModalLayoutDesigner.selectedComponent);
        if (el) {
            el.style.left = ModalLayoutDesigner.selectedComponent.x + "%";
            el.style.top = ModalLayoutDesigner.selectedComponent.y + "%";
        }
    }

    static updateDesignerCanvasSize() {
        let canvas = document.getElementById("designer-canvas");
        if (!canvas) return;
        let center = canvas.closest(".designer-center");
        if (!center) return;
        let controls = center.querySelector(".designer-controls");

        let aspect = window.innerWidth / Math.max(1, window.innerHeight);
        let maxW = Math.max(200, center.clientWidth);
        let maxH = Math.max(200, center.clientHeight - (controls ? controls.offsetHeight : 0) - 10);

        let desiredW = maxW;
        let desiredH = desiredW / aspect;
        if (desiredH > maxH) {
            desiredH = maxH;
            desiredW = desiredH * aspect;
        }

        canvas.style.width = desiredW + "px";
        canvas.style.height = desiredH + "px";
    }

    static #textTypes = ["song-display","album-name","source-url","publisher","composers","custom-text","custom-html"];

    static resolveTextOverlap(el, comp) {
        let canvas = document.getElementById("designer-canvas");
        if (!canvas) return;
        if (!ModalLayoutDesigner.#textTypes.includes(comp.type)) return;
        // Only check against other text-based components
        let textIds = new Set(
            ModalLayoutDesigner.activeComponents
                .filter(c => c.id !== comp.id && ModalLayoutDesigner.#textTypes.includes(c.type))
                .map(c => c.id)
        );
        let others = Array.from(document.querySelectorAll(".designer-placed-component")).filter(e => textIds.has(e.id));
        let maxIter = 20;
        while (maxIter-- > 0) {
            let rect = el.getBoundingClientRect();
            let overlap = others.some(o => {
                let r2 = o.getBoundingClientRect();
                return !(rect.right < r2.left || rect.left > r2.right || rect.bottom < r2.top || rect.top > r2.bottom);
            });
            if (!overlap) break;
            comp.y = Math.min(100, comp.y + 2);
            el.style.top = comp.y + "%";
        }
    }

    /**
     * Checks the URL for a ?layout=<id> parameter on page load.
     * If present, fetches and applies that layout as a read-only shared view.
     * This runs BEFORE applyActiveLayout so the URL-shared layout takes priority.
     * @returns {boolean} True if a shared layout was loaded from the URL.
     */
    static async checkUrlLayout() {
        let params = UrlParams.GetParams();
        let layoutId = params["layout"];
        if (!layoutId) return false;

        try {
            let result = await Api.get(`assets/php/layoutManager.php?action=get&id=${encodeURIComponent(layoutId)}`);
            if (result.success && result.layout) {
                let components = JSON.parse(result.layout.layout_data);
                Visual.activeLayout = ModalLayoutDesigner.migrateComponents(components);
                ModalLayoutDesigner.hideDefaultElements(true);
                ModalLayoutDesigner.sharedLayoutId = layoutId;
                console.log("[Layout] Loaded shared layout from URL:", layoutId);
                return true;
            }
        } catch (e) {
            console.warn("[Layout] Failed to load shared layout from URL:", e);
        }
        return false;
    }

    /**
     * Unloads the currently URL-shared layout and restores the user's own active layout.
     * Removes the ?layout= URL parameter.
     */
    static async unloadSharedLayout() {
        ModalLayoutDesigner.sharedLayoutId = null;
        UrlParams.removeParam("layout");
        Visual.activeLayout = null;
        ModalLayoutDesigner.hideDefaultElements(false);
        // Re-apply the user's own active layout if any
        await ModalLayoutDesigner.applyActiveLayout();
        Toast.success("Shared layout unloaded.");
    }

    static async applyActiveLayout() {
        try {
            let result = await Api.get("assets/php/layoutManager.php?action=list");
            if (result.success && result.layouts) {
                let active = result.layouts.find(l => l.is_active);
                if (active) {
                    let layoutData = await Api.get(`assets/php/layoutManager.php?action=get&id=${active.id}`);
                    if (layoutData.success) {
                        let components = JSON.parse(layoutData.layout.layout_data);
                        Visual.activeLayout = ModalLayoutDesigner.migrateComponents(components);
                        ModalLayoutDesigner.hideDefaultElements(true);
                        return;
                    }
                }
            }
            // No active layout found
            Visual.activeLayout = null;
            ModalLayoutDesigner.hideDefaultElements(false);
        } catch (e) {
            console.error("Failed to apply active layout:", e);
        }
    }

    static hideDefaultElements(hide) {
        let elements = ["song-name", "caption", "url"];
        elements.forEach(id => {
            let el = document.getElementById(id);
            if (el) el.style.display = hide ? "none" : "";
        });
        // Sphere visibility is managed independently by its own toggle/URL param.
        // Only force-hide it when a custom layout is active.
        let obj = document.getElementById("obj");
        if (obj && hide) obj.style.display = "none";
        Visual.progressBarVisible = !hide;
    }
}

// Expose to window for inline handlers
window.ModalLayoutDesigner = ModalLayoutDesigner;
