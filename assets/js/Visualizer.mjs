import { Color } from "./Color.mjs";
import { ProgressBar } from "./ProgressBar.mjs";
import { SongInfo } from "./SongInfo.mjs";
import { Lyrics } from "./Lyrics.mjs";
import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";
import { Sys } from "./Sys.mjs";
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
		viz.elm.height = window.innerHeight - 65;
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
		
		//viz.color.red = Visual.color.red;
		//viz.color.green = Visual.color.green;
		//viz.color.blue = Visual.color.blue;
		//if(Visual.progBarElm) {
		//	Visual.progBarElm.color.red = Visual.color.red;
		//	Visual.progBarElm.color.green = Visual.color.green;
		//	Visual.progBarElm.color.blue = Visual.color.blue;
		//}
	}

	/**
	 * Updates the progress bar colors to match the current visualizer colors.
	 */
	static updateColorBars() {
		if (Visual.progBarElm && Visual.progBarElm.color) {
			Visual.progBarElm.color.red = Visual.color.red;
			Visual.progBarElm.color.green = Visual.color.green;
			Visual.progBarElm.color.blue = Visual.color.blue;
		}
	}

	/**
	 * Resets colors to default values.
	 */
	static resetColors() {
		Visual.color.red = 250;
		Visual.color.green = 50;
		Visual.color.blue = 25;
		if (Visual.progBarElm) {
			Visual.progBarElm.color.red = 255;
			Visual.progBarElm.color.green = 0;
			Visual.progBarElm.color.blue = 100;
		}
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
			viz.elm.width = window.innerWidth - 1;
			viz.width = viz.elm.width;
			viz.height = viz.elm.height;
			viz.bar.maxHeight = Visual.getMaxHeight();
			viz.bar.width = viz.width / (viz.bufferLength * 2);
			Visual.xOffset = 0;
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
			if (Visual.progressBarVisible && Visual.progBarElm) {
				Visual.progBarElm.update();
				Visual.progBarElm.render(Visual.color);
			}
			Visual.#calculateColors();
			let tre = 0;
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
			}
			if (newBGState) {
				if (tre > 0) {
					let mdiff = (Visual.last_measurement / viz.dataArray[0]);
					if (mdiff < 1 && mdiff > 0.85)
						Sys.newLocation();
				}
				if (Visual.last_measurement !== viz.dataArray[0])
					Visual.last_measurement = viz.dataArray[0];
			}
		}
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
		let i = 0, u = 0, xx = (viz.bar.width + 1) * (viz.bufferLength + Visual.xOffset), tre = 0, toff = 150, x = 0, ii = viz.bufferLength - viz.bar.width;
		viz.ctx.lineWidth = 2;
		let tmpData = [];
		let region;
		let colorCalc = Color.createFromRGB(0, 0, 0);
		if (Visual.fillPolygon) {
			region = new Path2D();
			region.moveTo(0, viz.height);
		} else {
			viz.ctx.beginPath();
			viz.ctx.moveTo(0, viz.height);
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
		let i = 0, u = 0, tre = 0, toff = 150, counter = 0;
		let totalWidth = (viz.bar.width + 1) * (viz.bufferLength * 2);
		let startX = (viz.width - totalWidth) / 2;
		let ii = viz.bufferLength - viz.bar.width;
		let x = startX;
		let xx = startX + ((viz.bar.width + 1) * viz.bufferLength);
		viz.ctx.beginPath();
		viz.ctx.moveTo(startX, viz.height);
		viz.ctx.lineWidth = 2;
		let tmpData = [];
		let lastData = {};
		let color = Color.createFromRGB(0, 0, 0);
		for (o = viz.bufferLength; o >= 0; o--) {
			let y = ((viz.dataArray[o] + toff) / viz.bar.height) * viz.bar.maxHeight;
			let calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			color.red = viz.bar.color.r * calc;
			color.green = viz.bar.color.g * calc;
			color.blue = viz.bar.color.b * calc;
			viz.ctx.strokeStyle = color.toString();
			let tmpX = x + (i * Visual.xOffset);
			let tmpY = viz.height - y;
			if (counter > 0 && counter % 2 === 0) {
				viz.ctx.quadraticCurveTo(lastData.x, lastData.y, tmpX, tmpY);
				viz.ctx.moveTo(tmpX, tmpY);
			}
			lastData = { x: tmpX, y: tmpY };
			x += viz.bar.width + 1;
			i++;
			y = ((viz.dataArray[u] + toff) / viz.bar.height) * viz.bar.maxHeight;
			calc = Math.min(1.0, (y / viz.height) * 1.6 + 0.15);
			color = Color.createFromRGB(viz.bar.color.r * calc, viz.bar.color.g * calc, viz.bar.color.b * calc);
			viz.ctx.strokeStyle = color.toString();
			tmpData.push({
				x: xx + (ii * Visual.xOffset),
				y: viz.height - y,
				color: color
			});
			if (viz.dataArray[u]) tre += viz.dataArray[u] + toff;
			u++;
			xx += viz.bar.width + 1;
			ii++;
			counter++;
		}
		for (let itu = 0; itu < tmpData.length; itu++) {
			if (itu > 0 && itu % 2 === 0) {
				viz.ctx.strokeStyle = tmpData[itu].color.toString();
				viz.ctx.quadraticCurveTo(lastData.x, lastData.y, tmpData[itu].x, tmpData[itu].y);
				viz.ctx.moveTo(tmpData[itu].x, tmpData[itu].y);
			}
			lastData = { x: tmpData[itu].x, y: tmpData[itu].y };
		}
		viz.ctx.quadraticCurveTo(lastData.x, lastData.y, window.innerWidth, window.innerHeight);
		viz.ctx.quadraticCurveTo(window.innerWidth, window.innerHeight, window.innerWidth * 1.1, window.innerHeight * 1.1);
		viz.ctx.stroke();
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
				if (Visual.progBarElm) {
					Visual.progBarElm.color.red = 255;
					Visual.progBarElm.color.green = 0;
					Visual.progBarElm.color.blue = 100;
				}
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
