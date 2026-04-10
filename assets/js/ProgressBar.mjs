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
		/** Bass intensity (0-1) for reactive glow effect. Updated by the Visualizer. */
		this.bassIntensity = 0;
	}

	/**
	 * Updates the progress value from the player's current time.
	 */
	update() {
		this.#value = this.playerObject.currentTime / this.playerObject.duration;
		this.width = this.#value * this.visualizer.width;
	}

	/**
	 * Renders the progress bar on the canvas with bass-reactive glow.
	 */
	render(colorObj=undefined) {
		if(colorObj===undefined) {
			colorObj = Visual.color;
		}
		let r = colorObj.red;
		let g = colorObj.green;
		let b = colorObj.blue;
		let a = colorObj.alpha || 1;

		// Bass-reactive glow: apply shadow when bass intensity is above threshold
		let bass = this.bassIntensity;
		if (bass > 0.05) {
			let glowRadius = 4 + bass * 18;   // 4-22px glow radius based on bass
			let glowAlpha = 0.3 + bass * 0.7;  // 0.3-1.0 opacity
			this.context.save();
			this.context.shadowColor = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
			this.context.shadowBlur = glowRadius;
			this.context.shadowOffsetX = 0;
			this.context.shadowOffsetY = 0;
			// Draw the bar with glow
			this.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
			this.context.fillRect(this.x, this.y, this.width, this.height);
			// Second pass for stronger glow on heavy bass
			if (bass > 0.4) {
				this.context.fillRect(this.x, this.y, this.width, this.height);
			}
			this.context.restore();
		} else {
			this.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
			this.context.fillRect(this.x, this.y, this.width, this.height);
		}
	}
	
	checkColors(a, b) {
		return (a.red !== b.red || a.green !== b.green || a.blue !== b.blue) || a.red+a.green+a.blue < b.red+b.green+b.blue;
	}
	
}
