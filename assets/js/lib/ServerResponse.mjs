/**
 * Stores HTTP response information.
 */
export class ServerResponse {
	/**
	 * The original response object received.
	 */
	#responseObject;
	/**
	 * The value of the response object after being parsed.
	 */
	#value;

	/**
	 * Creates a new instance of the ServerResponse class.
	 * @param {*} responseObject - The response received from the HTTP request.
	 */
	constructor(responseObject) {
		this.#responseObject = responseObject;
		this.#value = ServerResponse.getJson(this.#responseObject);
	}

	/**
	 * Gets the value of the given response.
	 * @returns {object|string|undefined|null}
	 */
	get value() {
		return this.#value;
	}

	/**
	 * Gets the JSON object representation of the JSON string.
	 * @returns {object|string|undefined|null}
	 */
	get json() {
		return ServerResponse.getJson(this.#responseObject);
	}

	/**
	 * Gets the JSON object representation of the JSON string.
	 * @param {string} value - The string value to parse.
	 * @returns {object}
	 */
	static getJson(value) {
		try {
			return JSON.parse(value);
		} catch (error) {}
		return value;
	}
}
