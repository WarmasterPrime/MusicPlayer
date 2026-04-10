/**
 * ColorPicker - A full-featured HSV color picker.
 *
 * Usage:
 *   import { ColorPicker } from './ColorPicker.mjs';
 *   ColorPicker.open(
 *     { r: 255, g: 100, b: 50 },
 *     (color) => console.log('changed', color),
 *     () => console.log('closed')
 *   );
 */
export class ColorPicker {

	// ---------------------------------------------------------------
	//  Singleton state
	// ---------------------------------------------------------------
	static #overlay = null;
	static #built = false;
	static #onColorChange = null;
	static #onClose = null;

	// Current color in HSV + alpha
	static #h = 0;   // 0-360
	static #s = 1;   // 0-1
	static #v = 1;   // 0-1
	static #a = 1;   // 0-1

	// DOM references
	static #els = {};

	// Canvas sizes
	static #SV_W = 288;
	static #SV_H = 200;
	static #STRIP_W = 0; // calculated on build
	static #STRIP_H = 18;

	// Drag state
	static #dragging = null; // 'sv' | 'hue' | 'alpha' | 'move'
	static #dragOffset = { x: 0, y: 0 };

	// History
	static #HISTORY_KEY = 'mp-color-history';
	static #MAX_HISTORY = 20;

	// ---------------------------------------------------------------
	//  Public API
	// ---------------------------------------------------------------

	/**
	 * Opens the color picker.
	 * @param {{ r: number, g: number, b: number, a?: number }} currentColor
	 * @param {function({ r: number, g: number, b: number, a?: number }): void} onColorChange
	 * @param {function(): void} [onClose]
	 */
	static open(currentColor, onColorChange, onClose) {
		if (!ColorPicker.#built) ColorPicker.#build();

		ColorPicker.#onColorChange = onColorChange || null;
		ColorPicker.#onClose = onClose || null;

		// Parse incoming color
		const r = ColorPicker.#clamp(currentColor?.r ?? 255, 0, 255);
		const g = ColorPicker.#clamp(currentColor?.g ?? 255, 0, 255);
		const b = ColorPicker.#clamp(currentColor?.b ?? 255, 0, 255);
		const a = currentColor?.a !== undefined ? ColorPicker.#clamp(currentColor.a, 0, 1) : 1;

		const hsv = ColorPicker.#rgbToHsv(r, g, b);
		ColorPicker.#h = hsv.h;
		ColorPicker.#s = hsv.s;
		ColorPicker.#v = hsv.v;
		ColorPicker.#a = a;

		ColorPicker.#renderAll();
		ColorPicker.#loadHistory();

		// Center picker
		const container = ColorPicker.#els.container;
		container.style.left = '';
		container.style.top = '';
		container.style.transform = '';

		ColorPicker.#overlay.classList.add('cp-visible');
	}

	/**
	 * Closes the picker programmatically.
	 */
	static close() {
		if (!ColorPicker.#overlay) return;
		ColorPicker.#saveCurrentToHistory();
		ColorPicker.#overlay.classList.remove('cp-visible');
		if (ColorPicker.#onClose) ColorPicker.#onClose();
		ColorPicker.#onColorChange = null;
		ColorPicker.#onClose = null;
	}

	// ---------------------------------------------------------------
	//  DOM Construction
	// ---------------------------------------------------------------

	static #build() {
		// Overlay
		const overlay = document.createElement('div');
		overlay.id = 'color-picker-modal';
		ColorPicker.#overlay = overlay;

		// Container
		const container = document.createElement('div');
		container.className = 'cp-container';
		overlay.appendChild(container);
		ColorPicker.#els.container = container;

		// Header
		const header = document.createElement('div');
		header.className = 'cp-header';

		const title = document.createElement('div');
		title.className = 'cp-title';
		title.textContent = 'Color';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'cp-close';
		closeBtn.textContent = '\u00D7';
		closeBtn.addEventListener('click', () => ColorPicker.close());

		header.appendChild(title);
		header.appendChild(closeBtn);
		container.appendChild(header);

		// SV Area
		const svArea = document.createElement('div');
		svArea.className = 'cp-sv-area';

		const svCanvas = document.createElement('canvas');
		svCanvas.className = 'cp-sv-canvas';
		svCanvas.width = ColorPicker.#SV_W;
		svCanvas.height = ColorPicker.#SV_H;
		ColorPicker.#els.svCanvas = svCanvas;

		const svCursor = document.createElement('div');
		svCursor.className = 'cp-sv-cursor';
		ColorPicker.#els.svCursor = svCursor;

		svArea.appendChild(svCanvas);
		svArea.appendChild(svCursor);
		container.appendChild(svArea);
		ColorPicker.#els.svArea = svArea;

		// Sliders row
		const sliders = document.createElement('div');
		sliders.className = 'cp-sliders';

		// Hue strip
		const hueWrap = document.createElement('div');
		hueWrap.className = 'cp-hue-wrap';

		const hueCanvas = document.createElement('canvas');
		hueCanvas.className = 'cp-hue-canvas';
		hueCanvas.height = ColorPicker.#STRIP_H;
		ColorPicker.#els.hueCanvas = hueCanvas;

		const hueThumb = document.createElement('div');
		hueThumb.className = 'cp-hue-thumb';
		ColorPicker.#els.hueThumb = hueThumb;

		hueWrap.appendChild(hueCanvas);
		hueWrap.appendChild(hueThumb);
		sliders.appendChild(hueWrap);
		ColorPicker.#els.hueWrap = hueWrap;

		// Alpha strip
		const alphaWrap = document.createElement('div');
		alphaWrap.className = 'cp-alpha-wrap';

		const alphaCanvas = document.createElement('canvas');
		alphaCanvas.className = 'cp-alpha-canvas';
		alphaCanvas.height = ColorPicker.#STRIP_H;
		ColorPicker.#els.alphaCanvas = alphaCanvas;

		const alphaThumb = document.createElement('div');
		alphaThumb.className = 'cp-alpha-thumb';
		ColorPicker.#els.alphaThumb = alphaThumb;

		alphaWrap.appendChild(alphaCanvas);
		alphaWrap.appendChild(alphaThumb);
		sliders.appendChild(alphaWrap);
		ColorPicker.#els.alphaWrap = alphaWrap;

		container.appendChild(sliders);

		// Controls row: preview + inputs
		const controls = document.createElement('div');
		controls.className = 'cp-controls';

		// Preview
		const preview = document.createElement('div');
		preview.className = 'cp-preview';
		const previewInner = document.createElement('div');
		previewInner.className = 'cp-preview-inner';
		preview.appendChild(previewInner);
		controls.appendChild(preview);
		ColorPicker.#els.preview = previewInner;

		// Inputs
		const inputs = document.createElement('div');
		inputs.className = 'cp-inputs';

		const hexCol = ColorPicker.#makeInputCol('Hex', 'text', 'cp-hex-col');
		ColorPicker.#els.hexInput = hexCol.input;
		hexCol.input.maxLength = 7;
		inputs.appendChild(hexCol.col);

		const rCol = ColorPicker.#makeInputCol('R', 'number');
		ColorPicker.#els.rInput = rCol.input;
		rCol.input.min = '0'; rCol.input.max = '255';
		inputs.appendChild(rCol.col);

		const gCol = ColorPicker.#makeInputCol('G', 'number');
		ColorPicker.#els.gInput = gCol.input;
		gCol.input.min = '0'; gCol.input.max = '255';
		inputs.appendChild(gCol.col);

		const bCol = ColorPicker.#makeInputCol('B', 'number');
		ColorPicker.#els.bInput = bCol.input;
		bCol.input.min = '0'; bCol.input.max = '255';
		inputs.appendChild(bCol.col);

		const aCol = ColorPicker.#makeInputCol('A', 'number', 'cp-alpha-col');
		ColorPicker.#els.aInput = aCol.input;
		aCol.input.min = '0'; aCol.input.max = '100';
		inputs.appendChild(aCol.col);

		controls.appendChild(inputs);
		container.appendChild(controls);

		// History
		const histSection = document.createElement('div');
		histSection.className = 'cp-history-section';

		const histLabel = document.createElement('div');
		histLabel.className = 'cp-history-label';
		histLabel.textContent = 'Recent';

		const histGrid = document.createElement('div');
		histGrid.className = 'cp-history-grid';
		ColorPicker.#els.historyGrid = histGrid;

		histSection.appendChild(histLabel);
		histSection.appendChild(histGrid);
		container.appendChild(histSection);

		document.body.appendChild(overlay);

		// Events
		ColorPicker.#attachEvents(svArea, hueWrap, alphaWrap, header);

		ColorPicker.#built = true;
	}

	/**
	 * Creates a labeled input column.
	 */
	static #makeInputCol(label, type, extraClass) {
		const col = document.createElement('div');
		col.className = 'cp-input-col' + (extraClass ? ' ' + extraClass : '');

		const lbl = document.createElement('div');
		lbl.className = 'cp-input-label';
		lbl.textContent = label;

		const input = document.createElement('input');
		input.className = 'cp-input';
		input.type = type;
		if (type === 'number') input.inputMode = 'numeric';

		col.appendChild(lbl);
		col.appendChild(input);
		return { col, input };
	}

	// ---------------------------------------------------------------
	//  Event wiring
	// ---------------------------------------------------------------

	static #attachEvents(svArea, hueWrap, alphaWrap, header) {
		// SV area
		const svDown = (e) => {
			e.preventDefault();
			ColorPicker.#dragging = 'sv';
			ColorPicker.#handleSV(e);
		};
		svArea.addEventListener('mousedown', svDown);
		svArea.addEventListener('touchstart', svDown, { passive: false });

		// Hue strip
		const hueDown = (e) => {
			e.preventDefault();
			ColorPicker.#dragging = 'hue';
			ColorPicker.#handleHue(e);
		};
		hueWrap.addEventListener('mousedown', hueDown);
		hueWrap.addEventListener('touchstart', hueDown, { passive: false });

		// Alpha strip
		const alphaDown = (e) => {
			e.preventDefault();
			ColorPicker.#dragging = 'alpha';
			ColorPicker.#handleAlpha(e);
		};
		alphaWrap.addEventListener('mousedown', alphaDown);
		alphaWrap.addEventListener('touchstart', alphaDown, { passive: false });

		// Draggable header
		header.addEventListener('mousedown', (e) => {
			if (e.target.closest('.cp-close')) return;
			ColorPicker.#dragging = 'move';
			const rect = ColorPicker.#els.container.getBoundingClientRect();
			ColorPicker.#dragOffset.x = e.clientX - rect.left;
			ColorPicker.#dragOffset.y = e.clientY - rect.top;
			e.preventDefault();
		});
		header.addEventListener('touchstart', (e) => {
			if (e.target.closest('.cp-close')) return;
			ColorPicker.#dragging = 'move';
			const rect = ColorPicker.#els.container.getBoundingClientRect();
			const t = e.touches[0];
			ColorPicker.#dragOffset.x = t.clientX - rect.left;
			ColorPicker.#dragOffset.y = t.clientY - rect.top;
			e.preventDefault();
		}, { passive: false });

		// Global move / up
		const onMove = (e) => {
			if (!ColorPicker.#dragging) return;
			e.preventDefault();
			switch (ColorPicker.#dragging) {
				case 'sv': ColorPicker.#handleSV(e); break;
				case 'hue': ColorPicker.#handleHue(e); break;
				case 'alpha': ColorPicker.#handleAlpha(e); break;
				case 'move': ColorPicker.#handleMove(e); break;
			}
		};
		const onUp = () => { ColorPicker.#dragging = null; };

		document.addEventListener('mousemove', onMove);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('mouseup', onUp);
		document.addEventListener('touchend', onUp);

		// Overlay click to close
		ColorPicker.#overlay.addEventListener('mousedown', (e) => {
			if (e.target === ColorPicker.#overlay) ColorPicker.close();
		});

		// Input events
		ColorPicker.#els.hexInput.addEventListener('input', ColorPicker.#onHexInput);
		ColorPicker.#els.rInput.addEventListener('input', ColorPicker.#onRGBInput);
		ColorPicker.#els.gInput.addEventListener('input', ColorPicker.#onRGBInput);
		ColorPicker.#els.bInput.addEventListener('input', ColorPicker.#onRGBInput);
		ColorPicker.#els.aInput.addEventListener('input', ColorPicker.#onAlphaInput);

		// Keyboard: Escape to close
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && ColorPicker.#overlay?.classList.contains('cp-visible')) {
				ColorPicker.close();
			}
		});
	}

	// ---------------------------------------------------------------
	//  Interaction handlers
	// ---------------------------------------------------------------

	static #clientPos(e) {
		if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
		return { x: e.clientX, y: e.clientY };
	}

	static #handleSV(e) {
		const rect = ColorPicker.#els.svArea.getBoundingClientRect();
		const pos = ColorPicker.#clientPos(e);
		const x = ColorPicker.#clamp(pos.x - rect.left, 0, rect.width);
		const y = ColorPicker.#clamp(pos.y - rect.top, 0, rect.height);
		ColorPicker.#s = x / rect.width;
		ColorPicker.#v = 1 - (y / rect.height);
		ColorPicker.#renderAll();
		ColorPicker.#emitChange();
	}

	static #handleHue(e) {
		const rect = ColorPicker.#els.hueWrap.getBoundingClientRect();
		const pos = ColorPicker.#clientPos(e);
		const x = ColorPicker.#clamp(pos.x - rect.left, 0, rect.width);
		ColorPicker.#h = (x / rect.width) * 360;
		ColorPicker.#renderAll();
		ColorPicker.#emitChange();
	}

	static #handleAlpha(e) {
		const rect = ColorPicker.#els.alphaWrap.getBoundingClientRect();
		const pos = ColorPicker.#clientPos(e);
		const x = ColorPicker.#clamp(pos.x - rect.left, 0, rect.width);
		ColorPicker.#a = x / rect.width;
		ColorPicker.#renderAll();
		ColorPicker.#emitChange();
	}

	static #handleMove(e) {
		const pos = ColorPicker.#clientPos(e);
		const container = ColorPicker.#els.container;
		const newX = pos.x - ColorPicker.#dragOffset.x;
		const newY = pos.y - ColorPicker.#dragOffset.y;
		container.style.position = 'fixed';
		container.style.left = newX + 'px';
		container.style.top = newY + 'px';
		container.style.transform = 'none';
		container.style.margin = '0';
	}

	// Input handlers
	static #onHexInput = () => {
		let val = ColorPicker.#els.hexInput.value.trim();
		if (!val.startsWith('#')) val = '#' + val;
		if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
			const r = parseInt(val.slice(1, 3), 16);
			const g = parseInt(val.slice(3, 5), 16);
			const b = parseInt(val.slice(5, 7), 16);
			const hsv = ColorPicker.#rgbToHsv(r, g, b);
			ColorPicker.#h = hsv.h;
			ColorPicker.#s = hsv.s;
			ColorPicker.#v = hsv.v;
			ColorPicker.#renderAll(true);
			ColorPicker.#emitChange();
		}
	};

	static #onRGBInput = () => {
		const r = ColorPicker.#clamp(parseInt(ColorPicker.#els.rInput.value) || 0, 0, 255);
		const g = ColorPicker.#clamp(parseInt(ColorPicker.#els.gInput.value) || 0, 0, 255);
		const b = ColorPicker.#clamp(parseInt(ColorPicker.#els.bInput.value) || 0, 0, 255);
		const hsv = ColorPicker.#rgbToHsv(r, g, b);
		ColorPicker.#h = hsv.h;
		ColorPicker.#s = hsv.s;
		ColorPicker.#v = hsv.v;
		ColorPicker.#renderAll(true);
		ColorPicker.#emitChange();
	};

	static #onAlphaInput = () => {
		const pct = ColorPicker.#clamp(parseInt(ColorPicker.#els.aInput.value) || 0, 0, 100);
		ColorPicker.#a = pct / 100;
		ColorPicker.#renderAll(true);
		ColorPicker.#emitChange();
	};

	// ---------------------------------------------------------------
	//  Rendering
	// ---------------------------------------------------------------

	static #renderAll(skipInputs = false) {
		ColorPicker.#drawSV();
		ColorPicker.#drawHue();
		ColorPicker.#drawAlpha();
		ColorPicker.#updateCursors();
		ColorPicker.#updatePreview();
		if (!skipInputs) ColorPicker.#updateInputs();
	}

	/** Draw the saturation/brightness gradient for the current hue. */
	static #drawSV() {
		const canvas = ColorPicker.#els.svCanvas;
		const ctx = canvas.getContext('2d');
		const w = canvas.width;
		const h = canvas.height;

		// Base hue color at full saturation and brightness
		const hueRgb = ColorPicker.#hsvToRgb(ColorPicker.#h, 1, 1);
		const hueColor = `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`;

		// Fill with hue
		ctx.fillStyle = hueColor;
		ctx.fillRect(0, 0, w, h);

		// White gradient left-to-right (saturation)
		const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
		whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
		whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = whiteGrad;
		ctx.fillRect(0, 0, w, h);

		// Black gradient top-to-bottom (brightness)
		const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
		blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
		blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
		ctx.fillStyle = blackGrad;
		ctx.fillRect(0, 0, w, h);
	}

	/** Draw horizontal hue rainbow strip. */
	static #drawHue() {
		const canvas = ColorPicker.#els.hueCanvas;
		const rect = ColorPicker.#els.hueWrap.getBoundingClientRect();
		const w = Math.max(Math.round(rect.width), 100);
		canvas.width = w;
		ColorPicker.#STRIP_W = w;

		const ctx = canvas.getContext('2d');
		const grad = ctx.createLinearGradient(0, 0, w, 0);
		const stops = [0, 60, 120, 180, 240, 300, 360];
		for (const deg of stops) {
			const rgb = ColorPicker.#hsvToRgb(deg, 1, 1);
			grad.addColorStop(deg / 360, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
		}
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, ColorPicker.#STRIP_H);
	}

	/** Draw horizontal alpha strip. */
	static #drawAlpha() {
		const canvas = ColorPicker.#els.alphaCanvas;
		const rect = ColorPicker.#els.alphaWrap.getBoundingClientRect();
		const w = Math.max(Math.round(rect.width), 100);
		canvas.width = w;
		const h = ColorPicker.#STRIP_H;

		const ctx = canvas.getContext('2d');

		// Checkerboard background
		const size = 6;
		for (let x = 0; x < w; x += size) {
			for (let y = 0; y < h; y += size) {
				const isOdd = ((x / size + y / size) | 0) % 2;
				ctx.fillStyle = isOdd ? '#444' : '#666';
				ctx.fillRect(x, y, size, size);
			}
		}

		// Color gradient overlay
		const rgb = ColorPicker.#hsvToRgb(ColorPicker.#h, ColorPicker.#s, ColorPicker.#v);
		const grad = ctx.createLinearGradient(0, 0, w, 0);
		grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
		grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	}

	/** Position the cursors / thumbs to reflect current HSV+A. */
	static #updateCursors() {
		// SV cursor
		const svArea = ColorPicker.#els.svArea;
		const svRect = svArea.getBoundingClientRect();
		const svX = ColorPicker.#s * svRect.width;
		const svY = (1 - ColorPicker.#v) * svRect.height;
		ColorPicker.#els.svCursor.style.left = svX + 'px';
		ColorPicker.#els.svCursor.style.top = svY + 'px';

		// Hue thumb
		const hueRect = ColorPicker.#els.hueWrap.getBoundingClientRect();
		const hueX = (ColorPicker.#h / 360) * hueRect.width;
		ColorPicker.#els.hueThumb.style.left = hueX + 'px';

		// Alpha thumb
		const alphaRect = ColorPicker.#els.alphaWrap.getBoundingClientRect();
		const alphaX = ColorPicker.#a * alphaRect.width;
		ColorPicker.#els.alphaThumb.style.left = alphaX + 'px';
	}

	/** Update the preview swatch. */
	static #updatePreview() {
		const rgb = ColorPicker.#hsvToRgb(ColorPicker.#h, ColorPicker.#s, ColorPicker.#v);
		ColorPicker.#els.preview.style.backgroundColor =
			`rgba(${rgb.r},${rgb.g},${rgb.b},${ColorPicker.#a})`;
	}

	/** Sync input fields from current HSV state. */
	static #updateInputs() {
		const rgb = ColorPicker.#hsvToRgb(ColorPicker.#h, ColorPicker.#s, ColorPicker.#v);
		ColorPicker.#els.hexInput.value = ColorPicker.#rgbToHex(rgb.r, rgb.g, rgb.b);
		ColorPicker.#els.rInput.value = rgb.r;
		ColorPicker.#els.gInput.value = rgb.g;
		ColorPicker.#els.bInput.value = rgb.b;
		ColorPicker.#els.aInput.value = Math.round(ColorPicker.#a * 100);
	}

	// ---------------------------------------------------------------
	//  Emit color change
	// ---------------------------------------------------------------

	static #emitChange() {
		if (!ColorPicker.#onColorChange) return;
		const rgb = ColorPicker.#hsvToRgb(ColorPicker.#h, ColorPicker.#s, ColorPicker.#v);
		ColorPicker.#onColorChange({
			r: rgb.r,
			g: rgb.g,
			b: rgb.b,
			a: Math.round(ColorPicker.#a * 100) / 100
		});
	}

	// ---------------------------------------------------------------
	//  History
	// ---------------------------------------------------------------

	static #loadHistory() {
		const grid = ColorPicker.#els.historyGrid;
		grid.innerHTML = '';

		const history = ColorPicker.#getHistory();
		if (history.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'cp-history-empty';
			empty.textContent = 'No recent colors';
			grid.appendChild(empty);
			return;
		}

		for (const hex of history) {
			const swatch = document.createElement('div');
			swatch.className = 'cp-history-swatch';
			swatch.style.backgroundColor = hex;
			swatch.title = hex;
			swatch.addEventListener('click', () => {
				const parsed = ColorPicker.#hexToRgb(hex);
				if (parsed) {
					const hsv = ColorPicker.#rgbToHsv(parsed.r, parsed.g, parsed.b);
					ColorPicker.#h = hsv.h;
					ColorPicker.#s = hsv.s;
					ColorPicker.#v = hsv.v;
					ColorPicker.#a = 1;
					ColorPicker.#renderAll();
					ColorPicker.#emitChange();
				}
			});
			grid.appendChild(swatch);
		}
	}

	static #saveCurrentToHistory() {
		const rgb = ColorPicker.#hsvToRgb(ColorPicker.#h, ColorPicker.#s, ColorPicker.#v);
		const hex = ColorPicker.#rgbToHex(rgb.r, rgb.g, rgb.b);
		let history = ColorPicker.#getHistory();

		// Remove duplicate if present
		history = history.filter(h => h.toLowerCase() !== hex.toLowerCase());

		// Add to front
		history.unshift(hex);

		// Trim
		if (history.length > ColorPicker.#MAX_HISTORY) {
			history = history.slice(0, ColorPicker.#MAX_HISTORY);
		}

		try {
			localStorage.setItem(ColorPicker.#HISTORY_KEY, JSON.stringify(history));
		} catch (_) { /* storage full or unavailable */ }
	}

	static #getHistory() {
		try {
			const raw = localStorage.getItem(ColorPicker.#HISTORY_KEY);
			if (raw) {
				const arr = JSON.parse(raw);
				if (Array.isArray(arr)) return arr.filter(s => typeof s === 'string');
			}
		} catch (_) { /* ignore */ }
		return [];
	}

	// ---------------------------------------------------------------
	//  Color conversion utilities
	// ---------------------------------------------------------------

	/**
	 * HSV to RGB.
	 * @param {number} h  0-360
	 * @param {number} s  0-1
	 * @param {number} v  0-1
	 * @returns {{ r: number, g: number, b: number }}
	 */
	static #hsvToRgb(h, s, v) {
		h = ((h % 360) + 360) % 360;
		const c = v * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = v - c;
		let r = 0, g = 0, b = 0;

		if (h < 60)       { r = c; g = x; b = 0; }
		else if (h < 120) { r = x; g = c; b = 0; }
		else if (h < 180) { r = 0; g = c; b = x; }
		else if (h < 240) { r = 0; g = x; b = c; }
		else if (h < 300) { r = x; g = 0; b = c; }
		else              { r = c; g = 0; b = x; }

		return {
			r: Math.round((r + m) * 255),
			g: Math.round((g + m) * 255),
			b: Math.round((b + m) * 255)
		};
	}

	/**
	 * RGB to HSV.
	 * @param {number} r  0-255
	 * @param {number} g  0-255
	 * @param {number} b  0-255
	 * @returns {{ h: number, s: number, v: number }}
	 */
	static #rgbToHsv(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;

		let h = 0;
		if (d !== 0) {
			if (max === r)      h = 60 * (((g - b) / d) % 6);
			else if (max === g) h = 60 * (((b - r) / d) + 2);
			else                h = 60 * (((r - g) / d) + 4);
		}
		if (h < 0) h += 360;

		const s = max === 0 ? 0 : d / max;
		return { h, s, v: max };
	}

	/**
	 * RGB to hex string.
	 * @param {number} r
	 * @param {number} g
	 * @param {number} b
	 * @returns {string}
	 */
	static #rgbToHex(r, g, b) {
		const toHex = (n) => n.toString(16).padStart(2, '0');
		return '#' + toHex(r) + toHex(g) + toHex(b);
	}

	/**
	 * Hex string to RGB.
	 * @param {string} hex
	 * @returns {{ r: number, g: number, b: number } | null}
	 */
	static #hexToRgb(hex) {
		if (!hex) return null;
		hex = hex.replace(/^#/, '');
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		if (hex.length !== 6) return null;
		const n = parseInt(hex, 16);
		if (isNaN(n)) return null;
		return {
			r: (n >> 16) & 0xFF,
			g: (n >> 8) & 0xFF,
			b: n & 0xFF
		};
	}

	/**
	 * Clamp a number between min and max.
	 */
	static #clamp(val, min, max) {
		if (val < min) return min;
		if (val > max) return max;
		return val;
	}
}
