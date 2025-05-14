
class VColor {
	
	#red = 0;
	#green = 0;
	#blue = 0;
	#alpha = 1.0;
	
	get red() {return this.#red;}
	get green() {return this.#green;}
	get blue() {return this.#blue;}
	get alpha() {return this.#alpha;}
	/**
	 * @property {number|int}
	 */
	set red(value) {
		if(VColor.#isNumber(value))
			this.#red = VColor.#isValidColorRange(value) ? value : VColor.#getClosest(value, 0, 255);
	}
	/**
	 * @property {number|int}
	 */
	set green(value) {
		if(VColor.#isNumber(value))
			this.#green = VColor.#isValidColorRange(value) ? value : VColor.#getClosest(value, 0, 255);
	}
	/**
	 * @property {number|int}
	 */
	set blue(value) {
		if(VColor.#isNumber(value))
			this.#blue = VColor.#isValidColorRange(value) ? value : VColor.#getClosest(value, 0, 255);
	}
	/**
	 * @property {number|float}
	 */
	set alpha(value) {
		if(VColor.#isNumber(value))
			this.#blue = VColor.#isValidAlphaRange(value) ? value : VColor.#getClosest(value, 0, 1);
	}
	
	
	/**
	 * Creates a new structured object storing a color.
	 * @param {number|int} red The red intensity.
	 * @param {number|int} green The green intensity.
	 * @param {number|int} blue The blue intensity.
	 * @param {number|float} alpha The alpha/transparency.
	 */
	constructor(red, green, blue, alpha) {
		this.#red = red;
		this.#green = green;
		this.#blue = blue;
		this.#alpha = alpha;
	}
	/**
	 * Gets the string representation of this object.
	 * @returns {string}
	 */
	toString() {
		return this.toString("");
	}
	/**
	 * Gets the string representation of this object.
	 * @param {string} format The format in which to return this object as.
	 * @returns {string}
	 */
	toString(format) {
		switch(format.toLowerCase()) {
			case "x":
				return VColor.#getHex(this.red) + VColor.#getHex(this.green) + VColor.#getHex(this.blue) + VColor.#getAlphaHex(this.alpha);
			default:
				return "rgba(" + this.red.toString() + "," + this.green.toString() + "," + this.blue.toString() + "," + this.alpha.toString() + ")";
		}
	}
	/**
	 * Converts a decimal value into its hexadecimal representation.
	 * @param {number} value The decimal number to convert.
	 * @returns {string}
	 */
	static #getHex(value) {
		return value.toString(16).toUpperCase();
	}
	/**
	 * Determines if the given value is of a numerical data-type.
	 * @param {*} value The object to analyze.
	 * @returns a boolean representation of the result.
	 */
	static #isNumber(value) {return typeof(value)==="number";}
	/**
	 * Determines if the given value is within the minimum and maximum range.
	 * @param {number} value The value to analyze.
	 * @param {number} min The minimum value accepted.
	 * @param {number} max The maximum value accepted.
	 * @returns a boolean representation of the result.
	 */
	static #isInRange(value, min, max) {
		return value>=min && value<=max;
	}
	/**
	 * Determines the value that is closest to the given numerical value.
	 * @param {number} value The value to analyze.
	 * @param {number} min The minimum value.
	 * @param {number} max The maximum value.
	 * @returns either the min or max numerical value that is closest to the given value.
	 */
	static #getClosest(value, min, max) {
		min = Math.min(min, max);
		max = Math.max(min, max);
		return Math.min(Math.abs(value-min), Math.abs(value-max));
	}
	/**
	 * Determines if the given color value is within the valid color range of 0 and 255.
	 * @param {number} value 
	 * @returns {boolean} a boolean representation of the result.
	 */
	static #isValidColorRange(value) {return VColor.#isNumber(value) && VColor.#isInRange(value, 0, 255);}
	/**
	 * Determines if the given value is a valid alpha value.
	 * @param {number|float} value The value to analyze.
	 * @returns {boolean} a boolean representation of the result.
	 */
	static #isValidAlphaRange(value) {return VColor.#isInRange(value, 0, 1);}
	/**
	 * Gets the hexadecimal representation of the given alpha value.
	 * @param {number|float} value The alpha value to convert.
	 * @returns {string}
	 */
	static #getAlphaHex(value) {
		return (value * 255).toString(16).toUpperCase();
	}
	
}
