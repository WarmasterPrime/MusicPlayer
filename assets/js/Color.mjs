/**
 * Stores color information as RGBA values.
 */
export class Color {

	/**
	 * Gets the red color value.
	 * @returns {number}
	 */
	get red() {
		return this._red;
	}

	/**
	 * Gets the green color value.
	 * @returns {number}
	 */
	get green() {
		return this._green;
	}

	/**
	 * Gets the blue color value.
	 * @returns {number}
	 */
	get blue() {
		return this._blue;
	}

	/**
	 * Gets the alpha value.
	 * @returns {number}
	 */
	get alpha() {
		return this._alpha;
	}

	/**
	 * Sets the red color value (0-255).
	 * @param {number} value - The red value.
	 */
	set red(value) {
		if (typeof value === "number")
			this._red = Color.#validateRange(value, 0, 255);
	}

	/**
	 * Sets the green color value (0-255).
	 * @param {number} value - The green value.
	 */
	set green(value) {
		if (typeof value === "number")
			this._green = Color.#validateRange(value, 0, 255);
	}

	/**
	 * Sets the blue color value (0-255).
	 * @param {number} value - The blue value.
	 */
	set blue(value) {
		if (typeof value === "number")
			this._blue = Color.#validateRange(value, 0, 255);
	}

	/**
	 * Sets the alpha value (0-1).
	 * @param {number} value - The alpha value.
	 */
	set alpha(value) {
		if (typeof value === "number")
			this._alpha = Color.#validateRange(value, 0, 1);
	}

	/**
	 * Creates a new instance of the Color class.
	 * @param {number} red - The red value (0-255).
	 * @param {number} green - The green value (0-255).
	 * @param {number} blue - The blue value (0-255).
	 * @param {number} alpha - The alpha value (0-1).
	 */
	constructor(red = 0, green = 0, blue = 0, alpha = 1) {
		this._red = 0;
		this._green = 0;
		this._blue = 0;
		this._alpha = 1;
		this.red = red;
		this.green = green;
		this.blue = blue;
		this.alpha = alpha;
	}

	/**
	 * Brightens the color by a given amount.
	 * @param {number} value - The amount to brighten.
	 */
	brighten(value) {
		this.scale(value);
	}

	/**
	 * Darkens the color by a given amount.
	 * @param {number} value - The amount to darken.
	 */
	darken(value) {
		this.scale(value * -1);
	}

	/**
	 * Scales the color by adjusting all channels.
	 * @param {number} value - The amount to adjust.
	 */
	scale(value) {
		this.red += value;
		this.green += value;
		this.blue += value;
	}

	/**
	 * Gets the CSS string representation of the color.
	 * @returns {string}
	 */
	toString() {
		let tmp = this.alpha >= 1;
		let res = tmp ? "rgb" : "rgba";
		return res + "(" + this.red + "," + this.green + "," + this.blue + (tmp ? "" : "," + this.alpha) + ")";
	}

	/**
	 * Validates a number is within the specified range.
	 * @param {number} value - The value to validate.
	 * @param {number} min - The minimum allowed value.
	 * @param {number} max - The maximum allowed value.
	 * @returns {number}
	 */
	static #validateRange(value, min, max) {
		if (value < min) return min;
		if (value > max) return max;
		return value;
	}

	/**
	 * Creates a new Color from RGB values.
	 * @param {number} red - Red (0-255).
	 * @param {number} green - Green (0-255).
	 * @param {number} blue - Blue (0-255).
	 * @returns {Color}
	 */
	static createFromRGB(red, green, blue) {
		return Color.createFromRGBA(red, green, blue, 1);
	}

	/**
	 * Creates a new Color from RGBA values.
	 * @param {number} red - Red (0-255).
	 * @param {number} green - Green (0-255).
	 * @param {number} blue - Blue (0-255).
	 * @param {number} alpha - Alpha (0-1).
	 * @returns {Color}
	 */
	static createFromRGBA(red, green, blue, alpha) {
		return new Color(red, green, blue, alpha);
	}

	/**
	 * Creates a new Color from a hex string.
	 * @param {string} hexString - The hex color string.
	 * @returns {Color}
	 */
	static createFromHex(hexString) {
		let tmpColor = [];
		if (typeof hexString === "string") {
			if (hexString.startsWith("#"))
				hexString = hexString.substring(1);
			let len = hexString.length;
			for (let i = 0; i < len; i += 2)
				if (i + 1 < len)
					tmpColor.push(parseInt(hexString[i] + hexString[i + 1], 16));
		}
		let obj = {
			r: tmpColor.length > 0 ? tmpColor[0] : 0,
			g: tmpColor.length > 1 ? tmpColor[1] : 0,
			b: tmpColor.length > 2 ? tmpColor[2] : 0,
			a: tmpColor.length > 3 ? tmpColor[3] : 1
		};
		return new Color(obj.r, obj.g, obj.b, obj.a);
	}

	/**
	 * Creates a clone of the given Color object.
	 * @param {Color} colorObject - The color to clone.
	 * @returns {Color}
	 */
	static clone(colorObject) {
		return new Color(colorObject.red, colorObject.green, colorObject.blue, colorObject.alpha);
	}
}
