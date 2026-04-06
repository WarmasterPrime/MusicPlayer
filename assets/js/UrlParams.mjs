/**
 * Manages URL query parameters using the browser's URLSearchParams API.
 */
export class UrlParams {

	/**
	 * Gets all current URL query parameters as a key-value object.
	 * @returns {object}
	 */
	static GetParams() {
		let params = new URLSearchParams(window.location.search);
		let res = {};
		for (let [key, value] of params.entries())
			res[key] = value;
		return res;
	}

	/**
	 * Combines a base path with a relative path.
	 * @param {string} a - The base path.
	 * @param {string} b - The relative path.
	 * @returns {string}
	 */
	static combine(a, b) {
		if (a.endsWith("/"))
			a = a.substring(0, a.length - 1);
		if (b.startsWith("/"))
			b = b.substring(1);
		return a + "/" + b;
	}

	/**
	 * Separates the base path from a full path, returning the relative portion.
	 * @param {string} a - The base path to remove.
	 * @param {string} b - The full path.
	 * @returns {string}
	 */
	static separate(a, b) {
		if (a.endsWith("/"))
			a = a.substring(0, a.length - 1);
		if (b.startsWith("/"))
			b = b.substring(1);
		return b.startsWith(a) ? b.substring(a.length) : b;
	}

	/**
	 * Sets a URL query parameter.
	 * @param {string} key - The parameter name.
	 * @param {string} value - The parameter value.
	 */
	static SetParam(key, value) {
		if (typeof key === "string" && (typeof value === "string" || typeof value === "number")) {
			let url = new URL(window.location);
			url.searchParams.set(key, String(value));
			window.history.replaceState({}, "", url);
		}
	}

	/**
	 * Removes a parameter from the URL.
	 * @param {string} paramName - The name of the parameter to remove.
	 */
	static removeParam(paramName) {
		let url = new URL(window.location);
		url.searchParams.delete(paramName);
		window.history.replaceState({}, "", url);
	}
}
