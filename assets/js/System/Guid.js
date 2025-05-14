/**
 * Manages Graphical User Identification values.
 * @using System;
 */
class Guid {
	
	static #items = [];
	
	#value = [];
	
	constructor() {
		do {
			for(let i=0;i<40;i++)
				this.#value.push(Guid.#getRandomCharCode());
		} while(Guid.contains(this));
		Guid.#items.push(this);
	}
	
	equals(value) {
		if(value instanceof Guid) {
			return value.#value===this.#value;
		} else if(typeof(value)==="string") {
			return value === this.toString();
		}
		return value == this.toString();
	}
	
	toString() {
		let res="";
		for(let i=0;i<this.#value.length;i++)
			res+=(i>0 && i%4===0 ? "-" : "") + String.fromCharCode(this.#value[i]);
		return res;
	}
	
	static contains(value) {
		for(let i=0;i<Guid.#items.length;i++)
			if(Guid.#items[i].equals(value))
				return true;
		return false;
	}
	
	static #getRandomCharCode() {
		switch(VRandom.next(0, 3)) {
			case 0:
				return VRandom.next(97, 122);
			case 1:
				return VRandom.next(65, 90);
			default:
				return VRandom.next(48, 57);
		}
	}
	/**
	 * Creates a new Guid object that can be used to associate an ID to an object.
	 * @returns a Guid object.
	 */
	static newGuid() {
		return new Guid();
	}
	
	
}
