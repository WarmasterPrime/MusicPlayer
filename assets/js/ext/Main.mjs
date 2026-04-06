import { Gpu } from "./Gpu.mjs";

/**
 * Module-level configuration state.
 */
let GV_CONF = false;

/**
 * Generates a unique canvas element ID.
 * @returns {string}
 */
function genID() {
	let res = "canvas-display";
	let i = 0;
	let lim = 100;
	while (document.getElementById(res) && i < lim) {
		res = "canvas-display-" + i;
		i++;
	}
	return res;
}

/**
 * Creates and installs a canvas element into the #main-before container.
 * @param {object|string} q - Optional configuration.
 */
export function installCanvas(q = false) {
	if (document.getElementById("main-before")) {
		let par = document.getElementById("main-before");
		let elm = document.createElement("canvas");
		let id = genID();
		let t = typeof q;
		if (t === "string") {
			try { q = JSON.parse(q); } catch {}
		}
		t = typeof q;
		if (t === "object" && q !== null) {
			if (q["id"] !== undefined)
				id = q["id"];
		}
		elm.id = id;
		elm.classList.add("canvas");
		elm.classList.add("display");
		elm.width = window.innerWidth;
		elm.height = window.innerHeight;
		par.appendChild(elm);
		Gpu.ini(document.getElementById(id));
		window.addEventListener("resize", function () { setup(); });
	}
}

/**
 * Renders the hexagon grid background on the canvas.
 * @param {object} q - Color and layout configuration.
 */
export function setup(q = false) {
	let canvasElm = document.getElementById("canvas-display");
	if (!canvasElm) return;
	let ctx = canvasElm.getContext("2d");
	ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

	let r = 150, g = 0, b = 50, a = 0.75;

	if (q === false && GV_CONF !== false && typeof GV_CONF === "object")
		q = GV_CONF;

	if (q && typeof q.color !== "undefined") {
		if (q.color.r !== undefined) r = q.color.r;
		if (q.color.g !== undefined) g = q.color.g;
		if (q.color.b !== undefined) b = q.color.b;
		if (q.color.a !== undefined) a = q.color.a;
	}

	let t = typeof q;
	let obj = {
		"shape": "hexagon",
		"x": 0,
		"y": 0,
		"width": 115,
		"height": 100,
		"border-color": "black",
		"border-size": 1,
		"t-mode": 1,
		"t-count": 0,
		"fill": "radial-gradient",
		"gradient": {
			"x": 115,
			"y": 100,
			"colors": [
				"rgba(" + r + "," + g + "," + b + "," + a + ")",
				"rgba(0,0,0,0.0)"
			]
		}
	};

	if (t === "object" && q !== null) {
		GV_CONF = q;
		if (typeof q["color"] === "object") {
			if (typeof q["color"]["r"] === "number") r = q["color"]["r"];
			if (typeof q["color"]["red"] === "number") r = q["color"]["red"];
			if (typeof q["color"]["g"] === "number") g = q["color"]["g"];
			if (typeof q["color"]["green"] === "number") g = q["color"]["green"];
			if (typeof q["color"]["b"] === "number") b = q["color"]["b"];
			if (typeof q["color"]["blue"] === "number") b = q["color"]["blue"];
			if (typeof q["color"]["a"] === "number") a = q["color"]["a"];
			if (typeof q["color"]["alpha"] === "number") a = q["color"]["alpha"];
		}
		if (typeof q["t-mode"] === "number") obj["t-mode"] = q["t-mode"];
		if (typeof q["t-count"] === "number") obj["t-count"] = q["t-count"];
	}

	let i = -2;
	let o = -2;
	let cols = Math.floor(window.innerWidth / obj.width) + 4;
	let rows = Math.floor(window.innerHeight / obj.height) + 4;
	obj["cols"] = cols;
	obj["rows"] = rows;
	obj["i"] = 0;
	obj["o"] = 0;
	let tmp = 0;
	let tmp0 = {
		"shape": "hexagon",
		"x": 0,
		"y": 0,
		"width": 100,
		"height": 85,
		"border-color": "black",
		"border-size": 1,
		"t-mode": 1,
		"t-count": 0
	};
	let offset = (obj["width"] - tmp0["width"]) - 7;
	tmp0["fill"] = "rgba(0,0,0,0.5)";

	i = -2;
	while (i < cols) {
		o = 0;
		tmp = (i * 18);
		if ((i % 2) === 0) {
			obj["x"] = (i * obj["width"]) - tmp;
			tmp0["x"] = obj["x"] + offset;
		} else {
			obj["x"] = (i * obj["width"]) - (obj["width"] / 256) - tmp;
			tmp0["x"] = obj["x"] + offset;
		}
		while (o < rows) {
			if ((i % 2) === 0) {
				obj["y"] = (o * obj["height"]);
				tmp0["y"] = obj["y"];
			} else {
				obj["y"] = (o * obj["height"]) - (obj["height"] / 1.85);
				tmp0["y"] = obj["y"];
			}
			obj["y"] = obj["y"] + (o * 8);
			tmp0["y"] = obj["y"] + offset;
			Gpu.create(obj);
			Gpu.create(tmp0);
			o++;
		}
		i++;
	}
}

/**
 * Moves the background sphere element to a random position.
 */
export function moveBG() {
	if (document.getElementById("obj")) {
		let elm = document.getElementById("obj");
		let offset = 500;
		elm.style.top = (Math.random() * window.innerHeight + (offset * 2) - offset) / 1.25 + "px";
		elm.style.left = (Math.random() * window.innerWidth + (offset * 2) - offset) / 1.25 + "px";
	}
}
