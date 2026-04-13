import { Color } from "./Color.mjs";
import { ProgressBar } from "./ProgressBar.mjs";
import { SongInfo } from "./SongInfo.mjs";
import { Lyrics } from "./Lyrics.mjs";
import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";
import { Sys } from "./Sys.mjs";
import { Visualizer3D } from "./Visualizer3D.mjs";
import { setup as setupBG } from "./ext/Main.mjs";

/**
 * Module-level visualizer state object.
 */
let viz = {};

/**
 * Whether the visualizer has been initialized.
 */
let initialized = false;

/**
 * Whether the sphere/new BG movement is enabled.
 */
export let newBGState = true;

/**
 * Sets the newBGState flag.
 * @param {boolean} value - The new state.
 */
export function setNewBGState(value) {
	newBGState = value;
}

/**
 * Controls the audio visualization and performs canvas rendering operations.
 * Color values are normalized to 0-255 range throughout.
 */
export class Visual {

	static last_measurement = 0;
	static base_speed = 60;
	static paused = true;
	static ghost = false;
	static progressBarVisible = true;
	static cbg = true;
	static lyricsEnabled = true;
	static audioAccuracy = 512;
	static xOffset = -1;
	static progBarElm;
	static polygonSides = 6;

	/**
	 * The background color configuration for the hexagon grid.
	 */
	static cbg_ovr = {
		"r": 255,
		"g": 0,
		"b": 100,
		"a": 0.5
	};

	/**
	 * The current visualization design type.
	 */
	static currentDesign = "bar";

	/** Particle state for snow/rain designs. */
	static #snowParticles = [];
	static #rainParticles = [];
	/** Lightning bolt segments, rebuilt each frame. */
	static #lightningBolts = [];
	/** Tetris block state. */
	static #tetrisBlocks = [];
	static #tetrisTimer = 0;
	/** Water simulation columns (height map). */
	static #waterColumns = [];
	static #waterVelocity = [];
	static #waterDroplets = [];
	static waterViscosity = 0.92;
	static waterTension = 0.025;
	static waterSpread = 0.25;

	/** Track last-activated 3D design for change detection. */
	static #last3DDesign = "";

	/**
	 * Whether to fill the polygon shape in line/curve designs.
	 */
	static fillPolygon = true;

	/**
	 * Color configuration for the visualizer bars. Values normalized to 0-255.
	 */
	static color = {
		color: new Color(255, 0, 100),
		"red": 255,
		"green": 0,
		"blue": 100,
		"fade": false,
		"fades": {
			"r": true,
			"g": false,
			"b": false,
			"start": false,
			"state": 0,
			"inc": 1,
			"max": 255,
			"gmax": 0,
			"bmax": 0,
			"rmax": 0
		},
		"saved": {
			"r": 200,
			"g": 0,
			"b": 55
		}
	};

	static fullTranscript = "";
	static lyrics = {};
	static captionElm = null;

	/**
	 * Active layout configuration.
	 */
	static activeLayout = null;

	/**
	 * A reference to the Player instance. Set by main.mjs.
	 * @type {object|null}
	 */
	static player = null;

	/**
	 * Initializes the visualizer by creating the AudioContext and connecting nodes.
	 */
	static ini() {
		viz.elm = document.getElementById("visualizer");
		viz.ctx = viz.elm.getContext("2d");
		viz.elm.width = window.innerWidth;
		viz.elm.height = window.innerHeight;
		viz.width = viz.elm.width;
		viz.height = viz.elm.height;
		viz.actx = new AudioContext();
		viz.src = viz.actx.createMediaElementSource(document.getElementById("player"));
		viz.ana = viz.actx.createAnalyser();
		viz.src.connect(viz.ana);
		viz.ana.connect(viz.actx.destination);
		viz.ana.fftSize = Visual.audioAccuracy;
		viz.bufferLength = viz.ana.frequencyBinCount;
		viz.dataArray = new Float32Array(viz.bufferLength);
		viz.bar = {
			"width": 1,
			"height": viz.height,
			"color": {
				"r": Visual.color.red,
				"g": Visual.color.green,
				"b": Visual.color.blue,
				"a": 1
			}
		};
		viz.bar.maxHeight = Visual.getMaxHeight();
		viz.bar.width = (window.innerWidth / (viz.bufferLength * 2));
		viz.id = viz.elm.id;
		window.addEventListener("resize", function () {
			Visual.updateRenderDisplay();
		});
		Visual.captionElm = document.getElementById("caption");
		if (Visual.player) {
			Visual.progBarElm = new ProgressBar(viz, viz.ctx, Visual.player);
			Visual.player.progressBarElement = Visual.progBarElm;
		}
	}

	/**
	 * Gets the window width.
	 * @returns {number}
	 */
	static get width() {
		return window.innerWidth;
	}

	/**
	 * Gets the window height.
	 * @returns {number}
	 */
	static get height() {
		return window.innerHeight;
	}

	/**
	 * Updates the FFT accuracy (must be power of 2, 32-32768).
	 * @param {string|number} value - The new accuracy value.
	 */
	static updateAudioAccuracy(value) {
		value = Math.floor(parseFloat(value));
		if (value >= 32 && value <= 32768 && value % 2 === 0 && Visual.isPow2(value)) {
			Visual.audioAccuracy = value;
			viz.ana.fftSize = Visual.audioAccuracy;
			viz.bufferLength = viz.ana.frequencyBinCount;
			viz.dataArray = new Float32Array(viz.bufferLength);
		}
	}

	/**
	 * Checks if a number is a power of 2.
	 * @param {number} n - The number to check.
	 * @returns {boolean}
	 */
	static isPow2(n) {
		if (n <= 0) return false;
		return (n & (n - 1)) === 0;
	}

	/**
	 * Sets the red color value (0-255).
	 * @param {number} q - The red value.
	 */
	static setR(q = false) {
		Visual.color.red = q;
		Visual.updateColor();
	}

	/**
	 * Sets the green color value (0-255).
	 * @param {number} q - The green value.
	 */
	static setG(q = false) {
		Visual.color.green = q;
		Visual.updateColor();
	}

	/**
	 * Sets the blue color value (0-255).
	 * @param {number} q - The blue value.
	 */
	static setB(q = false) {
		Visual.color.blue = q;
		Visual.updateColor();
	}

	static initialLoad = 0;

	/**
	 * Updates the color preview panel element.
	 */
	static updateColorPreview() {
		if (document.getElementById("color-preview"))
			document.getElementById("color-preview").style.backgroundColor = "rgb(" + Visual.color.red + "," + Visual.color.green + "," + Visual.color.blue + ")";
	}

	/**
	 * Updates the sphere gradient to match current colors.
	 */
	static updateCircleObject() {
		if (document.getElementById("obj"))
			document.getElementById("obj").style.background = "radial-gradient(rgb(" + Visual.color.red + "," + Visual.color.green + "," + Visual.color.blue + "), rgba(0,0,0,0) 30%)";
	}

	/**
	 * Checks if the hexagon background canvas exists.
	 * @returns {boolean}
	 */
	static canvasExists() {
		return document.getElementById("canvas-display") !== undefined;
	}

	/**
	 * Updates all color-dependent elements.
	 */
	static updateColor() {
		setTimeout(function () { Visual.updateColorPreview(); }, 0);
		setTimeout(function () { Visual.updateCircleObject(); }, 0);
		if (Visual.canvasExists() && Visual.cbg) {
			let conf = { "color": Visual.cbg_ovr };
			setupBG(conf);
		}
		if (typeof viz !== "undefined") {
			if (typeof viz.bar === "undefined")
				viz.bar = { "color": {} };
			viz.bar.color = {
				"r": Visual.color.red,
				"g": Visual.color.green,
				"b": Visual.color.blue,
				"a": 1,
				"red": Visual.color.red,
				"green": Visual.color.green,
				"blue": Visual.color.blue,
				"alpha": 1
			};
			//console.log(viz.bar.color);
			Visual.updateColorBars(viz.bar.color);
		} else {
			//console.log(Visual.color);
			Visual.updateColorBars(Visual.color);
		}
		
	}

	/**
	 * Updates the bar colors to match the current visualizer colors.
	 */
	static updateColorBars() {
		if (viz.bar && viz.bar.color) {
			viz.bar.color.r = Visual.color.red;
			viz.bar.color.g = Visual.color.green;
			viz.bar.color.b = Visual.color.blue;
		}
	}

	/**
	 * Resets colors to default values.
	 */
	static resetColors() {
		Visual.color.red = 250;
		Visual.color.green = 50;
		Visual.color.blue = 25;
	}

	/**
	 * Reads URL parameters and applies color/design settings.
	 */
	static AcceptUrlParams() {
		// Handled by main.mjs — kept for backward compatibility
	}

	/**
	 * Updates canvas dimensions on window resize.
	 */
	static updateRenderDisplay() {
		if (viz.elm) {
			viz.elm.height = window.innerHeight;
			viz.elm.width = window.innerWidth;
			viz.width = viz.elm.width;
			viz.height = viz.elm.height;
			viz.bar.maxHeight = Visual.getMaxHeight();
			viz.bar.width = viz.width / (viz.bufferLength * 2);
			Visual.xOffset = 0;
			// Resize 3D renderer if active
			if (Visualizer3D.isActive) {
				Visualizer3D.resize(viz.width, viz.height);
			}
		}
	}

	/**
	 * Gets the maximum bar height.
	 * @returns {number}
	 */
	static getMaxHeight() {
		return (window.innerHeight * 2.5) - 100;
	}

	/**
	 * Entry point to start rendering the visualization.
	 */
	static render() {
		let elm = document.getElementById("player");
		let src = elm.currentSrc;
		// Use AudioLibrary metadata (stream URLs can't be parsed for name/artist)
		let songName = "";
		let songArtist = "";
		if (window.AudioLibrary && window.AudioLibrary.currentSongName) {
			let parts = window.AudioLibrary.currentSongName.split(" - ");
			if (parts.length >= 2) {
				songArtist = parts[0].trim();
				songName = parts.slice(1).join(" - ").trim();
			} else {
				songName = window.AudioLibrary.currentSongName;
			}
		} else {
			songName = SongInfo.getSongName(src);
			songArtist = SongInfo.getArtist(src);
		}
		Visual.getSongLyrics(songName, songArtist);
		if (initialized === false) {
			Visual.ini();
			initialized = true;
		}
		// Resume audio context if suspended (browser autoplay policy)
		if (viz.actx && viz.actx.state === "suspended")
			viz.actx.resume();
		Visual.paused = false;
		Visual.postRender();
		Visual.updateRenderDisplay();
	}

	/**
	 * The main rendering loop — called via requestAnimationFrame.
	 */
	static postRender() {
		if (Visual.paused === false) {
			requestAnimationFrame(Visual.postRender);
			Visual.playLyrics();
			viz.ana.getFloatFrequencyData(viz.dataArray);
			if (!Visual.ghost)
				viz.ctx.clearRect(0, 0, viz.width, viz.height);

			// Render Custom Layout Components
			if (Visual.activeLayout) {
				Visual.#renderCustomLayout();
			} else {
				Visual.#calculateColors();
				// Render progress bar after color calculation so fade colors apply
				if (Visual.progressBarVisible && Visual.progBarElm) {
					Visual.progBarElm.update();
					// Calculate bass intensity from the first few frequency bins (low freqs)
					let bassSum = 0;
					let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
					for (let bi = 0; bi < bassBins; bi++) {
						let val = viz.dataArray[bi] + 150; // normalize from dB (typically -100 to 0)
						if (val < 0) val = 0;
						bassSum += val;
					}
					let bassAvg = bassSum / bassBins;
					Visual.progBarElm.bassIntensity = Math.min(1.0, Math.max(0, bassAvg / 150));
					Visual.progBarElm.render();
				}
				let tre = 0;
				// 3D design activation / deactivation / rendering
				if (Visualizer3D.is3D(Visual.currentDesign)) {
					if (!Visualizer3D.isActive || Visual.#last3DDesign !== Visual.currentDesign) {
						Visualizer3D.activate(Visual.currentDesign, viz.width, viz.height);
						Visual.#last3DDesign = Visual.currentDesign;
					}
					Visualizer3D.clearViewport();
					tre = Visualizer3D.render(viz.dataArray, viz.bufferLength, viz.bar.color);
				} else {
					if (Visualizer3D.isActive) {
						Visualizer3D.deactivate();
						Visual.#last3DDesign = "";
					}
					switch (Visual.currentDesign) {
						case "bar":
							tre = Visual.#renderBars();
							break;
						case "line":
							tre = Visual.#renderLines();
							break;
						case "verticalLines":
							tre = Visual.#renderVerticalLines();
							break;
						case "radial":
							tre = Visual.#renderRadial();
							break;
						case "curvedLines":
							tre = Visual.#renderCurvedLines();
							break;
						case "circle":
							tre = Visual.#renderCircle();
							break;
						case "polygon":
							tre = Visual.#renderPolygon();
							break;
						case "snow":
							tre = Visual.#renderSnow();
							break;
						case "rain":
							tre = Visual.#renderRain();
							break;
						case "lightning":
							tre = Visual.#renderLightning();
							break;
						case "tetris":
							tre = Visual.#renderTetris();
							break;
						case "water":
							tre = Visual.#renderWater();
							break;
					}
				}
				if (newBGState) {
					if (tre > 0) {
						let mdiff = (Visual.last_measurement / viz.dataArray[0]);
						if (mdiff < 1 && mdiff > 0.85)
							Sys.newLocation();
					}
					if (Visual.last_measurement !== viz.dataArray[0])
						Visual.last_measurement = viz.dataArray[0];

					// Bass-reactive sphere speed: heavy bass = faster transition
					let bassVal = viz.dataArray[0] + 150;
					if (bassVal < 0) bassVal = 0;
					let bassNorm = Math.min(1.0, bassVal / 150);
					let objElm = document.getElementById("obj");
					if (objElm && bassNorm > 0.3) {
						// Map bass intensity to transition speed: heavier bass = snappier movement
						let speed = Math.max(0.05, 0.25 - (bassNorm * 0.2));
						objElm.style.transitionDuration = speed.toFixed(3) + "s";
					}
				}
			}
		}
	}

	static #renderCustomLayout() {
		// Update colors for this frame
		Visual.#calculateColors();

		// Calculate energy for background changes
		let tre = 0;
		for (let u = 0; u < viz.bufferLength; u++) {
			tre += viz.dataArray[u] + 150;
		}

		// 3D design activation / deactivation
		if (Visualizer3D.is3D(Visual.currentDesign)) {
			if (!Visualizer3D.isActive || Visual.#last3DDesign !== Visual.currentDesign) {
				Visualizer3D.activate(Visual.currentDesign, viz.width, viz.height);
				Visual.#last3DDesign = Visual.currentDesign;
			}
		} else {
			if (Visualizer3D.isActive) {
				Visualizer3D.deactivate();
				Visual.#last3DDesign = "";
			}
		}

		let occupied = [];
		Visual.activeLayout.forEach(comp => {
			let x = (comp.x / 100) * viz.width;
			let y = (comp.y / 100) * viz.height;

			switch(comp.type) {
				case "visualizer":
					if (Visualizer3D.is3D(Visual.currentDesign)) {
						// Compute the same pixel region as #renderDesignAt
						let vp = Visual.#getDesignRegion(x, y, comp.props);
						Visualizer3D.setViewport(vp.x, vp.y, vp.w, vp.h);
						tre = Visualizer3D.render(viz.dataArray, viz.bufferLength, viz.bar.color);
					} else {
						Visual.#renderDesignAt(x, y, comp.props);
					}
					break;
				case "song-display":
					Visual.#renderTextFlowAt(Visual.player ? Visual.player.formatDisplay() : "", x, y, comp.props, occupied);
					break;
				case "song-name":
					Visual.#renderTextFlowAt(Visual.player?.songName || "", x, y, comp.props, occupied);
					break;
				case "artist-name":
					Visual.#renderTextFlowAt(Visual.player?.songArtist || "", x, y, comp.props, occupied);
					break;
				case "album-name":
					Visual.#renderTextFlowAt(window.AudioLibrary?.currentAlbum || "Unknown Album", x, y, comp.props, occupied);
					break;
				case "progress-bar":
					Visual.#renderProgressBarAt(x, y, comp.props);
					break;
				case "source-url":
					Visual.#renderTextFlowAt(window.AudioLibrary?.currentSourceUrl || "", x, y, comp.props, occupied);
					break;
				case "publisher":
					Visual.#renderTextFlowAt(window.AudioLibrary?.currentPublisher || "Unknown Publisher", x, y, comp.props, occupied);
					break;
				case "composers":
					Visual.#renderTextFlowAt(window.AudioLibrary?.currentComposers || "Unknown Composer", x, y, comp.props, occupied);
					break;
				case "custom-text":
					Visual.#renderTextFlowAt(comp.props.text || "", x, y, comp.props, occupied);
					break;
			}
		});

		return tre;
	}

	/**
	 * Computes the pixel region for a visualizer layout component.
	 * Used by both #renderDesignAt (2D) and the 3D viewport path.
	 * @param {number} cx - Center x in pixels.
	 * @param {number} cy - Center y in pixels.
	 * @param {object} props - Component props with width/height percentages.
	 * @returns {{ x: number, y: number, w: number, h: number }}
	 */
	static #getDesignRegion(cx, cy, props) {
		let widthPct = parseFloat(props.width);
		if (Number.isNaN(widthPct) || widthPct <= 0) widthPct = 100;
		let heightPct = parseFloat(props.height);
		if (Number.isNaN(heightPct) || heightPct <= 0) heightPct = 35;
		let w = (widthPct / 100) * viz.width;
		let h = (heightPct / 100) * viz.height;
		let x = cx - (w / 2);
		let y = cy - (h / 2);
		if (w > viz.width) w = viz.width;
		if (h > viz.height) h = viz.height;
		if (x + w > viz.width) x = Math.max(0, viz.width - w);
		if (y + h > viz.height) y = Math.max(0, viz.height - h);
		if (x < 0) x = 0;
		if (y < 0) y = 0;
		return { x, y, w, h };
	}

	static #renderDesignAt(x, y, props) {
		let r = Visual.#getDesignRegion(x, y, props);
		let width = r.w;
		let height = r.h;
		x = r.x;
		y = r.y;

		viz.ctx.save();
		viz.ctx.translate(x, y);
		viz.ctx.beginPath();
		viz.ctx.rect(0, 0, width, height);
		viz.ctx.clip();

		let sx = width / viz.width;
		let sy = height / viz.height;
		viz.ctx.scale(sx, sy);

		switch (Visual.currentDesign) {
			case "bar":
				Visual.#renderBars();
				break;
			case "line":
				Visual.#renderLines();
				break;
			case "verticalLines":
				Visual.#renderVerticalLines();
				break;
			case "radial":
				Visual.#renderRadial();
				break;
			case "curvedLines":
				Visual.#renderCurvedLines();
				break;
			case "circle":
				Visual.#renderCircle();
				break;
			case "polygon":
				Visual.#renderPolygon();
				break;
			case "snow":
				Visual.#renderSnow();
				break;
			case "rain":
				Visual.#renderRain();
				break;
			case "lightning":
				Visual.#renderLightning();
				break;
			case "tetris":
				Visual.#renderTetris();
				break;
			case "water":
				Visual.#renderWater();
				break;
		}

		viz.ctx.restore();
	}

	static #renderProgressBarAt(x, y, props) {
		if (Visual.progBarElm) {
			let widthPct = parseFloat(props.width) || 100;
			let oldX = Visual.progBarElm.x;
			let oldY = Visual.progBarElm.y;
			let oldW = Visual.progBarElm.width;

			Visual.progBarElm.x = x;
			Visual.progBarElm.y = y;
			Visual.progBarElm.width = (widthPct / 100) * viz.width;
			if (Visual.progBarElm.width > viz.width) Visual.progBarElm.width = viz.width;
			if (Visual.progBarElm.x + Visual.progBarElm.width > viz.width) Visual.progBarElm.x = Math.max(0, viz.width - Visual.progBarElm.width);
			if (Visual.progBarElm.y > viz.height) Visual.progBarElm.y = viz.height;
			if (Visual.progBarElm.x < 0) Visual.progBarElm.x = 0;
			if (Visual.progBarElm.y < 0) Visual.progBarElm.y = 0;

			Visual.progBarElm.update();

			// Calculate bass intensity for glow (same as normal render path)
			let bassSum = 0;
			let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
			for (let bi = 0; bi < bassBins; bi++) {
				let val = viz.dataArray[bi] + 150;
				if (val < 0) val = 0;
				bassSum += val;
			}
			let bassAvg = bassSum / bassBins;
			Visual.progBarElm.bassIntensity = Math.min(1.0, Math.max(0, bassAvg / 150));

			Visual.progBarElm.render();

			Visual.progBarElm.x = oldX;
			Visual.progBarElm.y = oldY;
			Visual.progBarElm.width = oldW;
		}
	}

	static #renderTextAt(text, x, y, props) {
		viz.ctx.fillStyle = props.color || "#fff";
		viz.ctx.font = (props.fontSize || "16px") + " Arial";
		viz.ctx.textAlign = "center";
		viz.ctx.textBaseline = "middle";
		viz.ctx.fillText(text, x, y);
	}

	static #renderTextFlowAt(text, x, y, props, occupiedRects) {
		viz.ctx.save();
		viz.ctx.font = (props.fontSize || "16px") + " Arial";
		let metrics = viz.ctx.measureText(text);
		let width = metrics.width;
		let fontPx = parseFloat(String(props.fontSize || "16px"));
		if (Number.isNaN(fontPx)) fontPx = 16;
		let height = fontPx * 1.2;
		let cx = x, cy = y;
		let maxIter = 20;
		while (maxIter-- > 0) {
			let rect = { left: cx - width / 2, right: cx + width / 2, top: cy - height / 2, bottom: cy + height / 2 };
			let overlap = occupiedRects.some(r => !(rect.right < r.left || rect.left > r.right || rect.bottom < r.top || rect.top > r.bottom));
			if (!overlap && rect.left >= 0 && rect.right <= viz.width && rect.top >= 0 && rect.bottom <= viz.height) {
				occupiedRects.push(rect);
				break;
			}
			// Move down by text height until free; if off bottom, try shifting up
			cy += height;
			if (cy + height / 2 > viz.height) {
				cy = y - height;
			}
		}
		viz.ctx.restore();
		Visual.#renderTextAt(text, cx, cy, props);
	}

	/**
	 * Updates the visualization design from a select element.
	 * @param {HTMLSelectElement} selectElement - The design selector.
	 */
	static updateDesign(selectElement) {
		if (selectElement instanceof HTMLSelectElement)
			Visual.currentDesign = selectElement.value;
	}

	/**
	 * Renders the radial visualization design.
	 * @returns {number} - The total energy value.
	 */
	static #renderRadial() {
		let o = viz.bufferLength;
		let i = 0, u = 0, xx = (viz.bar.width + 1) * (viz.bufferLength + Visual.xOffset), tre = 0, toff = 150, x = 0, ii = viz.bufferLength - viz.bar.width;
		viz.ctx.beginPath();
		viz.ctx.lineWidth = 2;
		let radius = 30;
		let centerX = viz.width / 2;
		let centerY = viz.height / 2;
		viz.ctx.moveTo(centerX, centerY);
		for (o = viz.bufferLength; o > -1; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			let tmpX = x + (i * Visual.xOffset);
			let tmpY = viz.height - y;
			let theta = o * (2 * Math.PI) / (viz.bufferLength * 2);
			let calcX = o + radius * Math.cos(theta);
			let calcY = o + radius * Math.sin(theta);
			viz.ctx.lineTo(calcX + tmpX, calcY + tmpY);
			x += viz.bar.width + 1;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width + 1;
			ii++;
		}
		viz.ctx.stroke();
		return tre;
	}

	/**
	 * Renders the line visualization design.
	 * @returns {number} - The total energy value.
	 */
	static #renderLines() {
		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150;
		let totalVisWidth = (viz.bar.width + 1) * (viz.bufferLength * 2);
		let startX = (viz.width - totalVisWidth) / 2;
		let x = startX;
		let xx = startX + ((viz.bar.width + 1) * viz.bufferLength);
		let ii = viz.bufferLength - viz.bar.width;
		viz.ctx.lineWidth = 2;
		let tmpData = [];
		let region;
		let colorCalc = Color.createFromRGB(0, 0, 0);
		if (Visual.fillPolygon) {
			region = new Path2D();
			region.moveTo(startX, viz.height);
		} else {
			viz.ctx.beginPath();
			viz.ctx.moveTo(startX, viz.height);
		}
		for (o = viz.bufferLength; o > -1; o--) {
			colorCalc = Color.createFromRGB(0, 0, 0);
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			let tmpX = x + (i * Visual.xOffset);
			let tmpY = viz.height - y;
			colorCalc.red = viz.bar.color.r * calc;
			colorCalc.green = viz.bar.color.g * calc;
			colorCalc.blue = viz.bar.color.b * calc;
			if (Visual.fillPolygon)
				region.lineTo(tmpX, tmpY);
			else {
				viz.ctx.strokeStyle = colorCalc.toString();
				viz.ctx.lineTo(tmpX, tmpY);
			}
			x += viz.bar.width + 1;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			let altX = xx + (ii * Visual.xOffset);
			tmpData.push({ x: altX, y: viz.height - y, calc: calc });
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width + 1;
			ii++;
		}
		for (let itu = 0; itu < tmpData.length; itu++) {
			if (Visual.fillPolygon)
				region.lineTo(tmpData[itu].x, tmpData[itu].y);
			else {
				viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * tmpData[itu].calc) + "," + (viz.bar.color.g * tmpData[itu].calc) + "," + (viz.bar.color.b * tmpData[itu].calc) + ")";
				viz.ctx.lineTo(tmpData[itu].x, tmpData[itu].y);
			}
		}
		if (Visual.fillPolygon) {
			region.lineTo(Visual.width, Visual.height);
			region.closePath();
			viz.ctx.fillStyle = colorCalc.toString();
			viz.ctx.fill(region);
		} else {
			viz.ctx.lineTo(Visual.width, Visual.height);
			viz.ctx.strokeStyle = colorCalc.toString();
			viz.ctx.stroke();
		}
		return tre;
	}

	/**
	 * Renders the curved line visualization design.
	 * @returns {number} - The total energy value.
	 */
	static #renderCurvedLines() {
		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150;
		let totalWidth = (viz.bar.width + 1) * (viz.bufferLength * 2);
		let startX = (viz.width - totalWidth) / 2;
		let ii = viz.bufferLength - viz.bar.width;
		let x = startX;
		let xx = startX + ((viz.bar.width + 1) * viz.bufferLength);
		viz.ctx.lineWidth = 2;
		let colorCalc = Color.createFromRGB(0, 0, 0);

		// Build left-side points (high frequencies to low)
		let leftPoints = [];
		for (o = viz.bufferLength; o >= 0; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			colorCalc.red = viz.bar.color.r * calc;
			colorCalc.green = viz.bar.color.g * calc;
			colorCalc.blue = viz.bar.color.b * calc;
			leftPoints.push({ x: x + (i * Visual.xOffset), y: viz.height - y });
			x += viz.bar.width + 1;
			i++;
			// Right-side mirror point
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			if (viz.dataArray[u]) tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width + 1;
			ii++;
		}

		// Build right-side points (low to high)
		let rightPoints = [];
		u = 0; xx = startX + ((viz.bar.width + 1) * viz.bufferLength); ii = viz.bufferLength - viz.bar.width;
		for (o = viz.bufferLength; o >= 0; o--) {
			let y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			rightPoints.push({ x: xx + (ii * Visual.xOffset), y: viz.height - y });
			u++;
			xx += viz.bar.width + 1;
			ii++;
		}

		// Draw curved path through all points
		let allPoints = leftPoints.concat(rightPoints);

		if (Visual.fillPolygon) {
			let region = new Path2D();
			region.moveTo(allPoints[0].x, viz.height);
			region.lineTo(allPoints[0].x, allPoints[0].y);
			for (let p = 1; p < allPoints.length; p++) {
				let prev = allPoints[p - 1];
				let cur = allPoints[p];
				let cpx = (prev.x + cur.x) / 2;
				let cpy = (prev.y + cur.y) / 2;
				region.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
			}
			let last = allPoints[allPoints.length - 1];
			region.lineTo(last.x, last.y);
			region.lineTo(last.x, viz.height);
			region.closePath();
			viz.ctx.fillStyle = colorCalc.toString();
			viz.ctx.fill(region);
		} else {
			viz.ctx.beginPath();
			viz.ctx.moveTo(allPoints[0].x, allPoints[0].y);
			for (let p = 1; p < allPoints.length; p++) {
				let prev = allPoints[p - 1];
				let cur = allPoints[p];
				let cpx = (prev.x + cur.x) / 2;
				let cpy = (prev.y + cur.y) / 2;
				viz.ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
			}
			viz.ctx.strokeStyle = colorCalc.toString();
			viz.ctx.stroke();
		}
		return tre;
	}

	/**
	 * Renders the bar visualization design.
	 * @returns {number} - The total energy value.
	 */
	static #renderBars() {
		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150, x = 0;
		let totalVisWidth = viz.bar.width * (viz.bufferLength * 2);
		let startX = (viz.width - totalVisWidth) / 2;
		x = startX;
		let xx = startX + totalVisWidth / 2;
		let ii = viz.bufferLength - viz.bar.width;
		for (o = viz.bufferLength; o > -1; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.fillStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.fillRect(x + (i * Visual.xOffset), viz.height - y, viz.bar.width, viz.height);
			x += viz.bar.width;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.fillStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.fillRect(xx + (ii * Visual.xOffset), viz.height - y, viz.bar.width, viz.height);
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width;
			ii++;
		}
		return tre;
	}

	/**
	 * Renders the vertical lines visualization design.
	 * @returns {number} - The total energy value.
	 */
	static #renderVerticalLines() {
		let o = viz.bufferLength;
		let i = 0, u = 0, tre = 0, toff = 150;
		let totalVisWidth = viz.bar.width * (viz.bufferLength * 2);
		let startX = (viz.width - totalVisWidth) / 2;
		let x = startX;
		let xx = startX + totalVisWidth / 2;
		let ii = viz.bufferLength - viz.bar.width;
		for (o = viz.bufferLength; o > -1; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.beginPath();
			viz.ctx.moveTo(x, viz.height);
			viz.ctx.lineTo(x, viz.height - y);
			viz.ctx.stroke();
			x += viz.bar.width;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.beginPath();
			viz.ctx.moveTo(xx, viz.height);
			viz.ctx.lineTo(xx, viz.height - y);
			viz.ctx.stroke();
			if (viz.dataArray[u])
				tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width;
			ii++;
		}
		return tre;
	}

	/**
	 * Renders the circular visualization design.
	 * Frequency bars radiate outward from a central circle, evenly distributed
	 * around the circumference. Bar count is determined by the Accuracy setting.
	 * @returns {number} - The total energy value.
	 */
	static #renderCircle() {
		let tre = 0;
		let toff = 150;
		let centerX = viz.width / 2;
		let centerY = viz.height * 0.6;
		let minDim = Math.min(viz.width, viz.height);
		let baseRadius = minDim * 0.15;
		let maxBarLength = minDim * 0.35;
		let count = viz.bufferLength;
		let angleStep = (2 * Math.PI) / count;

		// Calculate bar width based on circumference and bar count
		let circumference = 2 * Math.PI * baseRadius;
		let barWidth = Math.max(1, (circumference / count) * 0.8);
		viz.ctx.lineWidth = barWidth;
		viz.ctx.lineCap = "round";

		let outerPoints = [];

		for (let o = 0; o < count; o++) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			if (y < 0) y = 0;
			let barLength = (y / viz.height) * maxBarLength;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);

			// Rotate so index 0 starts at top (-PI/2 offset)
			let angle = (o * angleStep) - (Math.PI / 2);

			let innerX = centerX + baseRadius * Math.cos(angle);
			let innerY = centerY + baseRadius * Math.sin(angle);
			let outerX = centerX + (baseRadius + barLength) * Math.cos(angle);
			let outerY = centerY + (baseRadius + barLength) * Math.sin(angle);

			outerPoints.push({ x: outerX, y: outerY });

			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.beginPath();
			viz.ctx.moveTo(innerX, innerY);
			viz.ctx.lineTo(outerX, outerY);
			viz.ctx.stroke();

			if (viz.dataArray[o])
				tre += viz.dataArray[o] + toff;
		}

		// Fill polygon between base circle and bar tips
		if (Visual.fillPolygon && outerPoints.length > 0) {
			viz.ctx.beginPath();
			// Draw outer tip path
			viz.ctx.moveTo(outerPoints[0].x, outerPoints[0].y);
			for (let p = 1; p < outerPoints.length; p++) {
				viz.ctx.lineTo(outerPoints[p].x, outerPoints[p].y);
			}
			viz.ctx.closePath();
			// Draw inner circle path (counter-clockwise to create hole)
			viz.ctx.moveTo(centerX + baseRadius, centerY);
			viz.ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI, true);
			viz.ctx.fillStyle = "rgba(" + viz.bar.color.r + "," + viz.bar.color.g + "," + viz.bar.color.b + ",0.15)";
			viz.ctx.fill("evenodd");
		}

		// Draw base circle outline
		let baseCalc = Math.min(1.0, 0.3);
		viz.ctx.strokeStyle = "rgba(" + (viz.bar.color.r * baseCalc) + "," + (viz.bar.color.g * baseCalc) + "," + (viz.bar.color.b * baseCalc) + ",0.4)";
		viz.ctx.lineWidth = 1.5;
		viz.ctx.beginPath();
		viz.ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
		viz.ctx.stroke();

		return tre;
	}

	/**
	 * Renders the polygon visualization design.
	 * Frequency bars radiate outward perpendicular to each side of a regular polygon.
	 * The polygon has Visual.polygonSides sides (clamped between 2 and 10000).
	 * @returns {number} - The total energy value.
	 */
	static #renderPolygon() {
		let tre = 0;
		let toff = 150;
		let centerX = viz.width / 2;
		let centerY = viz.height * 0.6;
		let minDim = Math.min(viz.width, viz.height);
		let baseRadius = minDim * 0.15;
		let maxBarLength = minDim * 0.35;
		let count = viz.bufferLength;
		let sides = Math.max(2, Math.min(10000, Visual.polygonSides));

		// Calculate polygon vertices
		let vertices = [];
		for (let s = 0; s <= sides; s++) {
			let angle = (s * 2 * Math.PI / sides) - (Math.PI / 2);
			vertices.push({
				x: centerX + baseRadius * Math.cos(angle),
				y: centerY + baseRadius * Math.sin(angle)
			});
		}

		// Calculate perimeter and bar width
		let perimeter = 0;
		for (let s = 0; s < sides; s++) {
			let dx = vertices[s + 1].x - vertices[s].x;
			let dy = vertices[s + 1].y - vertices[s].y;
			perimeter += Math.sqrt(dx * dx + dy * dy);
		}
		let barWidth = Math.max(1, (perimeter / count) * 0.8);
		viz.ctx.lineWidth = barWidth;
		viz.ctx.lineCap = "round";

		// Distribute bars evenly across all edges
		let barsPerSide = count / sides;
		let outerPoints = [];

		for (let o = 0; o < count; o++) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			if (y < 0) y = 0;
			let barLength = (y / viz.height) * maxBarLength;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);

			// Determine which edge this bar belongs to and position along it
			let sideIndex = Math.floor(o / barsPerSide);
			if (sideIndex >= sides) sideIndex = sides - 1;
			let t = (o - sideIndex * barsPerSide) / barsPerSide;

			let v0 = vertices[sideIndex];
			let v1 = vertices[sideIndex + 1];

			// Position along the edge
			let posX = v0.x + (v1.x - v0.x) * t;
			let posY = v0.y + (v1.y - v0.y) * t;

			// Outward normal for this edge
			let edgeDx = v1.x - v0.x;
			let edgeDy = v1.y - v0.y;
			let edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
			let nx = -edgeDy / edgeLen;
			let ny = edgeDx / edgeLen;

			// Ensure normal points outward (away from center)
			let toCenterX = centerX - posX;
			let toCenterY = centerY - posY;
			if (nx * toCenterX + ny * toCenterY > 0) {
				nx = -nx;
				ny = -ny;
			}

			let outerX = posX + nx * barLength;
			let outerY = posY + ny * barLength;

			outerPoints.push({ x: outerX, y: outerY });

			viz.ctx.strokeStyle = "rgb(" + (viz.bar.color.r * calc) + "," + (viz.bar.color.g * calc) + "," + (viz.bar.color.b * calc) + ")";
			viz.ctx.beginPath();
			viz.ctx.moveTo(posX, posY);
			viz.ctx.lineTo(outerX, outerY);
			viz.ctx.stroke();

			if (viz.dataArray[o])
				tre += viz.dataArray[o] + toff;
		}

		// Fill polygon between base shape and bar tips
		if (Visual.fillPolygon && outerPoints.length > 0) {
			viz.ctx.beginPath();
			// Draw outer tip path
			viz.ctx.moveTo(outerPoints[0].x, outerPoints[0].y);
			for (let p = 1; p < outerPoints.length; p++) {
				viz.ctx.lineTo(outerPoints[p].x, outerPoints[p].y);
			}
			viz.ctx.closePath();
			// Draw inner polygon path (counter-clockwise to create hole)
			viz.ctx.moveTo(vertices[0].x, vertices[0].y);
			for (let s = sides; s >= 0; s--) {
				viz.ctx.lineTo(vertices[s].x, vertices[s].y);
			}
			viz.ctx.closePath();
			viz.ctx.fillStyle = "rgba(" + viz.bar.color.r + "," + viz.bar.color.g + "," + viz.bar.color.b + ",0.15)";
			viz.ctx.fill("evenodd");
		}

		// Draw base polygon outline
		let baseCalc = Math.min(1.0, 0.3);
		viz.ctx.strokeStyle = "rgba(" + (viz.bar.color.r * baseCalc) + "," + (viz.bar.color.g * baseCalc) + "," + (viz.bar.color.b * baseCalc) + ",0.4)";
		viz.ctx.lineWidth = 1.5;
		viz.ctx.beginPath();
		viz.ctx.moveTo(vertices[0].x, vertices[0].y);
		for (let s = 1; s <= sides; s++) {
			viz.ctx.lineTo(vertices[s].x, vertices[s].y);
		}
		viz.ctx.closePath();
		viz.ctx.stroke();

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  SNOW DESIGN
	// ═══════════════════════════════════════════════

	/**
	 * Audio-reactive snowfall. Bass intensity controls wind, spawn rate, and size.
	 * @returns {number} Total energy.
	 */
	static #renderSnow() {
		let tre = 0, toff = 150;
		// Calculate bass energy
		let bassSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
		for (let bi = 0; bi < bassBins; bi++) {
			let val = viz.dataArray[bi] + toff;
			if (val < 0) val = 0;
			bassSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		// Total energy for mid/high freq sparkle
		let totalEnergy = 0;
		for (let i = bassBins; i < viz.bufferLength; i++) {
			let v = Math.max(0, viz.dataArray[i] + toff);
			tre += v;
			totalEnergy += v;
		}
		let energyNorm = Math.min(1.0, totalEnergy / ((viz.bufferLength - bassBins) * 120));

		// Spawn new particles across the FULL canvas width
		let spawnCount = Math.floor(3 + bass * 12);
		for (let s = 0; s < spawnCount; s++) {
			Visual.#snowParticles.push({
				x: Math.random() * viz.width,
				y: -Math.random() * 40,
				r: 1.5 + Math.random() * 3 + bass * 3,
				vx: (Math.random() - 0.5) * 0.3,
				vy: 0.5 + Math.random() * 1.5,
				opacity: 0.4 + Math.random() * 0.6,
				wobble: Math.random() * Math.PI * 2,
				wobbleSpeed: 0.01 + Math.random() * 0.03
			});
		}

		// Wind from bass (gentle, centered around zero)
		let wind = (bass - 0.3) * 2.5;

		// Update and draw
		let r = viz.bar.color.r, g = viz.bar.color.g, b = viz.bar.color.b;
		for (let i = Visual.#snowParticles.length - 1; i >= 0; i--) {
			let p = Visual.#snowParticles[i];
			p.wobble += p.wobbleSpeed;
			p.x += p.vx + Math.sin(p.wobble) * 0.8 + wind;
			p.y += p.vy + bass * 1.5;

			// Generous margins so particles aren't culled too early
			if (p.y > viz.height + 50 || p.x < -60 || p.x > viz.width + 60) {
				Visual.#snowParticles.splice(i, 1);
				continue;
			}

			viz.ctx.beginPath();
			viz.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			let glow = bass > 0.4 ? bass * 0.3 : 0;
			viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (p.opacity * (0.6 + glow)) + ")";
			viz.ctx.fill();

			// Sparkle effect on high energy
			if (energyNorm > 0.4 && Math.random() < 0.35) {
				viz.ctx.beginPath();
				viz.ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
				viz.ctx.fillStyle = "rgba(255,255,255," + (0.04 + energyNorm * 0.08) + ")";
				viz.ctx.fill();
			}

			// Extra bright sparkle on very high energy
			if (energyNorm > 0.7 && Math.random() < 0.15) {
				viz.ctx.save();
				viz.ctx.shadowColor = "rgba(" + r + "," + g + "," + b + ",0.6)";
				viz.ctx.shadowBlur = 8 + energyNorm * 12;
				viz.ctx.beginPath();
				viz.ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
				viz.ctx.fillStyle = "rgba(255,255,255," + (0.5 + energyNorm * 0.3) + ")";
				viz.ctx.fill();
				viz.ctx.restore();
			}
		}

		// Cap particle count
		if (Visual.#snowParticles.length > 1000) Visual.#snowParticles.splice(0, Visual.#snowParticles.length - 1000);

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  RAIN DESIGN
	// ═══════════════════════════════════════════════

	/**
	 * Audio-reactive rain. Bass controls intensity, mid-freq controls streak length.
	 * @returns {number} Total energy.
	 */
	static #renderRain() {
		let tre = 0, toff = 150;
		let bassSum = 0, midSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
		let midStart = bassBins, midEnd = Math.min(viz.bufferLength, Math.floor(viz.bufferLength * 0.3));

		for (let i = 0; i < viz.bufferLength; i++) {
			let val = viz.dataArray[i] + toff;
			if (val < 0) val = 0;
			if (i < bassBins) bassSum += val;
			else if (i < midEnd) midSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let mid = Math.min(1.0, midSum / ((midEnd - midStart) * 100));

		// Spawn rain drops uniformly across full canvas width
		let spawnCount = Math.floor(5 + bass * 25);
		for (let s = 0; s < spawnCount; s++) {
			Visual.#rainParticles.push({
				x: Math.random() * viz.width,
				y: -5 - Math.random() * 60,
				len: 8 + mid * 25 + Math.random() * 10,
				speed: 6 + Math.random() * 8 + bass * 10,
				opacity: 0.2 + Math.random() * 0.5,
				wind: (Math.random() - 0.5) * 0.5
			});
		}

		let r = viz.bar.color.r, g = viz.bar.color.g, b = viz.bar.color.b;
		viz.ctx.lineCap = "round";

		for (let i = Visual.#rainParticles.length - 1; i >= 0; i--) {
			let p = Visual.#rainParticles[i];
			p.y += p.speed;
			p.x += p.wind;

			if (p.y > viz.height) {
				// Splash effect at the actual bottom of the canvas
				if (bass > 0.15) {
					let splashR = 2 + bass * 8;
					viz.ctx.beginPath();
					viz.ctx.ellipse(p.x, viz.height - 1, splashR, splashR * 0.3, 0, 0, Math.PI * 2);
					viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (0.15 + bass * 0.25) + ")";
					viz.ctx.fill();
					// Small upward splash droplets
					if (bass > 0.4 && Math.random() < 0.3) {
						for (let d = 0; d < 2; d++) {
							let dx = p.x + (Math.random() - 0.5) * splashR * 2;
							let dy = viz.height - 2 - Math.random() * 4;
							viz.ctx.beginPath();
							viz.ctx.arc(dx, dy, 0.5 + Math.random(), 0, Math.PI * 2);
							viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (0.2 + bass * 0.2) + ")";
							viz.ctx.fill();
						}
					}
				}
				Visual.#rainParticles.splice(i, 1);
				continue;
			}

			viz.ctx.beginPath();
			viz.ctx.moveTo(p.x, p.y);
			viz.ctx.lineTo(p.x + p.wind * p.len * 0.3, p.y + p.len);
			viz.ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + p.opacity + ")";
			viz.ctx.lineWidth = 1 + bass * 1.5;
			viz.ctx.stroke();
		}

		// Lightning flash on heavy bass
		if (bass > 0.85 && Math.random() < 0.15) {
			viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + ",0.04)";
			viz.ctx.fillRect(0, 0, viz.width, viz.height);
		}

		if (Visual.#rainParticles.length > 1200) Visual.#rainParticles.splice(0, Visual.#rainParticles.length - 1200);

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  LIGHTNING DESIGN
	// ═══════════════════════════════════════════════

	/**
	 * Audio-reactive lightning bolts. Each frequency bin can spawn a bolt,
	 * intensity controls brightness, branching, and arc complexity.
	 * @returns {number} Total energy.
	 */
	static #renderLightning() {
		let tre = 0, toff = 150;
		let r = viz.bar.color.r, g = viz.bar.color.g, b = viz.bar.color.b;

		// Build energy profile per frequency bin
		let energies = [];
		for (let i = 0; i < viz.bufferLength; i++) {
			let val = Math.max(0, viz.dataArray[i] + toff);
			energies.push(val);
			tre += val;
		}

		let bassSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
		for (let i = 0; i < bassBins; i++) bassSum += energies[i];
		let bass = Math.min(1.0, bassSum / (bassBins * 150));
		let totalNorm = Math.min(1.0, tre / (viz.bufferLength * 100));

		// Map frequency bins to x positions across the full canvas width
		let step = Math.max(1, Math.floor(viz.bufferLength / 24));
		for (let i = 0; i < viz.bufferLength; i += step) {
			let e = energies[i] / 300;
			if (e < 0.25) continue;
			// Bolt spawn probability tied to frequency value at that position
			if (Math.random() > e * 0.65) continue;

			let startX = (i / viz.bufferLength) * viz.width;
			let startY = 0;
			let endX = startX + (Math.random() - 0.5) * viz.width * 0.25;
			let endY = viz.height * (0.65 + Math.random() * 0.35);

			Visual.#drawLightningBolt(startX, startY, endX, endY, e, r, g, b, 4);
		}

		// Extra ambient bolts on high total energy
		let extraBolts = Math.floor(totalNorm * 3);
		for (let eb = 0; eb < extraBolts; eb++) {
			if (Math.random() < 0.4) {
				let sx = Math.random() * viz.width;
				let ex = sx + (Math.random() - 0.5) * viz.width * 0.35;
				Visual.#drawLightningBolt(sx, 0, ex, viz.height * (0.7 + Math.random() * 0.3), totalNorm, r, g, b, 4);
			}
		}

		// Background screen flash on extreme bass (>0.85)
		if (bass > 0.85) {
			viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (0.03 + bass * 0.04) + ")";
			viz.ctx.fillRect(0, 0, viz.width, viz.height);
		}

		return tre;
	}

	/**
	 * Draws a single jagged lightning bolt with recursive branching and glow.
	 */
	static #drawLightningBolt(x1, y1, x2, y2, intensity, r, g, b, depth) {
		if (depth <= 0) return;
		let segments = 8 + Math.floor(intensity * 10);
		let dx = (x2 - x1) / segments;
		let dy = (y2 - y1) / segments;
		// Significant horizontal jitter for jagged look
		let jitter = 30 + intensity * 60;

		let alpha = Math.min(1, 0.4 + intensity * 0.6);
		let width = 0.8 + intensity * 2.5 * (depth / 4);

		// Collect points for the bolt path
		let points = [{ x: x1, y: y1 }];
		for (let s = 1; s <= segments; s++) {
			let nx, ny;
			if (s < segments) {
				nx = x1 + dx * s + (Math.random() - 0.5) * jitter;
				ny = y1 + dy * s + (Math.random() - 0.5) * jitter * 0.15;
			} else {
				nx = x2;
				ny = y2;
			}
			points.push({ x: nx, y: ny });
		}

		// Draw the colored bolt with glow
		viz.ctx.save();
		viz.ctx.shadowColor = "rgba(" + r + "," + g + "," + b + "," + (alpha * 0.7) + ")";
		viz.ctx.shadowBlur = 15 + intensity * 15;
		viz.ctx.beginPath();
		viz.ctx.moveTo(points[0].x, points[0].y);
		for (let s = 1; s < points.length; s++) {
			viz.ctx.lineTo(points[s].x, points[s].y);
		}
		viz.ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
		viz.ctx.lineWidth = width;
		viz.ctx.stroke();
		viz.ctx.restore();

		// Bright white hot core over the colored bolt
		viz.ctx.beginPath();
		viz.ctx.moveTo(points[0].x, points[0].y);
		for (let s = 1; s < points.length; s++) {
			viz.ctx.lineTo(points[s].x, points[s].y);
		}
		viz.ctx.strokeStyle = "rgba(255,255,255," + (alpha * 0.6) + ")";
		viz.ctx.lineWidth = Math.max(0.5, width * 0.3);
		viz.ctx.stroke();

		// Branching: at each segment, 30% chance to fork at reduced intensity
		for (let s = 2; s < points.length - 1; s++) {
			if (depth > 1 && Math.random() < 0.3) {
				let branchLen = (y2 - y1) * (0.2 + Math.random() * 0.25);
				let bx = points[s].x + (Math.random() - 0.5) * jitter * 1.5;
				let by = points[s].y + branchLen;
				Visual.#drawLightningBolt(points[s].x, points[s].y, bx, by, intensity * 0.45, r, g, b, depth - 1);
			}
		}
	}

	// ═══════════════════════════════════════════════
	//  TETRIS DESIGN
	// ═══════════════════════════════════════════════

	/**
	 * Audio-reactive falling tetris blocks. Each frequency band drops a block,
	 * bass controls fall speed, blocks stack and clear when a row fills.
	 * @returns {number} Total energy.
	 */
	static #renderTetris() {
		let tre = 0, toff = 150;
		let cols = 20;
		let cellW = viz.width / cols;
		let cellH = cellW; // square cells
		let r = viz.bar.color.r, g = viz.bar.color.g, b = viz.bar.color.b;

		// Energy
		let bassSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
		for (let i = 0; i < viz.bufferLength; i++) {
			let val = Math.max(0, viz.dataArray[i] + toff);
			if (i < bassBins) bassSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		Visual.#tetrisTimer++;

		// Spawn new blocks using overall energy mapped to all columns
		let spawnInterval = Math.max(1, Math.floor(5 - bass * 4));
		if (Visual.#tetrisTimer % spawnInterval === 0) {
			// Compute overall energy norm
			let totalNorm = Math.min(1.0, tre / (viz.bufferLength * 100));

			for (let c = 0; c < cols; c++) {
				// Each column checks a logarithmic frequency band for local energy
				let logMax = Math.log(viz.bufferLength + 1);
				let binStart = Math.floor(Math.exp((c / cols) * logMax) - 1);
				let binEnd = Math.floor(Math.exp(((c + 1) / cols) * logMax) - 1);
				binStart = Math.max(0, Math.min(viz.bufferLength - 1, binStart));
				binEnd = Math.max(binStart + 1, Math.min(viz.bufferLength, binEnd));

				let maxVal = 0;
				for (let i = binStart; i < binEnd; i++) {
					let v = Math.max(0, viz.dataArray[i] + toff);
					if (v > maxVal) maxVal = v;
				}
				let localNorm = maxVal / 300;

				// Blend local frequency energy with overall energy so
				// all columns can spawn blocks during energetic sections
				let blended = localNorm * 0.6 + totalNorm * 0.4;
				if (blended > 0.25 && Math.random() < blended * 0.35) {
					let shade = 0.3 + blended * 0.7;
					Visual.#tetrisBlocks.push({
						col: c,
						y: -cellH,
						speed: 2 + bass * 5 + Math.random() * 1.5,
						color: { r: Math.floor(r * shade), g: Math.floor(g * shade), b: Math.floor(b * shade) },
						settled: false,
						alpha: 0.7 + blended * 0.3,
						flash: 0
					});
				}
			}
		}

		// Build height map of settled blocks per column
		let heightMap = new Array(cols).fill(viz.height);
		for (let blk of Visual.#tetrisBlocks) {
			if (blk.settled && blk.y < heightMap[blk.col]) {
				heightMap[blk.col] = blk.y;
			}
		}

		// Update falling blocks
		for (let blk of Visual.#tetrisBlocks) {
			if (blk.settled) {
				if (blk.flash > 0) blk.flash -= 0.05;
				continue;
			}
			blk.y += blk.speed;
			let floor = heightMap[blk.col] - cellH;
			if (floor < 0) floor = 0;
			if (blk.y >= floor) {
				blk.y = Math.round(floor / cellH) * cellH;
				blk.settled = true;
				if (blk.y < heightMap[blk.col]) heightMap[blk.col] = blk.y;
			}
		}

		// Clear full rows with a brief flash
		let rowCounts = {};
		for (let blk of Visual.#tetrisBlocks) {
			if (!blk.settled) continue;
			let rowKey = Math.round(blk.y / cellH);
			rowCounts[rowKey] = (rowCounts[rowKey] || 0) + 1;
		}
		for (let rowKey in rowCounts) {
			if (rowCounts[rowKey] >= cols) {
				let rowY = parseInt(rowKey) * cellH;
				// Flash the row before clearing
				viz.ctx.fillStyle = "rgba(255,255,255,0.25)";
				viz.ctx.fillRect(0, rowY, viz.width, cellH);
				Visual.#tetrisBlocks = Visual.#tetrisBlocks.filter(bl => !(bl.settled && Math.abs(bl.y - rowY) < 2));
				// Drop settled blocks above the cleared row
				for (let blk of Visual.#tetrisBlocks) {
					if (blk.settled && blk.y < rowY) {
						blk.y += cellH;
					}
				}
			}
		}

		// Cap at 600 blocks
		if (Visual.#tetrisBlocks.length > 600) {
			let settled = Visual.#tetrisBlocks.filter(bl => bl.settled);
			if (settled.length > 400) {
				let toRemove = settled.slice(0, settled.length - 400);
				let removeSet = new Set(toRemove);
				Visual.#tetrisBlocks = Visual.#tetrisBlocks.filter(bl => !removeSet.has(bl));
			}
		}

		// Draw blocks as colored rounded-ish rectangles with border highlight
		for (let blk of Visual.#tetrisBlocks) {
			let bx = blk.col * cellW;
			let by = blk.y;
			let pad = 1.5;
			let rr = Math.min(4, cellW * 0.12);

			// Block fill
			let cr = blk.color.r, cg = blk.color.g, cb = blk.color.b;
			let fa = blk.alpha + (blk.flash > 0 ? blk.flash * 0.3 : 0);
			viz.ctx.beginPath();
			viz.ctx.roundRect(bx + pad, by + pad, cellW - pad * 2, cellH - pad * 2, rr);
			viz.ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + fa + ")";
			viz.ctx.fill();

			// Subtle top-left highlight
			viz.ctx.beginPath();
			viz.ctx.roundRect(bx + pad, by + pad, cellW - pad * 2, cellH - pad * 2, rr);
			viz.ctx.strokeStyle = "rgba(255,255,255,0.15)";
			viz.ctx.lineWidth = 1;
			viz.ctx.stroke();

			// Inner shadow on bottom-right
			viz.ctx.beginPath();
			viz.ctx.moveTo(bx + cellW - pad, by + pad + rr);
			viz.ctx.lineTo(bx + cellW - pad, by + cellH - pad - rr);
			viz.ctx.strokeStyle = "rgba(0,0,0,0.15)";
			viz.ctx.lineWidth = 1;
			viz.ctx.stroke();
		}

		return tre;
	}

	// ═══════════════════════════════════════════════
	//  REACTIVE WATER SPEAKER DESIGN
	// ═══════════════════════════════════════════════

	/**
	 * Simulates a water surface disturbed by audio frequencies.
	 * Bass creates large waves, highs create ripples. Adjustable viscosity and tension.
	 * @returns {number} Total energy.
	 */
	static #renderWater() {
		let tre = 0, toff = 150;
		let r = viz.bar.color.r, g = viz.bar.color.g, b = viz.bar.color.b;

		// Energy from frequency data
		let bassSum = 0;
		let bassBins = Math.max(1, Math.min(8, Math.floor(viz.bufferLength * 0.03)));
		for (let i = 0; i < viz.bufferLength; i++) {
			let val = Math.max(0, viz.dataArray[i] + toff);
			if (i < bassBins) bassSum += val;
			tre += val;
		}
		let bass = Math.min(1.0, bassSum / (bassBins * 150));

		// Pool geometry
		let poolSurface = viz.height * 0.85;
		let poolBottom = viz.height;

		// ── 1. Draw the water pool at the bottom 15% of canvas ──
		let poolGrad = viz.ctx.createLinearGradient(0, poolSurface, 0, poolBottom);
		let dr = Math.floor(r * 0.25), dg = Math.floor(g * 0.25), db = Math.floor(b * 0.25);
		poolGrad.addColorStop(0, "rgba(" + Math.floor(r * 0.4) + "," + Math.floor(g * 0.4) + "," + Math.floor(b * 0.4) + ",0.5)");
		poolGrad.addColorStop(1, "rgba(" + dr + "," + dg + "," + db + ",0.7)");
		viz.ctx.fillStyle = poolGrad;
		viz.ctx.fillRect(0, poolSurface, viz.width, poolBottom - poolSurface);

		// Pool surface highlight line
		viz.ctx.beginPath();
		viz.ctx.moveTo(0, poolSurface);
		viz.ctx.lineTo(viz.width, poolSurface);
		viz.ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ",0.35)";
		viz.ctx.lineWidth = 1.5;
		viz.ctx.stroke();

		// Water option mappings
		let jetWidthMult = Visual.waterViscosity;      // viscosity -> jet width
		let gravity = 0.3 + (1 - Visual.waterTension) * 0.4; // tension -> gravity for droplets (inverted: high tension = less gravity)
		let hSpread = Visual.waterSpread;               // spread -> horizontal spread

		// ── 2. Draw jets from frequency bins across the canvas ──
		let binStep = Math.max(2, Math.floor(viz.bufferLength / 64));
		for (let i = 0; i < viz.bufferLength; i += binStep) {
			let val = Math.max(0, viz.dataArray[i] + toff);
			let norm = val / 300;
			if (norm < 0.15) continue;

			let xPos = (i / viz.bufferLength) * viz.width;
			let jetHeight = norm * viz.height * 0.7;
			let jetTop = poolSurface - jetHeight;
			let jetWidth = (3 + norm * 8) * jetWidthMult;

			// Tapered jet gradient (wider at base, narrower at top)
			let jetGrad = viz.ctx.createLinearGradient(0, poolSurface, 0, jetTop);
			jetGrad.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.4)");
			jetGrad.addColorStop(0.5, "rgba(" + r + "," + g + "," + b + ",0.25)");
			jetGrad.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0.05)");

			viz.ctx.beginPath();
			viz.ctx.moveTo(xPos - jetWidth, poolSurface);
			viz.ctx.lineTo(xPos - jetWidth * 0.2, jetTop);
			viz.ctx.lineTo(xPos + jetWidth * 0.2, jetTop);
			viz.ctx.lineTo(xPos + jetWidth, poolSurface);
			viz.ctx.closePath();
			viz.ctx.fillStyle = jetGrad;
			viz.ctx.fill();

			// Bright core line for active jets
			if (norm > 0.3) {
				viz.ctx.beginPath();
				viz.ctx.moveTo(xPos, poolSurface);
				viz.ctx.lineTo(xPos, jetTop + jetHeight * 0.1);
				viz.ctx.strokeStyle = "rgba(255,255,255," + (0.1 + norm * 0.2) + ")";
				viz.ctx.lineWidth = 1;
				viz.ctx.stroke();
			}

			// ── 3. Spawn droplets at the jet tip ──
			if (norm > 0.2) {
				let dropCount = 1 + Math.floor(norm * 2);
				for (let d = 0; d < dropCount; d++) {
					if (Visual.#waterDroplets.length < 800) {
						Visual.#waterDroplets.push({
							x: xPos + (Math.random() - 0.5) * jetWidth * 0.6,
							y: jetTop,
							vx: (Math.random() - 0.5) * 3 * hSpread,
							vy: -(1 + Math.random() * 3 * norm),
							radius: 1 + Math.random() * 2.5,
							alpha: 0.4 + Math.random() * 0.4,
							life: 1.0
						});
					}
				}
			}
		}

		// ── Update and draw droplets ──
		let ripples = [];
		for (let i = Visual.#waterDroplets.length - 1; i >= 0; i--) {
			let d = Visual.#waterDroplets[i];
			d.vy += gravity;
			d.x += d.vx;
			d.y += d.vy;
			d.life -= 0.008;

			// Droplet falls below pool surface: remove and create ripple
			if (d.y >= poolSurface) {
				ripples.push({ x: d.x, r: d.radius * 2 + Math.abs(d.vy) * 0.5 });
				Visual.#waterDroplets.splice(i, 1);
				continue;
			}

			// Remove if off-screen or faded
			if (d.x < -20 || d.x > viz.width + 20 || d.y < -50 || d.life <= 0) {
				Visual.#waterDroplets.splice(i, 1);
				continue;
			}

			// Draw droplet
			viz.ctx.beginPath();
			viz.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
			viz.ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (d.alpha * d.life) + ")";
			viz.ctx.fill();
		}

		// ── 4. Draw ripples on pool surface ──
		for (let rp of ripples) {
			for (let ring = 0; ring < 3; ring++) {
				let rippleR = rp.r + ring * 4;
				let rippleAlpha = Math.max(0, 0.2 - ring * 0.06);
				viz.ctx.beginPath();
				viz.ctx.ellipse(rp.x, poolSurface + 1, rippleR, rippleR * 0.25, 0, 0, Math.PI * 2);
				viz.ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + rippleAlpha + ")";
				viz.ctx.lineWidth = 1;
				viz.ctx.stroke();
			}
		}

		// Ambient pool shimmer based on bass
		if (bass > 0.3) {
			let shimmerCount = Math.floor(bass * 5);
			for (let s = 0; s < shimmerCount; s++) {
				let sx = Math.random() * viz.width;
				let sy = poolSurface + Math.random() * (poolBottom - poolSurface) * 0.3;
				viz.ctx.beginPath();
				viz.ctx.arc(sx, sy, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
				viz.ctx.fillStyle = "rgba(255,255,255," + (0.03 + bass * 0.05) + ")";
				viz.ctx.fill();
			}
		}

		return tre;
	}

	/**
	 * Calculates color cycling when fade mode is enabled.
	 */
	static #calculateColors() {
		if (Visual.color.fade) {
			if (!Visual.color.fades.start) {
				Visual.color.saved.r = viz.bar.color.r;
				Visual.color.saved.g = viz.bar.color.g;
				Visual.color.saved.b = viz.bar.color.b;
				Visual.color.fades.state = Math.floor((Visual.color.saved.r / Visual.color.fades.max) / Visual.color.fades.inc);
				viz.bar.color.g = 0;
				viz.bar.color.b = 55;
				Visual.color.fades.start = true;
				Visual.color.fades["gmax"] = Visual.color.fades.max / Visual.color.fades.inc;
				Visual.color.fades["bmax"] = (Visual.color.fades.max / Visual.color.fades.inc) * 2;
				Visual.color.fades["rmax"] = (Visual.color.fades.max / Visual.color.fades.inc) * 3;
			}
			if (Visual.color.fades.state >= 0 && Visual.color.fades.state < Visual.color.fades.gmax) {
				viz.bar.color.g += Visual.color.fades.inc;
				viz.bar.color.r -= Visual.color.fades.inc;
			} else if (Visual.color.fades.state >= Visual.color.fades.gmax && Visual.color.fades.state < Visual.color.fades.bmax) {
				viz.bar.color.b += Visual.color.fades.inc;
				viz.bar.color.g -= Visual.color.fades.inc;
			} else if (Visual.color.fades.state >= Visual.color.fades.bmax && Visual.color.fades.state < Visual.color.fades.rmax) {
				viz.bar.color.b -= Visual.color.fades.inc;
				viz.bar.color.r += Visual.color.fades.inc;
			} else {
				Visual.color.fades.state = 0;
			}
			Visual.color.fades.state++;
		} else {
			if (Visual.color.fades.start) {
				Visual.color.fades.start = false;
				viz.bar.color.r = Visual.color.saved.r;
				viz.bar.color.g = Visual.color.saved.g;
				viz.bar.color.b = Visual.color.saved.b;
			}
		}
	}

	/**
	 * Fetches song lyrics from the server.
	 * @param {string} songName - The song name.
	 * @param {string} artist - The artist name.
	 */
	static getSongLyrics(songName, artist) {
		let a = {
			"src": "assets/php/getSongLyrics.php",
			"args": {
				"songName": songName,
				"artist": artist
			}
		};
		Server.send(a, true, Visual.loadLyrics);
	}

	/**
	 * Displays lyrics at the current playback position.
	 */
	static playLyrics() {
		if (Visual.lyricsEnabled && Visual.lyrics !== undefined)
			Visual.displayLyrics(Math.floor(document.getElementById("player").currentTime * 1000));
	}

	/**
	 * Loads lyrics data into the visualizer.
	 * @param {object} songLyricsObject - The raw lyrics response.
	 */
	static loadLyrics(songLyricsObject) {
		let data = Visual.parseJson(songLyricsObject);
		Visual.lyrics = new Lyrics(data);
	}

	/**
	 * Parses a value to JSON, handling ServerResponse wrappers.
	 * @param {*} value - The value to parse.
	 * @returns {object}
	 */
	static parseJson(value) {
		try {
			if (value instanceof ServerResponse)
				return value.value;
			return JSON.parse(value);
		} catch {
			console.error(value);
		}
	}

	/**
	 * Gets the lyric text for the given time position.
	 * @param {number} currentTime - The current time in milliseconds.
	 * @returns {string}
	 */
	static getCurrentLyrics(currentTime) {
		return Visual.lyrics !== undefined && Object.keys(Visual.lyrics).length > 0
			? Visual.lyrics.getAtTime(currentTime.toString())
			: "";
	}

	/**
	 * Displays lyrics on the caption element.
	 * @param {number} currentTime - The current time in milliseconds.
	 */
	static displayLyrics(currentTime) {
		let text = Visual.getCurrentLyrics(currentTime);
		if (text !== undefined && text !== "]" && Visual.captionElm)
			Visual.captionElm.innerText = text;
	}

	/**
	 * Sets the caption text.
	 * @param {string} textValue - The text to display.
	 */
	static setCaption(textValue = "") {
		if (Visual.captionElm)
			Visual.captionElm.innerText = textValue;
	}
}
