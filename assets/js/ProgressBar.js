
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
		console.log(this.visualizer);
		this.y = (this.visualizer.height / 2) - this.height;
		this.color = {
			red: 255,
			green: 0,
			blue: 100,
			alpha: 1
		};
	}

	update() {
		this.#value = this.playerObject.currentTime / this.playerObject.duration;
		this.width = this.#value * this.visualizer.width;
	}

	render() {
		this.context.fillStyle = `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, ${this.color.alpha})`;
		this.context.fillRect(this.x, this.y, this.width, this.height);
	}


}
