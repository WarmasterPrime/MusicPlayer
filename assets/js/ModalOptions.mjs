import { Visual } from "./Visualizer.mjs";
import { Visualizer3D } from "./Visualizer3D.mjs";
import { UrlParams } from "./UrlParams.mjs";
import { ColorPicker } from "./ColorPicker.mjs";
import { ModalLayoutDesigner } from "./ModalLayoutDesigner.mjs";
import { MicLyrics } from "./MicLyrics.mjs";

/**
 * Options modal for the MusicPlayer visualizer.
 *
 * Replaces the inline options panel with a full modal containing four tabs:
 * Visual, Audio, Display, and Effects. All controls update live state,
 * persist to URL parameters, and can be serialized/restored via getState/setState.
 */
export class ModalOptions {

	// ---------------------------------------------------------------
	//  Private singleton state
	// ---------------------------------------------------------------

	/** @type {HTMLElement|null} */
	static #overlay = null;

	/** @type {boolean} */
	static #built = false;

	/** @type {string} */
	static #activeTab = "visual";

	/** @type {function|null} */
	static #bgStateCallback = null;

	/** @type {number|null} */
	static #playerTimerId = null;

	/** DOM element cache populated during #build(). */
	static #els = {};

	// ---------------------------------------------------------------
	//  Public API
	// ---------------------------------------------------------------

	/**
	 * Registers the external setNewBGState callback.
	 * @param {function(boolean): void} fn
	 */
	static setBGStateCallback(fn) {
		ModalOptions.#bgStateCallback = typeof fn === "function" ? fn : null;
	}

	/**
	 * Opens the options modal. Builds the DOM on first call.
	 */
	static open() {
		if (!ModalOptions.#built) ModalOptions.#build();
		ModalOptions.#syncAllControls();
		ModalOptions.#overlay.classList.add("open");
		ModalOptions.#startPlayerTick();
	}

	/**
	 * Closes the options modal and stops the player timer.
	 */
	static close() {
		if (!ModalOptions.#overlay) return;
		ModalOptions.#overlay.classList.remove("open");
		ModalOptions.#stopPlayerTick();
	}

	/**
	 * Applies URL parameters to the visual/system state.
	 * Call this once during initialization after Visual.ini().
	 * @param {object} params - Key-value object from UrlParams.GetParams().
	 */
	static updateFromUrl(params) {
		if (!params || typeof params !== "object") return;

		if (params["design"] !== undefined)
			Visual.currentDesign = params["design"];

		if (params["fillPolygon"] !== undefined)
			Visual.fillPolygon = params["fillPolygon"] !== "false";

		if (params["ghost"] !== undefined)
			Visual.ghost = params["ghost"] !== "false";

		if (params["audioAccuracy"] !== undefined) {
			let val = parseInt(params["audioAccuracy"], 10);
			if (val > 0) Visual.updateAudioAccuracy(val);
		}

		if (params["progressBar"] !== undefined)
			Visual.progressBarVisible = params["progressBar"] !== "false";

		if (params["lyrics"] !== undefined) {
			Visual.lyricsEnabled = params["lyrics"] !== "false";
			let caption = document.getElementById("caption");
			if (caption) caption.style.opacity = Visual.lyricsEnabled ? 1 : 0;
		}

		// Mic-lyrics: start listening automatically if the URL requests it.
		// We only kick this off on an explicit user nav (e.g. restoring a
		// deep link) because the browser requires a user gesture for the
		// mic permission prompt. If the prompt is blocked, start() returns
		// false silently and the UI reflects the off state.
		if (params["micLyrics"] === "true") {
			try {
				MicLyrics.start().then(function (ok) {
					if (!ok) {
						UrlParams.removeParam("micLyrics");
					}
				});
			} catch (e) {}
		}

		if (params["hideSongName"] !== undefined)
			document.getElementById("song-name").hidden = params["hideSongName"] !== "false";

		if (params["fade"] !== undefined) {
			let val = params["fade"] !== "false";
			Visual.color.fade = val;
		}

		if (params["newBg"] !== undefined) {
			let val = params["newBg"] !== "false";
			let mainBefore = document.getElementById("main-before");
			if (mainBefore) mainBefore.style.display = val ? "block" : "none";
		}

		if (params["sphere"] !== undefined) {
			let val = params["sphere"] !== "false";
			let objElm = document.getElementById("obj");
			if (objElm) objElm.style.display = val ? "block" : "none";
			if (ModalOptions.#bgStateCallback) ModalOptions.#bgStateCallback(val);
		}

		if (params["cbg"] !== undefined)
			Visual.cbg = params["cbg"] !== "false";

		if (params["hexColor"] !== undefined) {
			ModalOptions.#applyHexColor(params["hexColor"]);
		}

		if (params["polygonSides"] !== undefined) {
			let sides = parseInt(params["polygonSides"], 10);
			if (sides >= 2 && sides <= 10000) Visual.polygonSides = sides;
		}
	}

	/**
	 * Returns the current state of all options as a plain object.
	 * Suitable for JSON serialization (e.g. profile saving).
	 * @returns {object}
	 */
	static getState() {
		let audio = ModalOptions.#getAudioElement();
		return {
			design: Visual.currentDesign,
			polygonSides: Visual.polygonSides,
			color: {
				r: Visual.color.red,
				g: Visual.color.green,
				b: Visual.color.blue
			},
			fill: Visual.fillPolygon,
			ghost: Visual.ghost,
			audioAccuracy: Visual.audioAccuracy,
			playbackSpeed: audio ? audio.playbackRate : 1,
			loop: audio ? audio.loop : false,
			muted: audio ? audio.muted : false,
			songNameVisible: !document.getElementById("song-name")?.hidden,
			progressBar: Visual.progressBarVisible,
			lyrics: Visual.lyricsEnabled,
			theme: document.documentElement.getAttribute("data-theme") || "dark",
			fade: Visual.color.fade,
			newBg: ModalOptions.#isNewBgVisible(),
			sphere: ModalOptions.#isSphereVisible(),
			cbg: Visual.cbg,
			hexColor: ModalOptions.#rgbToHex(Visual.cbg_ovr.r, Visual.cbg_ovr.g, Visual.cbg_ovr.b)
		};
	}

	/**
	 * Restores state from a previously saved state object.
	 * @param {object} state - Object matching the shape returned by getState().
	 */
	static setState(state) {
		if (!state || typeof state !== "object") return;

		if (state.design !== undefined)
			Visual.currentDesign = state.design;

		if (state.polygonSides !== undefined)
			Visual.polygonSides = state.polygonSides;

		if (state.color) {
			if (state.color.r !== undefined) Visual.setR(state.color.r);
			if (state.color.g !== undefined) Visual.setG(state.color.g);
			if (state.color.b !== undefined) Visual.setB(state.color.b);
		}

		if (state.fill !== undefined)
			Visual.fillPolygon = state.fill;

		if (state.ghost !== undefined)
			Visual.ghost = state.ghost;

		if (state.audioAccuracy !== undefined)
			Visual.updateAudioAccuracy(state.audioAccuracy);

		let audio = ModalOptions.#getAudioElement();
		if (audio) {
			if (state.playbackSpeed !== undefined) audio.playbackRate = state.playbackSpeed;
			if (state.loop !== undefined) audio.loop = state.loop;
			if (state.muted !== undefined) audio.muted = state.muted;
		}

		if (state.songNameVisible !== undefined) {
			let sn = document.getElementById("song-name");
			if (sn) sn.hidden = !state.songNameVisible;
		}

		if (state.progressBar !== undefined)
			Visual.progressBarVisible = state.progressBar;

		if (state.lyrics !== undefined) {
			Visual.lyricsEnabled = state.lyrics;
			let caption = document.getElementById("caption");
			if (caption) caption.style.opacity = state.lyrics ? 1 : 0;
		}

		if (state.theme !== undefined) {
			document.documentElement.setAttribute("data-theme", state.theme);
			localStorage.setItem("mp-theme", state.theme);
		}

		if (state.fade !== undefined)
			Visual.color.fade = state.fade;

		if (state.newBg !== undefined) {
			let mainBefore = document.getElementById("main-before");
			if (mainBefore) mainBefore.style.display = state.newBg ? "block" : "none";
		}

		if (state.sphere !== undefined) {
			let objElm = document.getElementById("obj");
			if (objElm) objElm.style.display = state.sphere ? "block" : "none";
			if (ModalOptions.#bgStateCallback) ModalOptions.#bgStateCallback(state.sphere);
		}

		if (state.cbg !== undefined)
			Visual.cbg = state.cbg;

		if (state.hexColor !== undefined)
			ModalOptions.#applyHexColor(state.hexColor);

		if (ModalOptions.#built) ModalOptions.#syncAllControls();
	}

	// ---------------------------------------------------------------
	//  DOM Construction
	// ---------------------------------------------------------------

	/**
	 * Builds the entire modal DOM tree and appends it to the document body.
	 * Called once on first open.
	 */
	static #build() {
		// Overlay
		let overlay = document.createElement("div");
		overlay.id = "options-modal";
		overlay.className = "opt-overlay";
		overlay.addEventListener("click", function (e) {
			if (e.target === overlay) ModalOptions.close();
		});
		ModalOptions.#overlay = overlay;

		// Modal container
		let modal = document.createElement("div");
		modal.className = "opt-modal";
		overlay.appendChild(modal);

		// Close button
		let closeBtn = document.createElement("button");
		closeBtn.className = "opt-close";
		closeBtn.textContent = "X";
		closeBtn.addEventListener("click", function () { ModalOptions.close(); });
		modal.appendChild(closeBtn);

		// Title
		let title = document.createElement("div");
		title.className = "opt-title";
		title.textContent = "Options";
		modal.appendChild(title);

		// Tabs
		let tabDefs = [
			{ id: "visual", label: "Visual" },
			{ id: "audio", label: "Audio" },
			{ id: "display", label: "Display" },
			{ id: "effects", label: "Effects" },
			{ id: "layout", label: "Layout" }
		];

		let tabBar = document.createElement("div");
		tabBar.className = "opt-tabs";
		modal.appendChild(tabBar);

		for (let i = 0; i < tabDefs.length; i++) {
			let def = tabDefs[i];
			let btn = document.createElement("button");
			btn.className = "opt-tab" + (def.id === ModalOptions.#activeTab ? " active" : "");
			btn.setAttribute("data-tab", def.id);
			btn.textContent = def.label;
			btn.addEventListener("click", function () { ModalOptions.#switchTab(def.id); });
			tabBar.appendChild(btn);
		}

		// Panels
		let panelContainer = document.createElement("div");
		modal.appendChild(panelContainer);

		let panels = {
			visual: ModalOptions.#buildVisualPanel(),
			audio: ModalOptions.#buildAudioPanel(),
			display: ModalOptions.#buildDisplayPanel(),
			effects: ModalOptions.#buildEffectsPanel(),
			layout: ModalOptions.#buildLayoutPanel()
		};

		for (let key in panels) {
			let panel = panels[key];
			panel.className = "opt-panel" + (key === ModalOptions.#activeTab ? " active" : "");
			panel.setAttribute("data-panel", key);
			panelContainer.appendChild(panel);
		}

		document.body.appendChild(overlay);

		// Keyboard shortcut
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && ModalOptions.#overlay.classList.contains("open"))
				ModalOptions.close();
		});

		ModalOptions.#built = true;
	}

	// ---------------------------------------------------------------
	//  Tab switching
	// ---------------------------------------------------------------

	/**
	 * Switches the active tab.
	 * @param {string} tabId
	 */
	static #switchTab(tabId) {
		ModalOptions.#activeTab = tabId;

		// Update tab buttons
		let buttons = ModalOptions.#overlay.querySelectorAll(".opt-tab");
		for (let i = 0; i < buttons.length; i++) {
			if (buttons[i].getAttribute("data-tab") === tabId)
				buttons[i].classList.add("active");
			else
				buttons[i].classList.remove("active");
		}

		// Update panels
		let panels = ModalOptions.#overlay.querySelectorAll(".opt-panel");
		for (let i = 0; i < panels.length; i++) {
			let panelId = panels[i].getAttribute("data-panel");
			if (panelId === tabId) {
				panels[i].classList.add("active");
				// Trigger onMount-like logic for special tabs
				if (tabId === "layout") {
					ModalLayoutDesigner.render().then(html => {
						panels[i].innerHTML = html;
						ModalLayoutDesigner.onMount();
					});
				}
			} else {
				panels[i].classList.remove("active");
			}
		}

		// Toggle wider modal for layout tab
		if (tabId === "layout") {
			ModalOptions.#overlay.querySelector(".opt-modal").style.maxWidth = "1000px";
		} else {
			ModalOptions.#overlay.querySelector(".opt-modal").style.maxWidth = "540px";
		}

		// Start/stop player tick when switching to/from audio tab
		if (tabId === "audio")
			ModalOptions.#startPlayerTick();
		else
			ModalOptions.#stopPlayerTick();
	}

	// ---------------------------------------------------------------
	//  Visual panel
	// ---------------------------------------------------------------

	static #buildVisualPanel() {
		let panel = document.createElement("div");

		// Design section
		let designSection = ModalOptions.#createSection("Design");

		// Design grid (replaces dropdown)
		let designGrid = ModalOptions.#buildDesignGrid(Visual.currentDesign);
		ModalOptions.#els.designGrid = designGrid;
		designSection.appendChild(designGrid);

		// Polygon sides row (conditionally visible)
		let sidesRow = ModalOptions.#createRow("Sides");
		sidesRow.id = "opt-sides-row";
		sidesRow.style.display = Visual.currentDesign === "polygon" ? "" : "none";
		let sidesInput = document.createElement("input");
		sidesInput.type = "number";
		sidesInput.className = "opt-input";
		sidesInput.id = "opt-polygon-sides";
		sidesInput.min = "2";
		sidesInput.max = "10000";
		sidesInput.value = String(Visual.polygonSides);
		ModalOptions.#els.polygonSides = sidesInput;
		sidesRow.appendChild(sidesInput);
		designSection.appendChild(sidesRow);

		// Water speaker options (conditionally visible)
		let waterRow = ModalOptions.#createRow("Viscosity");
		waterRow.id = "opt-water-row";
		waterRow.style.display = Visual.currentDesign === "water" ? "" : "none";
		let viscSlider = document.createElement("input");
		viscSlider.type = "range";
		viscSlider.className = "opt-input";
		viscSlider.min = "0.80";
		viscSlider.max = "0.99";
		viscSlider.step = "0.01";
		viscSlider.value = String(Visual.waterViscosity);
		waterRow.appendChild(viscSlider);
		designSection.appendChild(waterRow);

		let tensionRow = ModalOptions.#createRow("Tension");
		tensionRow.id = "opt-tension-row";
		tensionRow.style.display = Visual.currentDesign === "water" ? "" : "none";
		let tensionSlider = document.createElement("input");
		tensionSlider.type = "range";
		tensionSlider.className = "opt-input";
		tensionSlider.min = "0.005";
		tensionSlider.max = "0.1";
		tensionSlider.step = "0.005";
		tensionSlider.value = String(Visual.waterTension);
		tensionRow.appendChild(tensionSlider);
		designSection.appendChild(tensionRow);

		let spreadRow = ModalOptions.#createRow("Spread");
		spreadRow.id = "opt-spread-row";
		spreadRow.style.display = Visual.currentDesign === "water" ? "" : "none";
		let spreadSlider = document.createElement("input");
		spreadSlider.type = "range";
		spreadSlider.className = "opt-input";
		spreadSlider.min = "0.05";
		spreadSlider.max = "0.5";
		spreadSlider.step = "0.01";
		spreadSlider.value = String(Visual.waterSpread);
		spreadSlider.appendChild;
		spreadRow.appendChild(spreadSlider);
		designSection.appendChild(spreadRow);

		viscSlider.addEventListener("input", function () { Visual.waterViscosity = parseFloat(viscSlider.value); });
		tensionSlider.addEventListener("input", function () { Visual.waterTension = parseFloat(tensionSlider.value); });
		spreadSlider.addEventListener("input", function () { Visual.waterSpread = parseFloat(spreadSlider.value); });

		// Liquid sphere options (conditionally visible)
		let isLiquid = Visual.currentDesign === "liquidsphere";

		let liqViscRow = ModalOptions.#createRow("Viscosity");
		liqViscRow.id = "opt-liq-visc-row";
		liqViscRow.style.display = isLiquid ? "" : "none";
		let liqViscSlider = document.createElement("input");
		liqViscSlider.type = "range"; liqViscSlider.className = "opt-input";
		liqViscSlider.min = "0.1"; liqViscSlider.max = "1.0"; liqViscSlider.step = "0.05";
		liqViscSlider.value = String(Visualizer3D.liquidViscosity);
		liqViscSlider.title = "0.1 = watery/fast   1.0 = thick/slow";
		liqViscSlider.addEventListener("input", function () { Visualizer3D.liquidViscosity = parseFloat(this.value); });
		ModalOptions.#els.liqVisc = liqViscSlider;
		liqViscRow.appendChild(liqViscSlider);
		designSection.appendChild(liqViscRow);

		let liqDensRow = ModalOptions.#createRow("Density");
		liqDensRow.id = "opt-liq-dens-row";
		liqDensRow.style.display = isLiquid ? "" : "none";
		let liqDensSlider = document.createElement("input");
		liqDensSlider.type = "range"; liqDensSlider.className = "opt-input";
		liqDensSlider.min = "0.1"; liqDensSlider.max = "1.0"; liqDensSlider.step = "0.05";
		liqDensSlider.value = String(Visualizer3D.liquidDensity);
		liqDensSlider.title = "0.1 = subtle   1.0 = dramatic";
		liqDensSlider.addEventListener("input", function () { Visualizer3D.liquidDensity = parseFloat(this.value); });
		ModalOptions.#els.liqDens = liqDensSlider;
		liqDensRow.appendChild(liqDensSlider);
		designSection.appendChild(liqDensRow);

		// Lyric Particles: count slider (conditionally visible).
		// Users can trade density for performance. Changes are applied live
		// via Visualizer3D.rebuildLyricParticles() and persisted to the URL.
		let isLyric = Visual.currentDesign === "lyricparticles";
		let lyricCountRow = ModalOptions.#createRow("Particle Count");
		lyricCountRow.id = "opt-lyric-count-row";
		lyricCountRow.style.display = isLyric ? "" : "none";
		let lyricCountInput = document.createElement("input");
		lyricCountInput.type = "number";
		lyricCountInput.className = "opt-input";
		lyricCountInput.min = "500";
		lyricCountInput.max = "30000";
		lyricCountInput.step = "500";
		lyricCountInput.value = String(Visualizer3D.lyricParticleCount);
		lyricCountInput.title = "Number of points used to form the lyric text (500–30000)";
		// Rebuild only on commit (blur / Enter) so typing doesn't thrash the
		// geometry after every keystroke.
		lyricCountInput.addEventListener("change", function () {
			let v = parseInt(this.value, 10);
			if (isNaN(v)) return;
			if (v < 500) v = 500;
			if (v > 30000) v = 30000;
			this.value = String(v);
			Visualizer3D.lyricParticleCount = v;
			try { UrlParams.SetParam("lyricCount", String(v)); } catch (e) {}
			if (Visual.currentDesign === "lyricparticles" &&
				typeof Visualizer3D.rebuildLyricParticles === "function") {
				Visualizer3D.rebuildLyricParticles();
			}
		});
		ModalOptions.#els.lyricCount = lyricCountInput;
		lyricCountRow.appendChild(lyricCountInput);
		designSection.appendChild(lyricCountRow);

		// Lyric Particles: text curvature slider. 0 = flat plane, 1 = wraps
		// around a near half-cylinder so the ends bend toward the viewer —
		// readability trick for off-axis viewing. Retarget in flight so the
		// live particles flow onto the newly-shaped letters.
		let lyricCurveRow = ModalOptions.#createRow("Text Curvature");
		lyricCurveRow.id = "opt-lyric-curve-row";
		lyricCurveRow.style.display = isLyric ? "" : "none";
		let lyricCurveSlider = document.createElement("input");
		lyricCurveSlider.type = "range";
		lyricCurveSlider.className = "opt-range";
		lyricCurveSlider.min = "0";
		lyricCurveSlider.max = "100";
		lyricCurveSlider.step = "1";
		lyricCurveSlider.value = String(Math.round((Number(Visualizer3D.lyricTextCurvature) || 0) * 100));
		lyricCurveSlider.title = "Wrap the text around a cylinder (0 = flat, 100 = half-cylinder)";
		lyricCurveSlider.addEventListener("input", function () {
			let v = parseInt(this.value, 10);
			if (isNaN(v)) v = 0;
			v = Math.max(0, Math.min(100, v));
			Visualizer3D.lyricTextCurvature = v / 100;
			try { UrlParams.SetParam("lyricCurve", String(v)); } catch (e) {}
			if (Visual.currentDesign === "lyricparticles" &&
				typeof Visualizer3D.retargetLyricParticles === "function") {
				Visualizer3D.retargetLyricParticles();
			}
		});
		ModalOptions.#els.lyricCurve = lyricCurveSlider;
		lyricCurveRow.appendChild(lyricCurveSlider);
		designSection.appendChild(lyricCurveRow);

		// Record Player: customizable plate text. Only visible when the
		// Record Player design is active. Persists to the URL as ?recordText=
		// so layouts / shares restore the same label. Repaints live as the
		// user types — the plaque texture rebinds on each keystroke.
		let isRecord = Visual.currentDesign === "recordplayer";
		let recordTextRow = ModalOptions.#createRow("Plate Text");
		recordTextRow.id = "opt-record-text-row";
		recordTextRow.style.display = isRecord ? "" : "none";
		let recordTextInput = document.createElement("input");
		recordTextInput.type = "text";
		recordTextInput.className = "opt-input";
		recordTextInput.maxLength = 40;
		recordTextInput.value = Visualizer3D.recordPlateText || "Virtma";
		recordTextInput.title = "Text displayed on the record player's front plaque";
		recordTextInput.addEventListener("input", function () {
			let v = String(this.value || "");
			Visualizer3D.recordPlateText = v;
			try { UrlParams.SetParam("recordText", v); } catch (e) {}
			if (Visual.currentDesign === "recordplayer" &&
				typeof Visualizer3D.rebuildRecordPlate === "function") {
				Visualizer3D.rebuildRecordPlate();
			}
		});
		ModalOptions.#els.recordText = recordTextInput;
		recordTextRow.appendChild(recordTextInput);
		designSection.appendChild(recordTextRow);

		// 3D design options (conditionally visible)
		let is3D = Visualizer3D.is3D(Visual.currentDesign);

		// Camera Motion lives in the slot that used to host "Auto-Rotate".
		// The dropdown covers Static (manual only), Slow Orbit (smooth
		// auto-rotate), Spiral, Fly-By, and Audio-Zoom.
		let camModeTopRow = ModalOptions.#createRow("Camera Motion");
		camModeTopRow.id = "opt-3d-cammode-row";
		camModeTopRow.style.display = is3D ? "" : "none";
		let camModeTopSelect = ModalOptions.#createSelect("opt-3d-cam-mode-top", [
			{ value: "static",      label: "Static (Manual)" },
			{ value: "orbit",       label: "Slow Orbit" },
			{ value: "spiral",      label: "Spiral" },
			{ value: "fly",         label: "Fly-By" },
			{ value: "codesandbox", label: "Audio-Zoom" }
		], Visualizer3D.cameraMode || "static");
		ModalOptions.#els.cameraMode = camModeTopSelect;
		camModeTopSelect.addEventListener("change", function () {
			Visualizer3D.cameraMode = this.value;
			// Keep auto-rotate compat flag in sync: any non-"static" motion
			// implies auto-rotation (used by designs that still look at
			// Visualizer3D.autoRotate).
			Visualizer3D.autoRotate = (this.value !== "static");
			try { UrlParams.SetParam("camMode", this.value); } catch (e) {}
		});
		camModeTopRow.appendChild(camModeTopSelect);
		designSection.appendChild(camModeTopRow);

		let orbitRow = ModalOptions.#createRow("Mouse Orbit");
		orbitRow.id = "opt-3d-orbit-row";
		orbitRow.style.display = is3D ? "" : "none";
		let orbitToggle = ModalOptions.#createToggle("opt-3d-orbit", Visualizer3D.orbitEnabled, function (checked) {
			Visualizer3D.orbitEnabled = checked;
		});
		ModalOptions.#els.orbitEnabled = orbitToggle.querySelector("input");
		orbitRow.appendChild(orbitToggle);
		designSection.appendChild(orbitRow);

		// ── 3D Lighting section (conditionally visible) ──────────────────
		let lightingSection = ModalOptions.#createSection("3D Lighting");
		lightingSection.id = "opt-3d-lighting-section";
		lightingSection.style.display = is3D ? "" : "none";

		// Lighting on/off
		let lightEnabledRow = ModalOptions.#createRow("Lighting");
		let lightEnabledToggle = ModalOptions.#createToggle("opt-3d-light-enabled", Visualizer3D.lightingEnabled, function (checked) {
			Visualizer3D.lightingEnabled = checked;
			Visualizer3D.updateLighting();
		});
		ModalOptions.#els.lightEnabled = lightEnabledToggle.querySelector("input");
		lightEnabledRow.appendChild(lightEnabledToggle);
		lightingSection.appendChild(lightEnabledRow);

		// Ambient color + intensity
		let ambientRow = ModalOptions.#createRow("Ambient");
		let ambColorInput = document.createElement("input");
		ambColorInput.type = "color";
		ambColorInput.className = "opt-color-input";
		ambColorInput.title = "Ambient light color";
		ambColorInput.value = Visualizer3D.ambientColor;
		ambColorInput.style.cssText = "width:36px;height:28px;padding:2px;border:none;cursor:pointer;flex-shrink:0;";
		ambColorInput.addEventListener("input", function () {
			Visualizer3D.ambientColor = this.value;
			Visualizer3D.updateLighting();
		});
		ModalOptions.#els.ambColor = ambColorInput;
		let ambIntSlider = document.createElement("input");
		ambIntSlider.type = "range";
		ambIntSlider.className = "opt-input";
		ambIntSlider.min = "0";
		ambIntSlider.max = "2";
		ambIntSlider.step = "0.05";
		ambIntSlider.value = String(Visualizer3D.ambientIntensity);
		ambIntSlider.addEventListener("input", function () {
			Visualizer3D.ambientIntensity = parseFloat(this.value);
			Visualizer3D.updateLighting();
		});
		ModalOptions.#els.ambIntensity = ambIntSlider;
		ambientRow.appendChild(ambColorInput);
		ambientRow.appendChild(ambIntSlider);
		lightingSection.appendChild(ambientRow);

		// Directional color + intensity
		let directionalRow = ModalOptions.#createRow("Directional");
		let dirColorInput = document.createElement("input");
		dirColorInput.type = "color";
		dirColorInput.className = "opt-color-input";
		dirColorInput.title = "Directional light color";
		dirColorInput.value = Visualizer3D.directionalColor;
		dirColorInput.style.cssText = "width:36px;height:28px;padding:2px;border:none;cursor:pointer;flex-shrink:0;";
		dirColorInput.addEventListener("input", function () {
			Visualizer3D.directionalColor = this.value;
			Visualizer3D.updateLighting();
		});
		ModalOptions.#els.dirColor = dirColorInput;
		let dirIntSlider = document.createElement("input");
		dirIntSlider.type = "range";
		dirIntSlider.className = "opt-input";
		dirIntSlider.min = "0";
		dirIntSlider.max = "3";
		dirIntSlider.step = "0.05";
		dirIntSlider.value = String(Visualizer3D.directionalIntensity);
		dirIntSlider.addEventListener("input", function () {
			Visualizer3D.directionalIntensity = parseFloat(this.value);
			Visualizer3D.updateLighting();
		});
		ModalOptions.#els.dirIntensity = dirIntSlider;
		directionalRow.appendChild(dirColorInput);
		directionalRow.appendChild(dirIntSlider);
		lightingSection.appendChild(directionalRow);

		// Light position X / Y / Z
		let makeLightPosRow = function (label, elsKey, getter, setter) {
			let row = ModalOptions.#createRow(label);
			let slider = document.createElement("input");
			slider.type = "range";
			slider.className = "opt-input";
			slider.min = "-20";
			slider.max = "20";
			slider.step = "0.5";
			slider.value = String(getter());
			slider.addEventListener("input", function () {
				setter(parseFloat(this.value));
				Visualizer3D.updateLighting();
			});
			ModalOptions.#els[elsKey] = slider;
			row.appendChild(slider);
			return row;
		};
		lightingSection.appendChild(makeLightPosRow("Light X", "dirLightX",
			function () { return Visualizer3D.directionalX; },
			function (v) { Visualizer3D.directionalX = v; }));
		lightingSection.appendChild(makeLightPosRow("Light Y", "dirLightY",
			function () { return Visualizer3D.directionalY; },
			function (v) { Visualizer3D.directionalY = v; }));
		lightingSection.appendChild(makeLightPosRow("Light Z", "dirLightZ",
			function () { return Visualizer3D.directionalZ; },
			function (v) { Visualizer3D.directionalZ = v; }));

		// Material mode
		let matModeRow = ModalOptions.#createRow("Material");
		let matModeSelect = ModalOptions.#createSelect("opt-3d-mat-mode", [
			{ value: "solid", label: "Solid" },
			{ value: "wireframe", label: "Wireframe" },
			{ value: "translucent", label: "Translucent" }
		], Visualizer3D.materialMode);
		ModalOptions.#els.materialMode = matModeSelect;
		matModeSelect.addEventListener("change", function () {
			Visualizer3D.setMaterialMode(this.value);
			try { UrlParams.SetParam("matMode", this.value); } catch (e) {}
		});
		matModeRow.appendChild(matModeSelect);
		lightingSection.appendChild(matModeRow);

		// Camera Motion now lives at the top of the Design section (above).

		// Gelatin shape option (only relevant when design = gelatinshape)
		let gelatinRow = ModalOptions.#createRow("Gelatin Shape");
		gelatinRow.id = "opt-3d-gelatin-row";
		let gelatinSelect = ModalOptions.#createSelect("opt-3d-gelatin-shape", [
			{ value: "sphere",  label: "Sphere" },
			{ value: "cube",    label: "Cube" },
			{ value: "pyramid", label: "Pyramid" }
		], Visualizer3D.gelatinShape || "sphere");
		ModalOptions.#els.gelatinShape = gelatinSelect;
		gelatinSelect.addEventListener("change", function () {
			Visualizer3D.gelatinShape = this.value;
			try { UrlParams.SetParam("gelatinShape", this.value); } catch (e) {}
			// If currently showing gelatin, rebuild the geometry live.
			if (Visual.currentDesign === "gelatinshape" && typeof Visualizer3D.rebuildGelatin === "function") {
				Visualizer3D.rebuildGelatin();
			}
		});
		gelatinRow.appendChild(gelatinSelect);
		lightingSection.appendChild(gelatinRow);

		// Design change is handled by click listeners in #buildDesignGrid().

		// Polygon sides handler
		sidesInput.addEventListener("change", function () {
			let v = parseInt(sidesInput.value, 10);
			if (isNaN(v) || v < 2) v = 2;
			if (v > 10000) v = 10000;
			sidesInput.value = String(v);
			Visual.polygonSides = v;
			UrlParams.SetParam("polygonSides", String(v));
		});

		panel.appendChild(designSection);
		panel.appendChild(lightingSection);

		// Color section
		let colorSection = ModalOptions.#createSection("Color");

		let colorRow = ModalOptions.#createRow("Visualizer Color");
		let swatch = document.createElement("div");
		swatch.className = "opt-color-swatch";
		swatch.id = "opt-color-swatch";
		swatch.style.backgroundColor = "rgb(" + Visual.color.red + "," + Visual.color.green + "," + Visual.color.blue + ")";
		swatch.title = "Click to choose color";
		swatch.addEventListener("click", function () {
			ColorPicker.open(
				{ r: Visual.color.red, g: Visual.color.green, b: Visual.color.blue },
				function (c) {
					Visual.setR(c.r);
					Visual.setG(c.g);
					Visual.setB(c.b);
					swatch.style.backgroundColor = "rgb(" + c.r + "," + c.g + "," + c.b + ")";
					UrlParams.SetParam("r", String(c.r));
					UrlParams.SetParam("g", String(c.g));
					UrlParams.SetParam("b", String(c.b));
				},
				null
			);
		});
		ModalOptions.#els.colorSwatch = swatch;
		colorRow.appendChild(swatch);
		colorSection.appendChild(colorRow);
		panel.appendChild(colorSection);

		// Toggles section
		let toggleSection = ModalOptions.#createSection("Rendering");

		// Fill toggle
		let fillRow = ModalOptions.#createRow("Fill");
		let fillToggle = ModalOptions.#createToggle("opt-fill", Visual.fillPolygon, function (checked) {
			Visual.fillPolygon = checked;
			UrlParams.SetParam("fillPolygon", String(checked));
		});
		ModalOptions.#els.fill = fillToggle.querySelector("input");
		fillRow.appendChild(fillToggle);
		toggleSection.appendChild(fillRow);

		// Ghost toggle
		let ghostRow = ModalOptions.#createRow("Ghost");
		let ghostToggle = ModalOptions.#createToggle("opt-ghost", Visual.ghost, function (checked) {
			Visual.ghost = checked;
			UrlParams.SetParam("ghost", String(checked));
		});
		ModalOptions.#els.ghost = ghostToggle.querySelector("input");
		ghostRow.appendChild(ghostToggle);
		toggleSection.appendChild(ghostRow);

		panel.appendChild(toggleSection);
		return panel;
	}

	// ---------------------------------------------------------------
	//  Audio panel
	// ---------------------------------------------------------------

	static #buildAudioPanel() {
		let panel = document.createElement("div");

		// Custom player section
		let playerSection = ModalOptions.#createSection("Player");
		let playerBar = ModalOptions.#buildPlayerBar();
		playerSection.appendChild(playerBar);
		panel.appendChild(playerSection);

		// Frequency section
		let freqSection = ModalOptions.#createSection("Analysis");
		let freqRow = ModalOptions.#createRow("Frequency Count");
		let fftValues = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
		let fftOptions = [];
		for (let i = 0; i < fftValues.length; i++) {
			fftOptions.push({ value: String(fftValues[i]), label: String(fftValues[i]) });
		}
		let fftSelect = ModalOptions.#createSelect("opt-fft", fftOptions, String(Visual.audioAccuracy));
		ModalOptions.#els.fft = fftSelect;
		fftSelect.addEventListener("change", function () {
			Visual.updateAudioAccuracy(parseInt(fftSelect.value, 10));
			UrlParams.SetParam("audioAccuracy", fftSelect.value);
		});
		freqRow.appendChild(fftSelect);
		freqSection.appendChild(freqRow);
		panel.appendChild(freqSection);

		// Playback section
		let playbackSection = ModalOptions.#createSection("Playback");

		// Shuffle toggle
		let shuffleRow = ModalOptions.#createRow("Shuffle");
		let shuffleElm = document.getElementById("shuffle-opt");
		let shuffleToggle = ModalOptions.#createToggle("opt-shuffle", shuffleElm ? shuffleElm.checked : false, function (checked) {
			let audioElm = document.getElementById("player");
			let inlineShuffle = document.getElementById("shuffle-opt");
			if (inlineShuffle) inlineShuffle.checked = checked;
			if (checked) {
				if (audioElm) audioElm.loop = false;
				UrlParams.SetParam("shuffle", "true");
				if (audioElm && audioElm.paused && window.AudioLibrary)
					window.AudioLibrary.selectSong(true);
			} else {
				if (audioElm) audioElm.loop = true;
				UrlParams.removeParam("shuffle");
			}
		});
		ModalOptions.#els.shuffle = shuffleToggle.querySelector("input");
		shuffleRow.appendChild(shuffleToggle);
		playbackSection.appendChild(shuffleRow);

		// File upload
		let uploadRow = ModalOptions.#createRow("Upload File");
		let uploadInput = document.createElement("input");
		uploadInput.type = "file";
		uploadInput.className = "opt-input";
		uploadInput.id = "opt-file-upload";
		uploadInput.accept = "audio/*";
		uploadInput.addEventListener("input", function () {
			let inlineUpload = document.getElementById("file-upload");
			if (window.player) window.player.uploadSong(uploadInput);
		});
		ModalOptions.#els.fileUpload = uploadInput;
		uploadRow.appendChild(uploadInput);
		playbackSection.appendChild(uploadRow);

		// Microphone input toggle. When enabled the visualiser pulls from
		// the user's microphone instead of the media element (no feedback
		// because we don't route the stream to the destination).
		let micRow = ModalOptions.#createRow("Microphone");
		let micToggle = ModalOptions.#createToggle("opt-mic", Visual.isMicActive(), function (checked) {
			let input = document.getElementById("opt-mic");
			if (checked) {
				Visual.enableMicrophone().then(function (ok) {
					if (!ok && input) input.checked = false;
				});
			} else {
				Visual.disableMicrophone();
			}
		});
		ModalOptions.#els.mic = micToggle.querySelector("input");
		micRow.appendChild(micToggle);
		playbackSection.appendChild(micRow);

		panel.appendChild(playbackSection);

		// About / Source section with the project's GitHub repository.
		let aboutSection = ModalOptions.#createSection("About");
		let repoRow = ModalOptions.#createRow("Source");
		let repoLink = document.createElement("a");
		repoLink.href = "https://github.com/WarmasterPrime/MusicPlayer/";
		repoLink.target = "_blank";
		repoLink.rel = "noopener noreferrer";
		repoLink.textContent = "github.com/WarmasterPrime/MusicPlayer";
		repoLink.style.cssText =
			"color:#4af;" +
			"text-decoration:none;" +
			"font-size:12px;" +
			"display:inline-flex;" +
			"align-items:center;" +
			"gap:6px;" +
			"padding:4px 0;";
		// Add a small GitHub-style icon
		let repoIcon = document.createElement("span");
		repoIcon.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
			'<path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1-.02-1.97-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.44-2.28 1.17-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.97 10.97 0 012.87-.39c.97.01 1.95.13 2.87.39 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.12 3.04.73.8 1.17 1.83 1.17 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0023.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>';
		repoIcon.style.cssText = "line-height:0;display:inline-flex;";
		repoLink.prepend(repoIcon);
		repoRow.appendChild(repoLink);
		aboutSection.appendChild(repoRow);
		panel.appendChild(aboutSection);

		return panel;
	}

	/**
	 * Builds the custom audio player transport bar.
	 * @returns {HTMLElement}
	 */
	static #buildPlayerBar() {
		let bar = document.createElement("div");
		bar.className = "opt-player";

		// Play / Pause
		let playBtn = document.createElement("button");
		playBtn.className = "opt-player-btn";
		playBtn.id = "opt-play-btn";
		playBtn.title = "Play / Pause";
		let playIcon = document.createElement("div");
		playIcon.className = "opt-icon-play";
		playIcon.id = "opt-play-icon";
		playBtn.appendChild(playIcon);
		playBtn.addEventListener("click", function () {
			let audio = ModalOptions.#getAudioElement();
			if (!audio) return;
			if (audio.paused) audio.play(); else audio.pause();
		});
		bar.appendChild(playBtn);

		// Progress bar
		let progressWrap = document.createElement("div");
		progressWrap.className = "opt-player-progress";
		progressWrap.id = "opt-progress-wrap";
		let progressFill = document.createElement("div");
		progressFill.className = "opt-player-progress-fill";
		progressFill.id = "opt-progress-fill";
		progressWrap.appendChild(progressFill);
		progressWrap.addEventListener("click", function (e) {
			let audio = ModalOptions.#getAudioElement();
			if (!audio || !isFinite(audio.duration)) return;
			let rect = progressWrap.getBoundingClientRect();
			let pct = (e.clientX - rect.left) / rect.width;
			pct = Math.max(0, Math.min(1, pct));
			audio.currentTime = pct * audio.duration;
		});
		bar.appendChild(progressWrap);

		// Time display
		let timeDisplay = document.createElement("span");
		timeDisplay.className = "opt-player-time";
		timeDisplay.id = "opt-time";
		timeDisplay.textContent = "0:00 / 0:00";
		bar.appendChild(timeDisplay);

		// Loop button
		let loopBtn = document.createElement("button");
		loopBtn.className = "opt-player-btn";
		loopBtn.id = "opt-loop-btn";
		loopBtn.title = "Loop";
		loopBtn.innerHTML = "&#8635;";
		let audio = ModalOptions.#getAudioElement();
		if (audio && audio.loop) loopBtn.classList.add("active");
		loopBtn.addEventListener("click", function () {
			let a = ModalOptions.#getAudioElement();
			if (!a) return;
			a.loop = !a.loop;
			loopBtn.classList.toggle("active", a.loop);
		});
		bar.appendChild(loopBtn);

		// Mute button
		let muteBtn = document.createElement("button");
		muteBtn.className = "opt-player-btn";
		muteBtn.id = "opt-mute-btn";
		muteBtn.title = "Mute";
		muteBtn.innerHTML = "&#128264;";
		if (audio && audio.muted) muteBtn.classList.add("active");
		muteBtn.addEventListener("click", function () {
			let a = ModalOptions.#getAudioElement();
			if (!a) return;
			a.muted = !a.muted;
			muteBtn.classList.toggle("active", a.muted);
			muteBtn.innerHTML = a.muted ? "&#128263;" : "&#128264;";
		});
		bar.appendChild(muteBtn);

		// Playback speed
		let speedSelect = document.createElement("select");
		speedSelect.className = "opt-player-speed";
		speedSelect.id = "opt-speed";
		speedSelect.title = "Playback speed";
		let speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
		for (let i = 0; i < speeds.length; i++) {
			let opt = document.createElement("option");
			opt.value = String(speeds[i]);
			opt.textContent = speeds[i] + "x";
			if (speeds[i] === 1) opt.selected = true;
			speedSelect.appendChild(opt);
		}
		if (audio) speedSelect.value = String(audio.playbackRate);
		speedSelect.addEventListener("change", function () {
			let a = ModalOptions.#getAudioElement();
			if (a) a.playbackRate = parseFloat(speedSelect.value);
		});
		bar.appendChild(speedSelect);

		// Store references
		ModalOptions.#els.playBtn = playBtn;
		ModalOptions.#els.playIcon = playIcon;
		ModalOptions.#els.progressFill = progressFill;
		ModalOptions.#els.progressWrap = progressWrap;
		ModalOptions.#els.timeDisplay = timeDisplay;
		ModalOptions.#els.loopBtn = loopBtn;
		ModalOptions.#els.muteBtn = muteBtn;
		ModalOptions.#els.speedSelect = speedSelect;

		return bar;
	}

	// ---------------------------------------------------------------
	//  Display panel
	// ---------------------------------------------------------------

	static #buildDisplayPanel() {
		let panel = document.createElement("div");
		let section = ModalOptions.#createSection("Display");

		// Song Name toggle
		let snRow = ModalOptions.#createRow("Song Name");
		let snVisible = !document.getElementById("song-name")?.hidden;
		let snToggle = ModalOptions.#createToggle("opt-song-name", snVisible, function (checked) {
			let elm = document.getElementById("song-name");
			if (elm) elm.hidden = !checked;
			UrlParams.SetParam("hideSongName", String(!checked));
		});
		ModalOptions.#els.songName = snToggle.querySelector("input");
		snRow.appendChild(snToggle);
		section.appendChild(snRow);

		// Progress Bar toggle
		let barRow = ModalOptions.#createRow("Progress Bar");
		let barToggle = ModalOptions.#createToggle("opt-progress-bar", Visual.progressBarVisible, function (checked) {
			Visual.progressBarVisible = checked;
			UrlParams.SetParam("progressBar", String(checked));
		});
		ModalOptions.#els.progressBar = barToggle.querySelector("input");
		barRow.appendChild(barToggle);
		section.appendChild(barRow);

		// Lyrics toggle
		let lyricsRow = ModalOptions.#createRow("Lyrics");
		let lyricsToggle = ModalOptions.#createToggle("opt-lyrics", Visual.lyricsEnabled, function (checked) {
			Visual.lyricsEnabled = checked;
			let caption = document.getElementById("caption");
			if (caption) caption.style.opacity = checked ? 1 : 0;
			UrlParams.SetParam("lyrics", String(checked));
		});
		ModalOptions.#els.lyrics = lyricsToggle.querySelector("input");
		lyricsRow.appendChild(lyricsToggle);
		section.appendChild(lyricsRow);

		// Mic Lyrics toggle — routes live speech recognition through the
		// lyrics pipeline. Hidden if the browser doesn't support SpeechRecognition.
		if (MicLyrics.isSupported()) {
			let micRow = ModalOptions.#createRow("Mic Lyrics");
			let micToggle = ModalOptions.#createToggle("opt-mic-lyrics", MicLyrics.isActive(), async function (checked) {
				if (checked) {
					let ok = await MicLyrics.start();
					if (!ok) {
						// Permission denied or unsupported — revert the UI.
						let inp = document.getElementById("opt-mic-lyrics");
						if (inp) inp.checked = false;
						UrlParams.removeParam("micLyrics");
						return;
					}
					UrlParams.SetParam("micLyrics", "true");
				} else {
					MicLyrics.stop();
					UrlParams.removeParam("micLyrics");
				}
			});
			ModalOptions.#els.micLyrics = micToggle.querySelector("input");
			micRow.title = "Speak into your microphone to drive the on-screen lyrics in real time.";
			micRow.appendChild(micToggle);
			section.appendChild(micRow);
		}

		// Theme toggle
		let themeRow = ModalOptions.#createRow("Light Theme");
		let isLight = document.documentElement.getAttribute("data-theme") === "light";
		let themeToggle = ModalOptions.#createToggle("opt-theme", isLight, function (checked) {
			let theme = checked ? "light" : "dark";
			document.documentElement.setAttribute("data-theme", theme);
			localStorage.setItem("mp-theme", theme);
		});
		ModalOptions.#els.theme = themeToggle.querySelector("input");
		themeRow.appendChild(themeToggle);
		section.appendChild(themeRow);

		// Hide Background (OBS transparency)
		let bgHideRow = ModalOptions.#createRow("Hide Background");
		let bgHideElm = document.getElementById("bg-hide-opt");
		let bgHideToggle = ModalOptions.#createToggle("opt-bg-hide", bgHideElm ? bgHideElm.checked : false, function (checked) {
			let inlineEl = document.getElementById("bg-hide-opt");
			if (inlineEl) inlineEl.checked = checked;
			ModalOptions.#toggleBg(checked);
			UrlParams.SetParam("hideBg", String(checked));
		});
		ModalOptions.#els.bgHide = bgHideToggle.querySelector("input");
		bgHideRow.appendChild(bgHideToggle);
		section.appendChild(bgHideRow);

		panel.appendChild(section);
		return panel;
	}

	static #buildLayoutPanel() {
		let panel = document.createElement("div");
		panel.innerHTML = "<div style='text-align:center;padding:20px;color:rgba(255,255,255,0.4);'>Loading Layout Designer...</div>";
		return panel;
	}

	// ---------------------------------------------------------------
	//  Effects panel
	// ---------------------------------------------------------------

	static #buildEffectsPanel() {
		let panel = document.createElement("div");
		let section = ModalOptions.#createSection("Effects");

		// Color Fades toggle
		let fadeRow = ModalOptions.#createRow("Color Fades");
		let fadeToggle = ModalOptions.#createToggle("opt-fade", Visual.color.fade, function (checked) {
			if (checked) {
				Visual.color.saved = {
					r: Visual.color.red,
					g: Visual.color.green,
					b: Visual.color.blue
				};
				Visual.color.fade = true;
			} else {
				Visual.color.fade = false;
				if (Visual.color.saved) {
					setTimeout(function () {
						Visual.color.red = Visual.color.saved.r;
						Visual.color.green = Visual.color.saved.g;
						Visual.color.blue = Visual.color.saved.b;
					}, 100);
				}
			}
			UrlParams.SetParam("fade", String(checked));
		});
		ModalOptions.#els.fade = fadeToggle.querySelector("input");
		fadeRow.appendChild(fadeToggle);
		section.appendChild(fadeRow);

		// New BG toggle (hexagon background)
		let newBgRow = ModalOptions.#createRow("Hexagon Background");
		let newBgToggle = ModalOptions.#createToggle("opt-new-bg", ModalOptions.#isNewBgVisible(), function (checked) {
			let mainBefore = document.getElementById("main-before");
			if (mainBefore) mainBefore.style.display = checked ? "block" : "none";
			UrlParams.SetParam("newBg", String(checked));
		});
		ModalOptions.#els.newBg = newBgToggle.querySelector("input");
		newBgRow.appendChild(newBgToggle);
		section.appendChild(newBgRow);

		// Sphere toggle — mirrors the legacy #sphere checkbox so both controls
		// stay in sync, and always writes the "sphere" URL param.
		let sphereRow = ModalOptions.#createRow("Sphere");
		let sphereToggle = ModalOptions.#createToggle("opt-sphere", ModalOptions.#isSphereVisible(), function (checked) {
			let objElm = document.getElementById("obj");
			if (objElm) objElm.style.display = checked ? "block" : "none";
			if (ModalOptions.#bgStateCallback) ModalOptions.#bgStateCallback(checked);
			// Keep the legacy hidden checkbox in sync AND dispatch its change
			// event so any listeners bound in main.mjs also fire.
			let legacyCb = document.getElementById("sphere");
			if (legacyCb && legacyCb.checked !== checked) {
				legacyCb.checked = checked;
				legacyCb.dispatchEvent(new Event("change", { bubbles: true }));
			}
			UrlParams.SetParam("sphere", String(checked));
		});
		ModalOptions.#els.sphere = sphereToggle.querySelector("input");
		sphereRow.appendChild(sphereToggle);
		section.appendChild(sphereRow);

		// Hex Colors override toggle
		let cbgRow = ModalOptions.#createRow("Hex Colors Override");
		let cbgToggle = ModalOptions.#createToggle("opt-cbg", Visual.cbg, function (checked) {
			Visual.cbg = checked;
			UrlParams.SetParam("cbg", String(checked));
		});
		ModalOptions.#els.cbg = cbgToggle.querySelector("input");
		cbgRow.appendChild(cbgToggle);
		section.appendChild(cbgRow);

		// Hex Color picker
		let hexRow = ModalOptions.#createRow("Hex Background Color");
		let hexWrap = document.createElement("div");
		hexWrap.className = "opt-color-wrap";
		let hexInput = document.createElement("input");
		hexInput.type = "color";
		hexInput.className = "opt-color-input";
		hexInput.id = "opt-hex-color";
		hexInput.value = ModalOptions.#rgbToHex(Visual.cbg_ovr.r, Visual.cbg_ovr.g, Visual.cbg_ovr.b);
		let hexSwatch = document.createElement("div");
		hexSwatch.className = "opt-color-swatch";
		hexSwatch.id = "opt-hex-swatch";
		hexSwatch.style.backgroundColor = hexInput.value;
		hexInput.addEventListener("input", function () {
			hexSwatch.style.backgroundColor = hexInput.value;
			ModalOptions.#applyHexColor(hexInput.value);
			UrlParams.SetParam("hexColor", hexInput.value);
		});
		hexWrap.appendChild(hexInput);
		hexWrap.appendChild(hexSwatch);
		ModalOptions.#els.hexInput = hexInput;
		ModalOptions.#els.hexSwatch = hexSwatch;
		hexRow.appendChild(hexWrap);
		section.appendChild(hexRow);

		panel.appendChild(section);
		return panel;
	}

	// ---------------------------------------------------------------
	//  Player tick (updates progress bar and time while modal is open)
	// ---------------------------------------------------------------

	static #startPlayerTick() {
		if (ModalOptions.#playerTimerId !== null) return;
		ModalOptions.#playerTimerId = setInterval(function () { ModalOptions.#updatePlayerUI(); }, 250);
		ModalOptions.#updatePlayerUI();

		// Listen for play/pause on the audio element to update icon
		let audio = ModalOptions.#getAudioElement();
		if (audio) {
			audio.addEventListener("play", ModalOptions.#onAudioPlay);
			audio.addEventListener("pause", ModalOptions.#onAudioPause);
		}
	}

	static #stopPlayerTick() {
		if (ModalOptions.#playerTimerId !== null) {
			clearInterval(ModalOptions.#playerTimerId);
			ModalOptions.#playerTimerId = null;
		}
		let audio = ModalOptions.#getAudioElement();
		if (audio) {
			audio.removeEventListener("play", ModalOptions.#onAudioPlay);
			audio.removeEventListener("pause", ModalOptions.#onAudioPause);
		}
	}

	static #onAudioPlay = function () {
		ModalOptions.#setPlayIcon(false);
	};

	static #onAudioPause = function () {
		ModalOptions.#setPlayIcon(true);
	};

	/**
	 * Sets the play/pause icon state.
	 * @param {boolean} showPlay - true for play icon, false for pause icon.
	 */
	static #setPlayIcon(showPlay) {
		let icon = ModalOptions.#els.playIcon;
		if (!icon) return;
		icon.className = showPlay ? "opt-icon-play" : "opt-icon-pause";
	}

	/**
	 * Updates the player progress bar, time display, and play/pause icon.
	 */
	static #updatePlayerUI() {
		let audio = ModalOptions.#getAudioElement();
		if (!audio) return;

		// Progress fill
		let fill = ModalOptions.#els.progressFill;
		if (fill && isFinite(audio.duration) && audio.duration > 0) {
			let pct = (audio.currentTime / audio.duration) * 100;
			fill.style.width = pct + "%";
		}

		// Time text
		let timeEl = ModalOptions.#els.timeDisplay;
		if (timeEl) {
			let cur = ModalOptions.#formatTime(audio.currentTime);
			let dur = isFinite(audio.duration) ? ModalOptions.#formatTime(audio.duration) : "0:00";
			timeEl.textContent = cur + " / " + dur;
		}

		// Play/pause icon
		ModalOptions.#setPlayIcon(audio.paused);
	}

	// ---------------------------------------------------------------
	//  Sync all controls to current state (called on open)
	// ---------------------------------------------------------------

	static #syncAllControls() {
		let els = ModalOptions.#els;

		// Visual tab — sync design grid active state
		if (els.designGrid) {
			let cells = els.designGrid.querySelectorAll(".opt-dc");
			let cur = Visual.currentDesign;
			for (let i = 0; i < cells.length; i++) {
				let isActive = cells[i].getAttribute("data-design") === cur;
				cells[i].style.borderColor = isActive ? "#4af" : "transparent";
				cells[i].style.background = isActive ? "rgba(68,170,255,0.15)" : "rgba(255,255,255,0.05)";
			}
		}
		if (els.polygonSides) els.polygonSides.value = String(Visual.polygonSides);
		let sidesRow = document.getElementById("opt-sides-row");
		if (sidesRow) sidesRow.style.display = Visual.currentDesign === "polygon" ? "" : "none";

		// Water options visibility
		let showWater = Visual.currentDesign === "water";
		let wRow = document.getElementById("opt-water-row");
		let tRow = document.getElementById("opt-tension-row");
		let sRow = document.getElementById("opt-spread-row");
		if (wRow) wRow.style.display = showWater ? "" : "none";
		if (tRow) tRow.style.display = showWater ? "" : "none";
		if (sRow) sRow.style.display = showWater ? "" : "none";

		// Liquid sphere options visibility and sync
		let showLiquid = Visual.currentDesign === "liquidsphere";
		let lvRow = document.getElementById("opt-liq-visc-row");
		let ldRow = document.getElementById("opt-liq-dens-row");
		if (lvRow) lvRow.style.display = showLiquid ? "" : "none";
		if (ldRow) ldRow.style.display = showLiquid ? "" : "none";
		if (els.liqVisc) els.liqVisc.value = String(Visualizer3D.liquidViscosity);
		if (els.liqDens) els.liqDens.value = String(Visualizer3D.liquidDensity);

		// Lyric particles: show the count + curvature sliders only when that design is active.
		let showLyric = Visual.currentDesign === "lyricparticles";
		let lcRow = document.getElementById("opt-lyric-count-row");
		let lcvRow = document.getElementById("opt-lyric-curve-row");
		if (lcRow) lcRow.style.display = showLyric ? "" : "none";
		if (lcvRow) lcvRow.style.display = showLyric ? "" : "none";
		if (els.lyricCount) els.lyricCount.value = String(Visualizer3D.lyricParticleCount);
		if (els.lyricCurve) els.lyricCurve.value = String(Math.round((Number(Visualizer3D.lyricTextCurvature) || 0) * 100));
		// Record Player: plate-text input only visible when that design active.
		let showRecord = Visual.currentDesign === "recordplayer";
		let rtRow = document.getElementById("opt-record-text-row");
		if (rtRow) rtRow.style.display = showRecord ? "" : "none";
		if (els.recordText) els.recordText.value = Visualizer3D.recordPlateText || "Virtma";
		// Keep the mic-lyrics checkbox in sync with runtime state so the UI
		// reflects auto-start on reload and any programmatic stop.
		if (els.micLyrics) els.micLyrics.checked = MicLyrics.isActive();

		// 3D options visibility and sync. The top-of-panel camera-mode row
		// was previously named "autorot" — keep the id we actually render
		// (opt-3d-cammode-row) in sync here too.
		let show3D = Visualizer3D.is3D(Visual.currentDesign);
		let cmRow = document.getElementById("opt-3d-cammode-row");
		let orRow = document.getElementById("opt-3d-orbit-row");
		if (cmRow) cmRow.style.display = show3D ? "" : "none";
		if (orRow) orRow.style.display = show3D ? "" : "none";
		if (els.autoRotate) els.autoRotate.checked = Visualizer3D.autoRotate;
		if (els.cameraMode) els.cameraMode.value = Visualizer3D.cameraMode || "static";
		if (els.orbitEnabled) els.orbitEnabled.checked = Visualizer3D.orbitEnabled;

		// 3D Lighting section
		let lightSection = document.getElementById("opt-3d-lighting-section");
		if (lightSection) lightSection.style.display = show3D ? "" : "none";
		if (els.lightEnabled) els.lightEnabled.checked = Visualizer3D.lightingEnabled;
		if (els.ambColor) els.ambColor.value = Visualizer3D.ambientColor;
		if (els.ambIntensity) els.ambIntensity.value = String(Visualizer3D.ambientIntensity);
		if (els.dirColor) els.dirColor.value = Visualizer3D.directionalColor;
		if (els.dirIntensity) els.dirIntensity.value = String(Visualizer3D.directionalIntensity);
		if (els.dirLightX) els.dirLightX.value = String(Visualizer3D.directionalX);
		if (els.dirLightY) els.dirLightY.value = String(Visualizer3D.directionalY);
		if (els.dirLightZ) els.dirLightZ.value = String(Visualizer3D.directionalZ);
		if (els.materialMode) els.materialMode.value = Visualizer3D.materialMode;

		if (els.colorSwatch)
			els.colorSwatch.style.backgroundColor = "rgb(" + Visual.color.red + "," + Visual.color.green + "," + Visual.color.blue + ")";

		if (els.fill) els.fill.checked = Visual.fillPolygon;
		if (els.ghost) els.ghost.checked = Visual.ghost;

		// Audio tab
		if (els.fft) els.fft.value = String(Visual.audioAccuracy);
		let audio = ModalOptions.#getAudioElement();
		if (audio) {
			if (els.loopBtn) els.loopBtn.classList.toggle("active", audio.loop);
			if (els.muteBtn) {
				els.muteBtn.classList.toggle("active", audio.muted);
				els.muteBtn.innerHTML = audio.muted ? "&#128263;" : "&#128264;";
			}
			if (els.speedSelect) els.speedSelect.value = String(audio.playbackRate);
		}
		if (els.shuffle) {
			let shuffleElm = document.getElementById("shuffle-opt");
			els.shuffle.checked = shuffleElm ? shuffleElm.checked : false;
		}

		// Display tab
		if (els.songName) els.songName.checked = !document.getElementById("song-name")?.hidden;
		if (els.progressBar) els.progressBar.checked = Visual.progressBarVisible;
		if (els.lyrics) els.lyrics.checked = Visual.lyricsEnabled;
		if (els.theme) els.theme.checked = document.documentElement.getAttribute("data-theme") === "light";
		if (els.bgHide) {
			let bgHideElm = document.getElementById("bg-hide-opt");
			els.bgHide.checked = bgHideElm ? bgHideElm.checked : false;
		}

		// Effects tab
		if (els.fade) els.fade.checked = Visual.color.fade;
		if (els.newBg) els.newBg.checked = ModalOptions.#isNewBgVisible();
		if (els.sphere) els.sphere.checked = ModalOptions.#isSphereVisible();
		if (els.cbg) els.cbg.checked = Visual.cbg;
		if (els.hexInput) {
			let hex = ModalOptions.#rgbToHex(Visual.cbg_ovr.r, Visual.cbg_ovr.g, Visual.cbg_ovr.b);
			els.hexInput.value = hex;
			if (els.hexSwatch) els.hexSwatch.style.backgroundColor = hex;
		}
	}

	// ---------------------------------------------------------------
	//  DOM helper builders
	// ---------------------------------------------------------------

	/**
	 * Creates a section container with an optional label.
	 * @param {string} label
	 * @returns {HTMLElement}
	 */
	static #createSection(label) {
		let section = document.createElement("div");
		section.className = "opt-section";
		if (label) {
			let lbl = document.createElement("div");
			lbl.className = "opt-section-label";
			lbl.textContent = label;
			section.appendChild(lbl);
		}
		return section;
	}

	/**
	 * Creates a row with a label on the left.
	 * @param {string} labelText
	 * @returns {HTMLElement}
	 */
	static #createRow(labelText) {
		let row = document.createElement("div");
		row.className = "opt-row";
		let label = document.createElement("span");
		label.className = "opt-row-label";
		label.textContent = labelText;
		row.appendChild(label);
		return row;
	}

	/**
	 * Creates a styled toggle switch.
	 * @param {string} id - Element id for the checkbox input.
	 * @param {boolean} checked - Initial state.
	 * @param {function(boolean): void} onChange - Callback with new checked state.
	 * @returns {HTMLElement}
	 */
	static #createToggle(id, checked, onChange) {
		let wrapper = document.createElement("label");
		wrapper.className = "opt-toggle";
		let input = document.createElement("input");
		input.type = "checkbox";
		input.id = id;
		input.checked = !!checked;
		input.addEventListener("change", function () {
			onChange(input.checked);
		});
		let track = document.createElement("span");
		track.className = "opt-toggle-track";
		wrapper.appendChild(input);
		wrapper.appendChild(track);
		return wrapper;
	}

	/**
	 * Creates a styled <select> dropdown.
	 * @param {string} id
	 * @param {Array<{value: string, label: string}>} options
	 * @param {string} selectedValue
	 * @returns {HTMLSelectElement}
	 */
	static #createSelect(id, options, selectedValue) {
		let select = document.createElement("select");
		select.className = "opt-select";
		select.id = id;
		for (let i = 0; i < options.length; i++) {
			let opt = document.createElement("option");
			opt.value = options[i].value;
			opt.textContent = options[i].label;
			if (options[i].value === selectedValue) opt.selected = true;
			select.appendChild(opt);
		}
		return select;
	}

	// ---------------------------------------------------------------
	//  Utilities
	// ---------------------------------------------------------------

	/**
	 * Returns the native <audio id="player"> element.
	 * @returns {HTMLAudioElement|null}
	 */
	static #getAudioElement() {
		return document.getElementById("player");
	}

	/**
	 * Checks whether the hexagon background (#main-before) is visible.
	 * @returns {boolean}
	 */
	static #isNewBgVisible() {
		let el = document.getElementById("main-before");
		return el ? el.style.display !== "none" : true;
	}

	/**
	 * Checks whether the sphere (#obj) is visible.
	 * @returns {boolean}
	 */
	static #isSphereVisible() {
		let el = document.getElementById("obj");
		return el ? el.style.display !== "none" : true;
	}

	/**
	 * Toggles background visibility (OBS transparency mode).
	 * @param {boolean} hide - true to hide background.
	 */
	static #toggleBg(hide) {
		let d = document.querySelector("html, body, .bg, .bg-000, .display, .display-000, .main-container");
		if (hide) {
			if (d) d.style = "box-shadow:unset !important;background:transparent !important;background-color:transparent !important;";
			let mc = document.querySelector(".main-container");
			if (mc) mc.hidden = true;
		} else {
			if (d) d.style = "";
			let mc = document.querySelector(".main-container");
			if (mc) mc.hidden = false;
		}
	}

	/**
	 * Parses a hex color string and applies it to Visual.cbg_ovr.
	 * @param {string} hex - Color string in "#RRGGBB" or "#RRGGBBAA" format.
	 */
	static #applyHexColor(hex) {
		if (typeof hex !== "string") return;
		let str = hex.startsWith("#") ? hex.substring(1) : hex;
		let r = parseInt(str.substr(0, 2), 16) || 0;
		let g = parseInt(str.substr(2, 2), 16) || 0;
		let b = parseInt(str.substr(4, 2), 16) || 0;
		let a = str.length > 6 ? (parseInt(str.substr(6, 2), 16) || 0) : 50;
		Visual.cbg_ovr = { r: r, g: g, b: b, a: a };
		Visual.updateColor();
	}

	/**
	 * Converts RGB values (0-255) to a hex color string.
	 * @param {number} r
	 * @param {number} g
	 * @param {number} b
	 * @returns {string}
	 */
	static #rgbToHex(r, g, b) {
		let toHex = function (n) {
			let h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
			return h.length === 1 ? "0" + h : h;
		};
		return "#" + toHex(r) + toHex(g) + toHex(b);
	}

	/**
	 * Builds the visual design picker grid. Each cell shows a 50×36 SVG
	 * thumbnail and a short label. Clicking a cell updates Visual.currentDesign
	 * and toggles related option rows.
	 * @param {string} currentDesign
	 * @returns {HTMLElement}
	 */
	static #buildDesignGrid(currentDesign) {
		let designs = [
			{ value: "bar",              label: "Bar",            dim: "2D" },
			{ value: "line",             label: "Line",           dim: "2D" },
			{ value: "verticalLines",    label: "Vert. Lines",    dim: "2D" },
			{ value: "curvedLines",      label: "Curved Lines",   dim: "2D" },
			{ value: "circle",           label: "Circle",         dim: "2D" },
			{ value: "polygon",          label: "Polygon",        dim: "2D" },
			{ value: "snow",             label: "Snow",           dim: "2D" },
			{ value: "rain",             label: "Rain",           dim: "2D" },
			{ value: "lightning",        label: "Lightning",      dim: "2D" },
			{ value: "tetris",           label: "Tetris",         dim: "2D" },
			{ value: "water",            label: "Water",          dim: "2D" },
			{ value: "kaleidoscope",     label: "Kaleidoscope",   dim: "2D" },
			{ value: "fireworks",        label: "Fireworks",      dim: "2D" },
			{ value: "3dbars",           label: "3D Bars",        dim: "3D" },
			{ value: "3dwaves",          label: "3D Waves",       dim: "3D" },
			{ value: "3dsphere",         label: "3D Sphere",      dim: "3D" },
			{ value: "vertexdistortion", label: "Vtx Distort",    dim: "3D" },
			{ value: "planeripple",      label: "Plane Ripple",   dim: "3D" },
			{ value: "liquidsphere",     label: "Liq. Sphere",    dim: "3D" },
			{ value: "smoketriangle",    label: "Smoke Tri",      dim: "3D" },
			{ value: "recordplayer",     label: "Record Player",  dim: "3D" },
			{ value: "3dsand",           label: "3D Sand",        dim: "3D" },
			{ value: "dnahelix",         label: "DNA Helix",      dim: "3D" },
			{ value: "neontunnel",       label: "Neon Tunnel",    dim: "3D" },
			{ value: "particlesphere",   label: "Part. Sphere",   dim: "3D" },
			{ value: "histogram3d",      label: "3D Histogram",   dim: "3D" },
			{ value: "audiowave3d",      label: "Audio Wave",     dim: "3D" },
			{ value: "headphones3d",     label: "Headphones",     dim: "3D" },
			{ value: "lyricparticles",   label: "Lyric Part.",    dim: "3D" },
			{ value: "gelatinshape",     label: "Gelatin",        dim: "3D" },
			{ value: "dog3d",            label: "Dog Dancer",     dim: "3D" },
			{ value: "guineapig3d",      label: "Guinea Pig",     dim: "3D" },
			{ value: "pointwave",        label: "Point Wave",     dim: "3D" }
		];

		let thumbs = {
			bar:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="2" y="22" width="5" height="12" fill="#4af" rx="1"/>' +
				'<rect x="9" y="15" width="5" height="19" fill="#4af" rx="1"/>' +
				'<rect x="16" y="9" width="5" height="25" fill="#4af" rx="1"/>' +
				'<rect x="23" y="5" width="5" height="29" fill="#4af" rx="1"/>' +
				'<rect x="30" y="11" width="5" height="23" fill="#4af" rx="1"/>' +
				'<rect x="37" y="19" width="5" height="15" fill="#4af" rx="1"/>' +
				'<rect x="44" y="25" width="5" height="9" fill="#4af" rx="1"/></svg>',
			line:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<path d="M1,18 C6,8 10,28 16,18 C22,8 27,28 33,18 C38,8 43,28 49,18" fill="none" stroke="#4af" stroke-width="2.5"/></svg>',
			verticalLines:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<line x1="4" y1="34" x2="4" y2="12" stroke="#4af" stroke-width="2"/>' +
				'<line x1="10" y1="34" x2="10" y2="6" stroke="#4af" stroke-width="2"/>' +
				'<line x1="16" y1="34" x2="16" y2="16" stroke="#4af" stroke-width="2"/>' +
				'<line x1="22" y1="34" x2="22" y2="4" stroke="#4af" stroke-width="2"/>' +
				'<line x1="28" y1="34" x2="28" y2="8" stroke="#4af" stroke-width="2"/>' +
				'<line x1="34" y1="34" x2="34" y2="18" stroke="#4af" stroke-width="2"/>' +
				'<line x1="40" y1="34" x2="40" y2="22" stroke="#4af" stroke-width="2"/>' +
				'<line x1="46" y1="34" x2="46" y2="28" stroke="#4af" stroke-width="2"/></svg>',
			curvedLines:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<path d="M1,28 Q13,4 25,18 Q37,32 49,10" fill="none" stroke="#4af" stroke-width="2" opacity=".9"/>' +
				'<path d="M1,22 Q13,8 25,15 Q37,22 49,6" fill="none" stroke="#4af" stroke-width="1.5" opacity=".55"/>' +
				'<path d="M1,32 Q15,14 25,24 Q35,34 49,18" fill="none" stroke="#4af" stroke-width="1.5" opacity=".55"/></svg>',
			circle:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<circle cx="25" cy="18" r="15" fill="none" stroke="#4af" stroke-width="1.5" opacity=".4"/>' +
				'<circle cx="25" cy="18" r="10" fill="none" stroke="#4af" stroke-width="1.5" opacity=".65"/>' +
				'<circle cx="25" cy="18" r="4" fill="none" stroke="#4af" stroke-width="1.5"/>' +
				'<line x1="25" y1="18" x2="25" y2="3" stroke="#4af" stroke-width="2" opacity=".9"/>' +
				'<line x1="25" y1="18" x2="38" y2="27" stroke="#4af" stroke-width="2" opacity=".5"/>' +
				'<line x1="25" y1="18" x2="10" y2="25" stroke="#4af" stroke-width="2" opacity=".5"/></svg>',
			polygon:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<polygon points="25,2 45,13 45,25 25,36 5,25 5,13" fill="none" stroke="#4af" stroke-width="2"/>' +
				'<polygon points="25,9 38,16 38,22 25,29 12,22 12,16" fill="none" stroke="#4af" stroke-width="1.5" opacity=".45"/></svg>',
			snow:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<circle cx="8" cy="10" r="2" fill="#4af" opacity=".9"/>' +
				'<circle cx="20" cy="6" r="1.5" fill="#4af" opacity=".8"/>' +
				'<circle cx="35" cy="8" r="2.5" fill="#4af"/>' +
				'<circle cx="46" cy="12" r="1.5" fill="#4af" opacity=".7"/>' +
				'<circle cx="14" cy="21" r="2" fill="#4af" opacity=".6"/>' +
				'<circle cx="28" cy="18" r="1.5" fill="#4af" opacity=".9"/>' +
				'<circle cx="43" cy="22" r="2" fill="#4af" opacity=".7"/>' +
				'<circle cx="6" cy="30" r="1.5" fill="#4af" opacity=".5"/>' +
				'<circle cx="22" cy="30" r="2" fill="#4af" opacity=".6"/>' +
				'<circle cx="38" cy="28" r="1.5" fill="#4af" opacity=".8"/></svg>',
			rain:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<line x1="6" y1="2" x2="3" y2="14" stroke="#4af" stroke-width="1.5" opacity=".8"/>' +
				'<line x1="14" y1="0" x2="11" y2="16" stroke="#4af" stroke-width="1.5"/>' +
				'<line x1="22" y1="4" x2="19" y2="18" stroke="#4af" stroke-width="1.5" opacity=".7"/>' +
				'<line x1="30" y1="0" x2="27" y2="14" stroke="#4af" stroke-width="1.5" opacity=".9"/>' +
				'<line x1="38" y1="2" x2="35" y2="18" stroke="#4af" stroke-width="1.5" opacity=".6"/>' +
				'<line x1="46" y1="0" x2="43" y2="16" stroke="#4af" stroke-width="1.5" opacity=".8"/>' +
				'<line x1="10" y1="18" x2="7" y2="34" stroke="#4af" stroke-width="1.5" opacity=".5"/>' +
				'<line x1="26" y1="20" x2="23" y2="36" stroke="#4af" stroke-width="1.5" opacity=".7"/>' +
				'<line x1="42" y1="18" x2="39" y2="34" stroke="#4af" stroke-width="1.5" opacity=".6"/></svg>',
			lightning:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<polyline points="28,2 18,16 24,16 15,34 32,18 25,18 33,2" fill="none" stroke="#ffe94a" stroke-width="2.5" stroke-linejoin="round"/></svg>',
			tetris:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="2" y="22" width="8" height="8" fill="#e44" rx="1"/>' +
				'<rect x="11" y="22" width="8" height="8" fill="#4e4" rx="1"/>' +
				'<rect x="20" y="22" width="8" height="8" fill="#44e" rx="1"/>' +
				'<rect x="29" y="22" width="8" height="8" fill="#ea4" rx="1"/>' +
				'<rect x="38" y="22" width="8" height="8" fill="#4af" rx="1"/>' +
				'<rect x="11" y="13" width="8" height="8" fill="#e44" rx="1"/>' +
				'<rect x="20" y="13" width="8" height="8" fill="#4e4" rx="1"/>' +
				'<rect x="29" y="13" width="8" height="8" fill="#44e" rx="1"/>' +
				'<rect x="20" y="4" width="8" height="8" fill="#ea4" rx="1"/></svg>',
			water:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<ellipse cx="25" cy="24" rx="20" ry="5" fill="none" stroke="#4af" stroke-width="1.5" opacity=".35"/>' +
				'<path d="M5,20 Q12,13 19,20 Q26,27 33,20 Q40,13 47,20" fill="none" stroke="#4af" stroke-width="2"/>' +
				'<circle cx="18" cy="10" r="2" fill="#4af" opacity=".8"/>' +
				'<circle cx="25" cy="6" r="1.5" fill="#4af" opacity=".9"/>' +
				'<circle cx="32" cy="9" r="2" fill="#4af" opacity=".7"/></svg>',
			"3dbars":
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="3" y="22" width="6" height="12" fill="#4af" rx="1" opacity=".45"/>' +
				'<rect x="11" y="14" width="6" height="20" fill="#4af" rx="1" opacity=".65"/>' +
				'<rect x="19" y="8" width="6" height="26" fill="#4af" rx="1" opacity=".9"/>' +
				'<rect x="27" y="12" width="6" height="22" fill="#4af" rx="1" opacity=".7"/>' +
				'<rect x="35" y="20" width="6" height="14" fill="#4af" rx="1" opacity=".5"/>' +
				'<rect x="43" y="26" width="6" height="8" fill="#4af" rx="1" opacity=".35"/></svg>',
			"3dwaves":
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<ellipse cx="25" cy="18" rx="22" ry="14" fill="none" stroke="#4af" stroke-width="1.5" opacity=".25"/>' +
				'<ellipse cx="25" cy="18" rx="15" ry="9" fill="none" stroke="#4af" stroke-width="1.5" opacity=".5"/>' +
				'<ellipse cx="25" cy="18" rx="8" ry="5" fill="none" stroke="#4af" stroke-width="1.5" opacity=".85"/>' +
				'<path d="M3,18 Q10,10 17,18 Q24,26 31,18 Q38,10 47,18" fill="none" stroke="#4af" stroke-width="1.5" opacity=".55"/></svg>',
			"3dsphere":
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<circle cx="25" cy="18" r="15" fill="none" stroke="#4af" stroke-width="1.5" opacity=".85"/>' +
				'<ellipse cx="25" cy="18" rx="15" ry="5" fill="none" stroke="#4af" stroke-width="1" opacity=".5"/>' +
				'<ellipse cx="25" cy="18" rx="5" ry="15" fill="none" stroke="#4af" stroke-width="1" opacity=".5"/>' +
				'<line x1="10" y1="18" x2="40" y2="18" stroke="#4af" stroke-width="1" opacity=".35"/></svg>',
			vertexdistortion:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<polygon points="25,2 30,9 39,8 34,16 41,22 32,22 30,32 24,26 15,31 17,22 8,20 15,13 12,5 20,10" fill="none" stroke="#4af" stroke-width="1.5"/>' +
				'<circle cx="25" cy="18" r="5" fill="none" stroke="#4af" stroke-width="1" opacity=".45"/></svg>',
			planeripple:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<path d="M2,12 Q8,6 14,12 Q20,18 26,12 Q32,6 38,12 Q44,18 48,12" fill="none" stroke="#4af" stroke-width="1.5" opacity=".45"/>' +
				'<path d="M2,18 Q8,12 14,18 Q20,24 26,18 Q32,12 38,18 Q44,24 48,18" fill="none" stroke="#4af" stroke-width="2"/>' +
				'<path d="M2,24 Q8,18 14,24 Q20,30 26,24 Q32,18 38,24 Q44,30 48,24" fill="none" stroke="#4af" stroke-width="1.5" opacity=".45"/></svg>',
			liquidsphere:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<ellipse cx="25" cy="18" rx="17" ry="14" fill="none" stroke="#4af" stroke-width="2" opacity=".9"/>' +
				'<ellipse cx="23" cy="16" rx="10" ry="9" fill="none" stroke="#4af" stroke-width="1" opacity=".35"/>' +
				'<circle cx="25" cy="18" r="3" fill="#4af" opacity=".25"/></svg>',
			smoketriangle:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<polygon points="12,32 18,20 24,32" fill="none" stroke="#4af" stroke-width="1.5"/>' +
				'<polygon points="26,32 32,20 38,32" fill="none" stroke="#4af" stroke-width="1.5"/>' +
				'<circle cx="18" cy="16" r="2" fill="#4af" opacity=".4"/>' +
				'<circle cx="24" cy="11" r="2.5" fill="#4af" opacity=".28"/>' +
				'<circle cx="30" cy="7" r="2" fill="#4af" opacity=".18"/>' +
				'<circle cx="31" cy="16" r="2" fill="#4af" opacity=".4"/>' +
				'<circle cx="37" cy="12" r="1.5" fill="#4af" opacity=".25"/></svg>',
			recordplayer:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<circle cx="22" cy="20" r="14" fill="none" stroke="#4af" stroke-width="1.5" opacity=".75"/>' +
				'<circle cx="22" cy="20" r="8" fill="none" stroke="#4af" stroke-width="1" opacity=".45"/>' +
				'<circle cx="22" cy="20" r="3" fill="#4af" opacity=".65"/>' +
				'<line x1="36" y1="7" x2="22" y2="20" stroke="#aaa" stroke-width="2.5" stroke-linecap="round"/>' +
				'<circle cx="36" cy="7" r="3" fill="#888"/></svg>',
			"3dsand":
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="4" y="5" width="42" height="26" fill="none" stroke="#4af" stroke-width="1" opacity=".3" rx="1"/>' +
				'<circle cx="10" cy="11" r=".9" fill="#e8c27a"/><circle cx="15" cy="10" r=".9" fill="#e8c27a"/>' +
				'<circle cx="20" cy="11" r=".9" fill="#e8c27a"/><circle cx="25" cy="10" r=".9" fill="#e8c27a"/>' +
				'<circle cx="30" cy="11" r=".9" fill="#e8c27a"/><circle cx="35" cy="10" r=".9" fill="#e8c27a"/>' +
				'<circle cx="40" cy="11" r=".9" fill="#e8c27a"/>' +
				'<circle cx="12" cy="18" r=".9" fill="#e8c27a"/><circle cx="38" cy="18" r=".9" fill="#e8c27a"/>' +
				'<circle cx="25" cy="18" r=".9" fill="#e8c27a"/>' +
				'<circle cx="10" cy="25" r=".9" fill="#e8c27a"/><circle cx="15" cy="26" r=".9" fill="#e8c27a"/>' +
				'<circle cx="20" cy="25" r=".9" fill="#e8c27a"/><circle cx="25" cy="26" r=".9" fill="#e8c27a"/>' +
				'<circle cx="30" cy="25" r=".9" fill="#e8c27a"/><circle cx="35" cy="26" r=".9" fill="#e8c27a"/>' +
				'<circle cx="40" cy="25" r=".9" fill="#e8c27a"/></svg>',
			kaleidoscope:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<g transform="translate(25 18)">' +
				'<polygon points="0,-14 5,-7 -5,-7" fill="#e44" opacity=".8"/>' +
				'<polygon points="0,-14 5,-7 -5,-7" transform="rotate(72)" fill="#4e4" opacity=".8"/>' +
				'<polygon points="0,-14 5,-7 -5,-7" transform="rotate(144)" fill="#44e" opacity=".8"/>' +
				'<polygon points="0,-14 5,-7 -5,-7" transform="rotate(216)" fill="#ea4" opacity=".8"/>' +
				'<polygon points="0,-14 5,-7 -5,-7" transform="rotate(288)" fill="#a4e" opacity=".8"/>' +
				'<circle r="4" fill="#fff" opacity=".85"/>' +
				'<circle r="10" fill="none" stroke="#fff" stroke-width=".6" opacity=".35"/>' +
				'</g></svg>',
			fireworks:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<g transform="translate(15 14)" stroke-width="1.3" stroke-linecap="round">' +
				'<line x1="0" y1="0" x2="0" y2="-7" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="5" y2="-5" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="7" y2="0" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="5" y2="5" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="0" y2="7" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="-5" y2="5" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="-7" y2="0" stroke="#ff6"/>' +
				'<line x1="0" y1="0" x2="-5" y2="-5" stroke="#ff6"/>' +
				'</g>' +
				'<g transform="translate(35 22)" stroke-width="1.1" stroke-linecap="round">' +
				'<line x1="0" y1="0" x2="0" y2="-6" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="5" y2="-3" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="6" y2="2" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="3" y2="5" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="-3" y2="5" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="-6" y2="2" stroke="#f8a"/>' +
				'<line x1="0" y1="0" x2="-5" y2="-3" stroke="#f8a"/>' +
				'</g>' +
				'<circle cx="15" cy="14" r="1.3" fill="#fff"/>' +
				'<circle cx="35" cy="22" r="1.1" fill="#fff"/></svg>',
			dnahelix:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<path d="M10,2 Q25,9 40,2 Q25,16 10,9 Q25,23 40,16 Q25,30 10,23 Q25,37 40,30" fill="none" stroke="#4af" stroke-width="1.5"/>' +
				'<path d="M40,2 Q25,9 10,2 Q25,16 40,9 Q25,23 10,16 Q25,30 40,23 Q25,37 10,30" fill="none" stroke="#e4a" stroke-width="1.5"/>' +
				'<line x1="12" y1="5" x2="38" y2="5" stroke="#fff" stroke-width="1" opacity=".6"/>' +
				'<line x1="12" y1="12" x2="38" y2="12" stroke="#fff" stroke-width="1" opacity=".6"/>' +
				'<line x1="12" y1="19" x2="38" y2="19" stroke="#fff" stroke-width="1" opacity=".6"/>' +
				'<line x1="12" y1="26" x2="38" y2="26" stroke="#fff" stroke-width="1" opacity=".6"/>' +
				'<line x1="12" y1="33" x2="38" y2="33" stroke="#fff" stroke-width="1" opacity=".6"/></svg>',
			neontunnel:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="0" y="0" width="50" height="36" fill="#050018"/>' +
				'<polygon points="25,18 2,2 48,2" fill="none" stroke="#f0f" stroke-width=".5" opacity=".3"/>' +
				'<polygon points="25,18 2,34 48,34" fill="none" stroke="#f0f" stroke-width=".5" opacity=".3"/>' +
				'<circle cx="25" cy="18" r="14" fill="none" stroke="#0ff" stroke-width="1.2" opacity=".35"/>' +
				'<circle cx="25" cy="18" r="9" fill="none" stroke="#0ff" stroke-width="1.3" opacity=".55"/>' +
				'<circle cx="25" cy="18" r="5" fill="none" stroke="#f0f" stroke-width="1.4" opacity=".8"/>' +
				'<circle cx="25" cy="18" r="2" fill="none" stroke="#fff" stroke-width="1" opacity=".95"/>' +
				'<circle cx="25" cy="18" r=".8" fill="#fff"/></svg>',
			particlesphere:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<circle cx="25" cy="18" r="14" fill="none" stroke="#4af" stroke-width=".4" opacity=".3"/>' +
				'<g fill="#4af">' +
				'<circle cx="25" cy="4" r="1.2"/><circle cx="35" cy="7" r="1"/><circle cx="40" cy="18" r="1.3"/>' +
				'<circle cx="37" cy="28" r="1"/><circle cx="25" cy="32" r="1.4"/><circle cx="14" cy="29" r="1.1"/>' +
				'<circle cx="10" cy="18" r="1.2"/><circle cx="14" cy="8" r="1"/>' +
				'<circle cx="29" cy="12" r=".9" opacity=".7"/><circle cx="20" cy="14" r=".9" opacity=".7"/>' +
				'<circle cx="23" cy="24" r=".9" opacity=".7"/><circle cx="31" cy="22" r=".9" opacity=".7"/>' +
				'</g>' +
				'<circle cx="25" cy="18" r="2" fill="#ff6" opacity=".8"/></svg>',
			histogram3d:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<g fill="#4af">' +
				'<rect x="4" y="22" width="3" height="10" opacity=".4"/>' +
				'<rect x="8" y="18" width="3" height="14" opacity=".5"/>' +
				'<rect x="12" y="14" width="3" height="18" opacity=".6"/>' +
				'<rect x="16" y="10" width="3" height="22" opacity=".7"/>' +
				'<rect x="20" y="6"  width="3" height="26" opacity=".8"/>' +
				'<rect x="24" y="12" width="3" height="20" opacity=".85"/>' +
				'<rect x="28" y="16" width="3" height="16" opacity=".8"/>' +
				'<rect x="32" y="20" width="3" height="12" opacity=".7"/>' +
				'<rect x="36" y="24" width="3" height="8" opacity=".6"/>' +
				'<rect x="40" y="26" width="3" height="6" opacity=".5"/>' +
				'</g>' +
				'<g fill="#4af" opacity=".25">' +
				'<rect x="2" y="26" width="3" height="6"/><rect x="6" y="22" width="3" height="10"/>' +
				'<rect x="38" y="28" width="3" height="4"/><rect x="42" y="29" width="3" height="3"/>' +
				'</g></svg>',
			audiowave3d:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				// Matrix of small cubes, corner-mirrored heights (taller in center, shorter at edges)
				'<g fill="#4af">' +
				// Row 1 (top, shortest)
				'<rect x="4"  y="30" width="3" height="3"/><rect x="9"  y="29" width="3" height="4"/>' +
				'<rect x="14" y="27" width="3" height="6"/><rect x="19" y="25" width="3" height="8"/>' +
				'<rect x="24" y="23" width="3" height="10"/>' +
				// Mirror (right half)
				'<rect x="28" y="25" width="3" height="8"/><rect x="33" y="27" width="3" height="6"/>' +
				'<rect x="38" y="29" width="3" height="4"/><rect x="43" y="30" width="3" height="3"/>' +
				'</g>' +
				// Row 2 (behind, slightly dimmer)
				'<g fill="#8df" opacity=".75">' +
				'<rect x="5"  y="22" width="2.5" height="3"/><rect x="10" y="20" width="2.5" height="5"/>' +
				'<rect x="15" y="17" width="2.5" height="8"/><rect x="20" y="14" width="2.5" height="11"/>' +
				'<rect x="25" y="12" width="2.5" height="13"/>' +
				'<rect x="29" y="14" width="2.5" height="11"/><rect x="34" y="17" width="2.5" height="8"/>' +
				'<rect x="39" y="20" width="2.5" height="5"/><rect x="44" y="22" width="2.5" height="3"/>' +
				'</g>' +
				// Row 3 (farthest, dimmest)
				'<g fill="#bef" opacity=".5">' +
				'<rect x="6"  y="14" width="2" height="3"/><rect x="11" y="12" width="2" height="5"/>' +
				'<rect x="16" y="9"  width="2" height="8"/><rect x="21" y="6"  width="2" height="11"/>' +
				'<rect x="26" y="4"  width="2" height="13"/>' +
				'<rect x="30" y="6"  width="2" height="11"/><rect x="35" y="9"  width="2" height="8"/>' +
				'<rect x="40" y="12" width="2" height="5"/><rect x="45" y="14" width="2" height="3"/>' +
				'</g></svg>',
			headphones3d:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<path d="M10,18 Q10,6 25,6 Q40,6 40,18" fill="none" stroke="#ccc" stroke-width="1.6"/>' +
				'<rect x="5" y="14" width="8" height="12" rx="3" fill="#334"/>' +
				'<rect x="37" y="14" width="8" height="12" rx="3" fill="#334"/>' +
				'<circle cx="9" cy="20" r="2" fill="#e55"/>' +
				'<circle cx="41" cy="20" r="2" fill="#e55"/>' +
				'<g fill="none" stroke="#4af" stroke-width="1">' +
				'<path d="M0,20 Q2,16 4,20"/><path d="M2,22 Q3,18 4,22"/>' +
				'<path d="M46,20 Q48,16 50,20"/><path d="M46,22 Q47,18 48,22"/>' +
				'</g></svg>',
			lyricparticles:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<text x="25" y="22" font-size="11" fill="#4af" font-weight="bold" text-anchor="middle" font-family="sans-serif" letter-spacing="-1">LYRIC</text>' +
				'<g fill="#4af" opacity=".6">' +
				'<circle cx="4" cy="8" r=".9"/><circle cx="10" cy="4" r=".8"/><circle cx="40" cy="6" r=".9"/>' +
				'<circle cx="46" cy="12" r=".8"/><circle cx="8" cy="30" r=".9"/><circle cx="42" cy="30" r=".9"/>' +
				'<circle cx="20" cy="5" r=".7"/><circle cx="30" cy="32" r=".7"/>' +
				'</g></svg>',
			gelatinshape:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<defs><radialGradient id="gel" cx="45%" cy="40%">' +
				'<stop offset="0" stop-color="#aef" stop-opacity=".9"/>' +
				'<stop offset=".6" stop-color="#6bf" stop-opacity=".5"/>' +
				'<stop offset="1" stop-color="#28a" stop-opacity=".2"/>' +
				'</radialGradient></defs>' +
				'<ellipse cx="25" cy="18" rx="16" ry="14" fill="url(#gel)" stroke="#7df" stroke-width=".8"/>' +
				'<ellipse cx="20" cy="13" rx="4" ry="2.5" fill="#fff" opacity=".5"/></svg>',
			dog3d:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<ellipse cx="22" cy="22" rx="14" ry="7" fill="#c96"/>' +
				'<circle cx="37" cy="17" r="5" fill="#c96"/>' +
				'<polygon points="39,10 37,15 42,13" fill="#6a3"/>' +
				'<polygon points="36,11 34,15 38,14" fill="#6a3"/>' +
				'<circle cx="38" cy="17" r=".8" fill="#111"/>' +
				'<ellipse cx="42" cy="19" rx="1.5" ry="1" fill="#111"/>' +
				'<line x1="12" y1="28" x2="12" y2="34" stroke="#c96" stroke-width="2"/>' +
				'<line x1="20" y1="28" x2="20" y2="34" stroke="#c96" stroke-width="2"/>' +
				'<line x1="28" y1="28" x2="28" y2="34" stroke="#c96" stroke-width="2"/>' +
				'<path d="M8,20 Q4,14 6,11" fill="none" stroke="#c96" stroke-width="2.4"/></svg>',
			guineapig3d:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<ellipse cx="26" cy="22" rx="16" ry="9" fill="#d9a"/>' +
				'<ellipse cx="38" cy="19" rx="6" ry="5" fill="#d9a"/>' +
				'<ellipse cx="34" cy="13" rx="2.5" ry="2" fill="#a76"/>' +
				'<ellipse cx="40" cy="13" rx="2.5" ry="2" fill="#a76"/>' +
				'<circle cx="39" cy="20" r=".8" fill="#111"/>' +
				'<circle cx="43" cy="20" r=".8" fill="#111"/>' +
				'<ellipse cx="44" cy="22" rx="1.3" ry="1" fill="#322"/>' +
				'<line x1="15" y1="30" x2="15" y2="34" stroke="#d9a" stroke-width="2"/>' +
				'<line x1="23" y1="30" x2="23" y2="34" stroke="#d9a" stroke-width="2"/>' +
				'<line x1="31" y1="30" x2="31" y2="34" stroke="#d9a" stroke-width="2"/></svg>',
			pointwave:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect width="50" height="36" fill="#050018"/>' +
				'<g fill="#4af">' +
				'<circle cx="6"  cy="22" r="0.8"/><circle cx="12" cy="18" r="0.9"/>' +
				'<circle cx="18" cy="14" r="1"/>  <circle cx="24" cy="12" r="1.2"/>' +
				'<circle cx="30" cy="14" r="1"/>  <circle cx="36" cy="18" r="0.9"/>' +
				'<circle cx="42" cy="22" r="0.8"/>' +
				'<circle cx="6"  cy="28" r="0.8"/><circle cx="12" cy="26" r="0.9"/>' +
				'<circle cx="18" cy="22" r="1"/>  <circle cx="24" cy="20" r="1.2"/>' +
				'<circle cx="30" cy="22" r="1"/>  <circle cx="36" cy="26" r="0.9"/>' +
				'<circle cx="42" cy="28" r="0.8"/>' +
				'</g>' +
				'<g fill="#a4f">' +
				'<circle cx="18" cy="14" r="0.5"/><circle cx="24" cy="12" r="0.6"/>' +
				'<circle cx="30" cy="14" r="0.5"/></g></svg>'
		};

		let grid = document.createElement("div");
		grid.id = "opt-design-grid";
		grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:4px 0 8px;";

		function applyDesign(design) {
			Visual.currentDesign = design;
			UrlParams.SetParam("design", design);
			// Polygon sides row
			let sr = document.getElementById("opt-sides-row");
			if (sr) sr.style.display = design === "polygon" ? "" : "none";
			// Water rows
			let showWater = design === "water";
			let ids = ["opt-water-row", "opt-tension-row", "opt-spread-row"];
			for (let i = 0; i < ids.length; i++) {
				let el = document.getElementById(ids[i]);
				if (el) el.style.display = showWater ? "" : "none";
			}
			// Liquid sphere rows
			let showLiquid = design === "liquidsphere";
			let lids = ["opt-liq-visc-row", "opt-liq-dens-row"];
			for (let i = 0; i < lids.length; i++) {
				let el = document.getElementById(lids[i]);
				if (el) el.style.display = showLiquid ? "" : "none";
			}
			// Lyric particles count + curvature sliders
			let lcEl = document.getElementById("opt-lyric-count-row");
			if (lcEl) lcEl.style.display = design === "lyricparticles" ? "" : "none";
			let lcvEl = document.getElementById("opt-lyric-curve-row");
			if (lcvEl) lcvEl.style.display = design === "lyricparticles" ? "" : "none";
			// Record-player plate text input
			let rtEl = document.getElementById("opt-record-text-row");
			if (rtEl) rtEl.style.display = design === "recordplayer" ? "" : "none";
			// 3D rows + lighting section
			let show3D = Visualizer3D.is3D(design);
			let dids = ["opt-3d-cammode-row", "opt-3d-orbit-row"];
			for (let i = 0; i < dids.length; i++) {
				let el = document.getElementById(dids[i]);
				if (el) el.style.display = show3D ? "" : "none";
			}
			let ls = document.getElementById("opt-3d-lighting-section");
			if (ls) ls.style.display = show3D ? "" : "none";
			// Sync inline design select (if still present)
			let inlineDesign = document.getElementById("design");
			if (inlineDesign) inlineDesign.value = design;
			// Update active state in grid
			let cells = grid.querySelectorAll(".opt-dc");
			for (let i = 0; i < cells.length; i++) {
				let isActive = cells[i].getAttribute("data-design") === design;
				cells[i].style.borderColor = isActive ? "#4af" : "transparent";
				cells[i].style.background = isActive ? "rgba(68,170,255,0.15)" : "rgba(255,255,255,0.05)";
			}
		}

		for (let i = 0; i < designs.length; i++) {
			let d = designs[i];
			let cell = document.createElement("div");
			cell.className = "opt-dc";
			cell.setAttribute("data-design", d.value);
			let isActive = d.value === currentDesign;
			cell.style.cssText =
				"position:relative;" +
				"border-radius:6px;" +
				"border:2px solid " + (isActive ? "#4af" : "transparent") + ";" +
				"background:" + (isActive ? "rgba(68,170,255,0.15)" : "rgba(255,255,255,0.05)") + ";" +
				"cursor:pointer;" +
				"padding:5px 4px 3px;" +
				"display:flex;" +
				"flex-direction:column;" +
				"align-items:center;" +
				"gap:3px;" +
				"overflow:hidden;" +
				"transition:border-color .12s,background .12s;";

			cell.addEventListener("mouseover", function () {
				if (cell.getAttribute("data-design") !== Visual.currentDesign)
					cell.style.background = "rgba(255,255,255,0.1)";
			});
			cell.addEventListener("mouseout", function () {
				if (cell.getAttribute("data-design") !== Visual.currentDesign)
					cell.style.background = "rgba(255,255,255,0.05)";
			});

			let svgWrap = document.createElement("div");
			svgWrap.style.cssText = "width:100%;line-height:0;border-radius:3px;overflow:hidden;";
			svgWrap.innerHTML = thumbs[d.value] ||
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 36">' +
				'<rect x="5" y="5" width="40" height="26" fill="none" stroke="#4af" stroke-width="1.5" rx="2"/></svg>';
			cell.appendChild(svgWrap);

			let lbl = document.createElement("span");
			lbl.style.cssText = "font-size:9px;text-align:center;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;padding:0 2px;box-sizing:border-box;display:block;";
			lbl.textContent = d.label;
			cell.appendChild(lbl);

			// Dimension ribbon (top-right corner). 3D is gold/amber, 2D is
			// teal — quick visual at-a-glance label.
			let ribbon = document.createElement("span");
			let is3 = d.dim === "3D";
			ribbon.textContent = d.dim;
			ribbon.style.cssText =
				"position:absolute;" +
				"top:6px;" +
				"right:-16px;" +
				"transform:rotate(35deg);" +
				"background:" + (is3 ? "linear-gradient(135deg,#ffb547,#ff7a1a)" : "linear-gradient(135deg,#4ad1ff,#3a8fe0)") + ";" +
				"color:#fff;" +
				"font-size:8px;" +
				"font-weight:700;" +
				"letter-spacing:0.5px;" +
				"padding:1px 16px;" +
				"box-shadow:0 1px 3px rgba(0,0,0,0.4);" +
				"pointer-events:none;" +
				"text-shadow:0 1px 1px rgba(0,0,0,0.4);" +
				"font-family:sans-serif;";
			cell.appendChild(ribbon);

			(function (design) {
				cell.addEventListener("click", function () { applyDesign(design); });
			}(d.value));

			grid.appendChild(cell);
		}

		return grid;
	}

	/**
	 * Formats seconds as m:ss or h:mm:ss.
	 * @param {number} seconds
	 * @returns {string}
	 */
	static #formatTime(seconds) {
		if (!isFinite(seconds) || seconds < 0) return "0:00";
		let s = Math.floor(seconds);
		let h = Math.floor(s / 3600);
		let m = Math.floor((s % 3600) / 60);
		let sec = s % 60;
		let secStr = sec < 10 ? "0" + sec : String(sec);
		if (h > 0) {
			let minStr = m < 10 ? "0" + m : String(m);
			return h + ":" + minStr + ":" + secStr;
		}
		return m + ":" + secStr;
	}
}
