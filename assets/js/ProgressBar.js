
class ProgressBar {

	#value = 0;

	get value() {
		return this.#value;
	}

	set value(value) {
		this.#value = value * this.playerObject.duration;
		this.width = this.value * this.visualizer.width;
	}

	/**
	 * 
	 * @param {any} visualizerObj
	 * @param {CanvasRenderingContext2D} canvasContext
	 * @param {any} playerObject
	 */
	constructor(visualizerObj, canvasContext, playerObject) {
		this.playerObject = playerObject;
		this.visualizer = visualizerObj;
		this.context = canvasContext;
		this.#value = this.playerObject.currentTime / this.playerObject.duration
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
		/** Bass intensity (0-1) for reactive glow effect. */
		this.bassIntensity = 0;
	}

	update() {
		this.#value = this.playerObject.currentTime / this.playerObject.duration;
		this.width = this.#value * this.visualizer.width;
	}

	render() {
		let r = this.color.red;
		let g = this.color.green;
		let b = this.color.blue;
		let a = this.color.alpha;
		let bass = this.bassIntensity;

		if (bass > 0.05) {
			let glowRadius = 4 + bass * 18;
			let glowAlpha = 0.3 + bass * 0.7;
			this.context.save();
			this.context.shadowColor = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
			this.context.shadowBlur = glowRadius;
			this.context.shadowOffsetX = 0;
			this.context.shadowOffsetY = 0;
			this.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
			this.context.fillRect(this.x, this.y, this.width, this.height);
			if (bass > 0.4) {
				this.context.fillRect(this.x, this.y, this.width, this.height);
			}
			this.context.restore();
		} else {
			this.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
			this.context.fillRect(this.x, this.y, this.width, this.height);
		}
	}


}
