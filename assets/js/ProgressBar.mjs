import { Visual } from "./Visualizer.mjs";

/**
 * Renders a progress bar on the canvas showing the current playback position.
 */
export class ProgressBar {

	#value = 0;

	/**
	 * Gets the current progress value.
	 * @returns {number}
	 */
	get value() {
		return this.#value;
	}

	/**
	 * Sets the progress value as a ratio of duration.
	 * @param {number} value - The progress ratio.
	 */
	set value(value) {
		this.#value = value * this.playerObject.duration;
		this.width = this.value * this.visualizer.width;
	}

	/**
	 * Creates a new ProgressBar instance.
	 * @param {object} visualizerObj - The visualizer data object.
	 * @param {CanvasRenderingContext2D} canvasContext - The canvas rendering context.
	 * @param {object} playerObject - The player instance.
	 */
	constructor(visualizerObj, canvasContext, playerObject) {
		this.playerObject = playerObject;
		this.visualizer = visualizerObj;
		this.context = canvasContext;
		this.#value = this.playerObject.currentTime / this.playerObject.duration;
		this.width = 0;
		this.height = 5;
		this.x = 0;
		this.y = (this.visualizer.height / 2) - this.height;
		this.color = {
			red: 255,
			green: 0,
			blue: 100,
			alpha: 1
		};
	}

	/**
	 * Updates the progress value from the player's current time.
	 */
	update() {
		this.#value = this.playerObject.currentTime / this.playerObject.duration;
		this.width = this.#value * this.visualizer.width;
	}

	/**
	 * Renders the progress bar on the canvas.
	 */
	render(colorObj=undefined) {
		if(colorObj===undefined) {
			colorObj = Visual.color;
		}
		//this.context.fillStyle = `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, ${this.color.alpha})`;
		this.context.fillStyle = `rgba(${colorObj.red}, ${colorObj.green}, ${colorObj.blue}, ${colorObj.alpha||1})`;
		this.context.fillRect(this.x, this.y, this.width, this.height);
		//for(let i=90,o=0;i>0;i-=5,o++) {
		//	//this.context.fillStyle = `rgba(${colorObj.red}, ${colorObj.green}, ${colorObj.blue}, ${colorObj.alpha||(i/100)})`;
		//	//this.context.fillRect(this.x, this.y+this.height+o, this.width+o, 1);
		//	//this.context.fillRect(this.x, this.y-(o), this.width+o, 1);
		//	this.context.fillStyle = `rgba(${colorObj.red}, ${colorObj.green}, ${colorObj.blue}, ${colorObj.alpha||"0.1"})`;
		//	this.context.fillRect(this.x, this.y+this.height+(o/9), this.width+(o/2), 1);
		//}
	}
	
	checkColors(a, b) {
		return (a.red !== b.red || a.green !== b.green || a.blue !== b.blue) || a.red+a.green+a.blue < b.red+b.green+b.blue;
	}
	
}
