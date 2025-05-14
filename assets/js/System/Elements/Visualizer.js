/**
 * Provides a canvas element that enhances rendering capabilities.
 * @using System;
 * @using System.Data;
 */
class Visualizer extends HTMLCanvasElement {
	
	static #Frequencies = Visualizer.#GetAcceptedFrequencies();
	static #instances = [];
	static #initialized = false;
	
	
	static register(tag = "visualizer") {
		if("customElements" in window) {
			customElements.define(tag, this);
		}
	}
	
	static css = `
	:host {
		display: grid;
		inline-size: 100%;
		block-size: 100%;
		overflow: hidden;
	}`;
	
	#_frequencyCount = 512;
	
	get FrequencyCount() {
		return this.#_frequencyCount;
	}
	
	set FrequencyCount(value) {
		if(typeof(value)==="number" && Visualizer.IsBetween(value, Math.pow(2,5), Math.pow(2,15)))
			this.#_frequencyCount = Visualizer.#GetClosest(value, Visualizer.#Frequencies);
	}
	
	constructor(audioElement) {
		this.id = Guid.newGuid();
		this.audioElement = audioElement;
		this.renderType = RenderTypes.bar;
		this.ghostMode = false;
		this.showProgressBar = true;
		this.context = this.getContext("2d");
		this.audioContext = new AudioContext();
		this.audioContextSource = this.audioContext.createMediaElementSource(this.audioElement);
		this.audioAnalyser = this.audioContextSource.createAnalyser();
		this.audioContextSource.connect(this.audioAnalyser);
		this.audioAnalyser.connect(this.audioContext.destination);
		this.audioAnalyser.fftSize = this.FrequencyCount;
		this.bufferLength = this.audioAnalyser.frequencyBinCount;
		this.DataArray = new Float32Array(this.bufferLength);
		this.bar = {
			width: (window.innerWidth / (this.bufferLength * 2)),
			height: this.height,
			color: {
				Red: 255,
				Green: 50,
				Blue: 100,
				Alpha: 1.0
			},
			maxHeight: (window.innerHeight * 2.5) - 100
		};
		this.progressBar = new VProgressBar();
	}
	
	updateRenderDisplay() {
		
	}
	
	static #initialize() {
		if(!Visualizer.#initialized) {
			Visualizer.#initialized = true;
			window.addEventListener("resize", function() {
				Visualizer.#updateRenderingDisplays();
			});
		}
	}
	
	
	
	static #updateRenderingDisplays() {
		for(let i=0;i<Visualizer.#instances.length;i++) {
			let sel = Visualizer.#instances[i];
			sel.updateRenderDisplay();
		}
	}
	/**
	 * Determines if the source value is within the min and max values.
	 * @param {number} source The value to test.
	 * @param {number} min The minimum value acceptable for the source value.
	 * @param {number} max The maximum value acceptable for the source value.
	 * @returns a boolean representation of the result.
	 */
	static IsBetween(source, min, max) {
		return typeof(source)==="number" && typeof(min)==="number" && typeof(max)==="number" && source>=min && source<=max;
	}
	/**
	 * Calculates the value that is closest to the source value.
	 * @param {number} source The value to test.
	 * @param  {...number} values The values to test against the source value.
	 * @returns one of the provided values.
	 */
	static #GetClosest(source, ...values) {
		values.sort();
		let lastValue=values[0];
		let lastDist=Visualizer.#GetDistance(lastValue, source);
		for(let i=1;i<values.length;i++) {
			let currentValue = values[i];
			let currentDist = Visualizer.#GetDistance(currentValue, source);
			if(currentDist<lastDist) {
				lastDist = currentDist;
				lastValue = currentValue;
			}
		}
		return lastValue;
	}
	/**
	 * Calculates the distance/difference between two numerical values.
	 * @param {number} a 
	 * @param {number} b 
	 * @returns the distance/difference between the two values.
	 */
	static #GetDistance(a, b) {
		return Math.max(a,b) - Math.min(a,b);
	}
	
	static #GetAcceptedFrequencies() {
		let res=[];
		for(let i=5;i<16;i++)
			res.push(Math.pow(2, i));
		return res;
	}
	
}
