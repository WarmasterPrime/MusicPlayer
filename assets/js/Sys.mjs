/**
 * Manages background animation speed and movement triggers.
 */
export class Sys {

	static current_speed = 60;
	static enabled = false;
	static can_move = true;

	/**
	 * A callback to move the background element. Set by the app entry point.
	 * @type {Function|null}
	 */
	static moveBGCallback = null;

	/**
	 * Sets the animation speed.
	 * @param {number} q - The speed value in seconds.
	 */
	static setSpeed(q = 60) {
		if (Sys.enabled) {
			if (typeof q === "number") {
				if (q !== Sys.current_speed)
					Sys.current_speed = q;
			}
		}
	}

	/**
	 * Resets the animation speed to default.
	 */
	static resetSpeed() {
		if (Sys.enabled) {
			if (Sys.current_speed !== 60)
				Sys.current_speed = 60;
		}
	}

	/**
	 * Triggers a background location change.
	 */
	static newLocation() {
		if (typeof Sys.moveBGCallback === "function")
			Sys.moveBGCallback();
	}
}
