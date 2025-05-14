
/**
 * @using System.Data;
 */
class VProgressBar {
	
	
	#min = 0;
	#max = 100;
	#value = 0;
	
	#currentX = 0;
	
	get min() {return this.#min;}
	/**
	 * @property {number} value The value to represent as the minimum value.
	 */
	set min(value) {
		if(VProgressBar.#isNumber(value))
			this.#min=value;
	}
	
	get max() {return this.#max;}
	/**
	 * @property {number} value The value to represent as the maximum value.
	 */
	set max(value) {
		if(VProgressBar.#isNumber(value))
			this.#max=value;
	}
	/**
	 * @property The value of the progress bar.
	 * @returns {number}
	 */
	get value() {return this.#value;}
	/**
	 * @property {number} value The value to set for the progress bar.
	 */
	set value(value) {
		if(VProgressBar.#isNumber(value)) {
			if(VProgressBar.#isInRange(value, this.#min, this.#max)) {
				this.#value=value;
			}
		}
	}
	
	get top() {return this.clientRect.y;}
	get left() {return this.clientRect.x;}
	get width() {return this.clientRect.width;}
	get height() {return this.clientRect.height;}
	
	set top(value) {this.clientRect.y = value;}
	set left(value) {this.clientRect.x = value;}
	set width(value) {this.clientRect.width = value;}
	set height(value) {this.clientRect.height = value;}
	
	get percentage() {return (this.min + this.value) / this.max;}
	
	
	/**
	 * Creates a new instance of the VProgressBar class.
	 * @param {CanvasRenderingContext2D} canvasContext The HTMLCanvasElement object to render the progress bar on.
	 */
	constructor(canvasContext) {
		this.canvasContext = canvasContext;
		this.clientRect = new VRect(0, (this.canvasContext.canvas.height / 2) + 10, this.canvasContext.canvas.width, 10);
		this.color = new VColor(255, 50, 100, 1.0);
		this.borderSize = 0;
		this.fade = 10;
	}
	/**
	 * Renders the progress bar on the canvas.
	 */
	render() {
		this.canvasContext.fillStyle = this.color.toString();
		let w = this.percentage*this.width;
		this.canvasContext.fillRect(this.left, this.top, w, this.height);
		let color = this.color;
		for(let i=0;i<this.fade;i++) {
			color.alpha-=0.1;
			this.canvasContext.strokeStyle = color.toString();
			this.canvasContext.strokeRect(this.left, this.top, w + i, this.height+i);
		}
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
	
}
