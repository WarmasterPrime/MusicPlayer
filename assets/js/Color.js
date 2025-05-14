
/**
 * Stores color information.
 */
class Color {
	
	/**
	 * The red color value.
	 */
	get red() {
		return this._red;
	}
	/**
	 * The green color value.
	 */
	get green() {
		return this._green;
	}
	/**
	 * The blue color value.
	 */
	get blue() {
		return this._blue;
	}
	/**
	 * The alpha value.
	 */
	get alpha() {
		return this._alpha;
	}
	/**
	 * The specified color value.
	 * @param {Number} The value to set the color.
	 */
	set red(value) {
		if(typeof value === "number")
			this._red=Color.#validateRange(value, 0, 255);
	}
	/**
	 * The specified color value.
	 * @param {Number} The value to set the color.
	 */
	set green(value) {
		if(typeof value === "number")
			this._green=Color.#validateRange(value, 0, 255);
	}
	/**
	 * The specified color value.
	 * @param {Number} The value to set the color.
	 */
	set blue(value) {
		if(typeof value === "number")
			this._blue=Color.#validateRange(value, 0, 255);
	}
	/**
	 * The specified color value.
	 * @param {Number} The value to set the color.
	 */
	set alpha(value) {
		if(typeof value === "number")
			this._alpha=Color.#validateRange(value, 0, 1);
	}
	
	
	/**
	 * Creates a new instance of the Color class.
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} alpha 
	 */
	constructor(red=0, green=0, blue=0, alpha=1) {
		this._red=0;
		this._green=0;
		this._blue=0;
		this._alpha=1;
		this.red=red;
		this.green=green;
		this.blue=blue;
		this.alpha=alpha;
		this.alphaEncode=this.alpha*255;
		this.hexColor="#"+this.red.toString(16) + this.green.toString(16) + this.blue.toString(16) + this.alphaEncode.toString(16);
		//this.originalColor=Color.clone(this);
	}
	/**
	 * Brightens the color.
	 * @param {Number} value 
	 */
	brighten(value) {
		this.scale(value);
	}
	/**
	 * Darkens the color.
	 * @param {Number} value 
	 */
	darken(value) {
		this.scale(value*-1);
	}
	/**
	 * Scales the color.
	 * @param {Number} value 
	 */
	scale(value) {
		this.red+=value;
		this.green+=value;
		this.blue+=value;
	}
	
	/**
	 * Gets the string representation of the color.
	 * @returns string
	 */
	toString() {
		let tmp=this.alpha>=1;
		let res=tmp ? "rgb" : "rgba";
		return res+"(" + this.red + "," + this.green + "," + this.blue + (tmp ? "" : "," + this.alpha) + ")";
	}
	/**
	 * Validates the range.
	 * @param {Number} value 
	 * @param {Number} min 
	 * @param {Number} max 
	 * @returns 
	 */
	static #validateRange(value, min, max) {
		if(value<min)
			return min;
		if(value>max)
			return max;
		return value;
	}
	/**
	 * Creates a new color object.
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @returns {Color}
	 */
	static createFromRGB(red, green, blue) {
		return Color.createFromRGBA(red, green, blue, 1);
	}
	/**
	 * Creates a new color object.
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} alpha 
	 * @returns {Color}
	 */
	static createFromRGBA(red, green, blue, alpha) {
		return new Color(red, green, blue, alpha);
	}
	/**
	 * Creates a new color object.
	 * @param {string} hexString 
	 * @returns {Color}
	 */
	static createFromHex(hexString) {
		let tmpColor=[];
		if(typeof hexString === "string") {
			if(hexString.startsWith("#"))
				hexString=hexString.substring(1);
			let len=hexString.length;
			for(let i=0;i<len;i+=2)
				if(i+1<len)
					tmpColor.push(parseInt(hexString[i] + hexString[i+1], 16));
		}
		let obj={
			r: tmpColor.length>0 ? tmpColor[0] : 0,
			g: tmpColor.length>1 ? tmpColor[1] : 0,
			b: tmpColor.length>2 ? tmpColor[2] : 0,
			a: tmpColor.length>3 ? tmpColor[3] : 1
		};
		return new Color(obj.r, obj.g, obj.b, obj.a);
	}
	/**
	 * Creates a clone of the color object.
	 * @param {Color} colorObject 
	 * @returns 
	 */
	static clone(colorObject) {
		return new Color(colorObject.red, colorObject.green, colorObject.blue, colorObject.alpha);
	}
	
	
}
