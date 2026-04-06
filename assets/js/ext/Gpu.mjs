import { Cgi } from "./Cgi.mjs";

/**
 * Graphics Processing Unit wrapper - manages canvas elements and dispatches shape rendering.
 */
export class Gpu {

	static ini_complete = false;
	static client = {
		"screen": {
			"width": window.innerWidth,
			"height": window.innerHeight
		},
		"display": {
			"elm": false,
			"element": function () { return Gpu.localGetElm(); },
			"ctx": false,
			"mode": "2d"
		}
	};

	/**
	 * Initializes the GPU with an optional canvas element.
	 * @param {HTMLCanvasElement} elm - The canvas element.
	 */
	static ini(elm = false) {
		if (elm !== false)
			Gpu.setElement(elm);
		if (Gpu.ini_complete === false)
			Gpu.install();
	}

	/**
	 * Performs the installation process.
	 */
	static install() {
		Gpu.setupEventListeners();
		Gpu.getContext();
	}

	/**
	 * Sets up window resize event listeners.
	 */
	static setupEventListeners() {
		window.addEventListener("resize", function () {
			Gpu.client.screen.width = window.innerWidth;
			Gpu.client.screen.height = window.innerHeight;
			Gpu.updateDisplaySize();
		});
	}

	/**
	 * Updates the canvas element dimensions to match the window.
	 */
	static updateDisplaySize() {
		if (Gpu.client.display.elm !== false) {
			Gpu.client.display.elm.width = Gpu.client.screen.width;
			Gpu.client.display.elm.height = Gpu.client.screen.height;
		}
	}

	/**
	 * Sets the display width.
	 * @param {number} size - The width value.
	 */
	static setWidth(size = false) {
		if (typeof size === "number" && size >= 0)
			Gpu.client.screen.width = size;
	}

	/**
	 * Sets the display height.
	 * @param {number} size - The height value.
	 */
	static setHeight(size = false) {
		if (typeof size === "number" && size >= 0)
			Gpu.client.screen.height = size;
	}

	/**
	 * Sets the display canvas element.
	 * @param {HTMLElement} parent_element - The canvas element.
	 * @returns {boolean}
	 */
	static setElement(parent_element = false) {
		let t = Gpu.is_element(parent_element);
		let res = false;
		if (t === true) {
			Gpu.client.display.elm = parent_element;
			res = true;
		}
		return res;
	}

	/**
	 * Checks if the parameter is an HTML element.
	 * @param {*} q - The value to check.
	 * @returns {boolean}
	 */
	static is_element(q = false) {
		let res = false;
		let t = typeof q;
		if (t === "object" || t === "element") {
			try {
				res = q instanceof HTMLElement;
			} catch {}
		}
		return res;
	}

	/**
	 * Creates a 2D canvas rendering context.
	 */
	static getContext() {
		if (Gpu.client.display.elm !== false) {
			if (Gpu.client.display.ctx === false)
				Gpu.client.display.ctx = Gpu.client.display.elm.getContext(Gpu.client.display.mode);
		}
	}

	/**
	 * Dispatches shape creation to the appropriate Cgi method.
	 * @param {object} q - The shape configuration object.
	 * @returns {boolean}
	 */
	static create(q = false) {
		let res = false;
		if (Gpu.is_array(q)) {
			let shape = Gpu.getShape(q);
			let obj = {
				"shape": shape,
				"x": Gpu.getX(q),
				"y": Gpu.getY(q),
				"w": Gpu.getW(q),
				"h": Gpu.getH(q),
				"ctx": Gpu.client.display.ctx,
				"elm": Gpu.client.display.elm,
				"fill": Gpu.getFill(q),
				"border-color": Gpu.getBC(q),
				"border-size": Gpu.getBS(q),
				"data": q
			};
			if (shape === "line") Cgi.line(obj);
			else if (shape === "triangle") Cgi.triangle(obj);
			else if (shape === "box") Cgi.box(obj);
			else if (shape === "hexagon") Cgi.hexagon(obj);
			else if (shape === "pentagon") Cgi.pentagon(obj);
		}
		return res;
	}

	/**
	 * Gets the border color from the config.
	 * @param {object} q - The config object.
	 * @returns {string|boolean}
	 */
	static getBC(q = false) {
		let res = false;
		if (Gpu.is_array(q) && q["border-color"] && typeof q["border-color"] === "string")
			res = q["border-color"].toLowerCase();
		return res;
	}

	/**
	 * Gets the border size from the config.
	 * @param {object} q - The config object.
	 * @returns {number|boolean}
	 */
	static getBS(q = false) {
		let res = false;
		if (Gpu.is_array(q) && q["border-size"]) {
			if (typeof q["border-size"] === "string")
				q["border-size"] = parseFloat(q["border-size"]);
			if (typeof q["x"] === "number")
				res = q["border-size"];
		}
		return res;
	}

	/**
	 * Gets the fill color from the config.
	 * @param {object} q - The config object.
	 * @returns {string|boolean}
	 */
	static getFill(q = false) {
		let res = false;
		if (Gpu.is_array(q)) {
			let sel = q["fill"] || q["color"] || q["background-color"] || q["background"];
			if (typeof sel === "string")
				res = sel.toLowerCase();
		}
		return res;
	}

	/**
	 * Gets the shape name from the config.
	 * @param {object} q - The config object.
	 * @returns {string|boolean}
	 */
	static getShape(q = false) {
		let res = false;
		if (Gpu.is_array(q) && q["shape"] && typeof q["shape"] === "string")
			res = q["shape"].toLowerCase();
		return res;
	}

	/**
	 * Gets the x position from the config.
	 * @param {object} q - The config object.
	 * @returns {number}
	 */
	static getX(q = false) {
		let res = 0;
		if (Gpu.is_array(q) && q["x"] !== undefined) {
			if (typeof q["x"] === "string") q["x"] = parseFloat(q["x"]);
			if (typeof q["x"] === "number") res = q["x"];
		}
		return res;
	}

	/**
	 * Gets the y position from the config.
	 * @param {object} q - The config object.
	 * @returns {number}
	 */
	static getY(q = false) {
		let res = 0;
		if (Gpu.is_array(q) && q["y"] !== undefined) {
			if (typeof q["y"] === "string") q["y"] = parseFloat(q["y"]);
			if (typeof q["y"] === "number") res = q["y"];
		}
		return res;
	}

	/**
	 * Gets the width from the config.
	 * @param {object} q - The config object.
	 * @returns {number}
	 */
	static getW(q = false) {
		let res = 0;
		if (Gpu.is_array(q) && q["width"]) {
			if (typeof q["width"] === "string") q["width"] = parseFloat(q["width"]);
			if (typeof q["width"] === "number") res = q["width"];
		}
		return res;
	}

	/**
	 * Gets the height from the config.
	 * @param {object} q - The config object.
	 * @returns {number}
	 */
	static getH(q = false) {
		let res = 0;
		if (Gpu.is_array(q) && q["height"]) {
			if (typeof q["height"] === "string") q["height"] = parseFloat(q["height"]);
			if (typeof q["height"] === "number") res = q["height"];
		}
		return res;
	}

	/**
	 * Checks if the value is an array or object.
	 * @param {*} q - The value to check.
	 * @returns {boolean}
	 */
	static is_array(q = false) {
		let t = typeof q;
		return t === "object" && q !== null;
	}

	/**
	 * Returns the current display element.
	 * @returns {HTMLCanvasElement|boolean}
	 */
	static localGetElm() {
		return Gpu.client["display"]["elm"];
	}
}
