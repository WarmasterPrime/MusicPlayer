
class VRandom {
	
	/**
	 * Returns a random number.
	 * @returns a random number.
	 */
	static next() {
		return VRandom.next(Number.MIN_VALUE);
	}
	/**
	 * Returns a random number.
	 * @param {number} min The minimum allowed value to return.
	 * @returns a random number.
	 */
	static next(min) {
		return VRandom.next(min, Number.MAX_VALUE);
	}
	/**
	 * Returns a random number between a given range.
	 * @param {number} min The minimum allowed value to return.
	 * @param {number} max THe maximum allowed value to return.
	 * @returns a random number.
	 */
	static next(min, max) {
		min = Math.min(min,max);
		max = Math.max(min,max);
		return (Math.random() * (max - min)) + min;
	}
	
}
