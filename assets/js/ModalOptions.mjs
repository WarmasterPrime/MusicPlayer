import { Visual } from "./Visualizer.mjs";
import { UrlParams } from "./UrlParams.mjs";
import { ColorPicker } from "./ColorPicker.mjs";

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
			{ id: "effects", label: "Effects" }
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
			effects: ModalOptions.#buildEffectsPanel()
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
			if (panels[i].getAttribute("data-panel") === tabId)
				panels[i].classList.add("active");
			else
				panels[i].classList.remove("active");
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

		// Design dropdown
		let designRow = ModalOptions.#createRow("Style");
		let designSelect = ModalOptions.#createSelect("opt-design", [
			{ value: "bar", label: "Bar" },
			{ value: "line", label: "Line" },
			{ value: "verticalLines", label: "Vertical Lines" },
			{ value: "curvedLines", label: "Curved Lines" },
			{ value: "circle", label: "Circle" },
			{ value: "polygon", label: "Polygon" }
		], Visual.currentDesign);
		ModalOptions.#els.design = designSelect;
		designRow.appendChild(designSelect);
		designSection.appendChild(designRow);

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

		// Design change handler
		designSelect.addEventListener("change", function () {
			Visual.currentDesign = designSelect.value;
			UrlParams.SetParam("design", designSelect.value);
			let row = document.getElementById("opt-sides-row");
			if (row) row.style.display = designSelect.value === "polygon" ? "" : "none";
			// Sync inline dropdown
			let inlineDesign = document.getElementById("design");
			if (inlineDesign) inlineDesign.value = designSelect.value;
		});

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

		panel.appendChild(playbackSection);

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

		// Sphere toggle
		let sphereRow = ModalOptions.#createRow("Sphere");
		let sphereToggle = ModalOptions.#createToggle("opt-sphere", ModalOptions.#isSphereVisible(), function (checked) {
			let objElm = document.getElementById("obj");
			if (objElm) objElm.style.display = checked ? "block" : "none";
			if (ModalOptions.#bgStateCallback) ModalOptions.#bgStateCallback(checked);
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

		// Visual tab
		if (els.design) els.design.value = Visual.currentDesign;
		if (els.polygonSides) els.polygonSides.value = String(Visual.polygonSides);
		let sidesRow = document.getElementById("opt-sides-row");
		if (sidesRow) sidesRow.style.display = Visual.currentDesign === "polygon" ? "" : "none";

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
