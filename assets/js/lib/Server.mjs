import { ServerResponse } from "./ServerResponse.mjs";

/**
 * Manages HTTP requests to a server.
 */
export class Server extends XMLHttpRequest {
	/**
	 * The request headers of the HTTP Request object.
	 */
	#requestHeaders = {
		"Content-Type": "application/x-www-form-urlencoded"
	};

	/**
	 * Creates a new instance of the Server class.
	 */
	constructor() {
		super();
		this.src = undefined;
		this.method = "POST";
		this.callBackFunction = undefined;
		this.properties = function () { return Object.getOwnPropertyDescriptors(this); };
		this.onAbort = undefined;
		this.onError = undefined;
		this.onLoad = undefined;
		this.onLoadEnd = undefined;
		this.onLoadStart = undefined;
		this.onProgress = undefined;
		this.onReadyStateChange = undefined;
		this.onTimeout = undefined;
		this.isOpen = false;
	}

	/**
	 * Gets the content-type header.
	 * @returns {string}
	 */
	get contentType() {
		return this.#requestHeaders["Content-Type"];
	}

	/**
	 * Sets the content-type header.
	 * @param {string} value - The content type value.
	 */
	set contentType(value) {
		if (typeof value === "string")
			this.#requestHeaders["Content-Type"] = value;
	}

	/**
	 * Updates the request headers.
	 */
	#updateRequestHeaders() {
		let item, value;
		for ([item, value] of Object.entries(this.#requestHeaders))
			super.setRequestHeader(item, value);
	}

	/**
	 * Opens a connection.
	 */
	open() {
		if (!this.isOpen) {
			let meInstance = this;
			super.onload = function () { meInstance.#processResponse(this, "onLoad"); };
			super.onabort = function () { meInstance.#processResponse(this, "onAbort"); };
			super.onerror = function () { meInstance.#processResponse(this, "onError"); };
			super.onloadend = function () { meInstance.#processResponse(this, "onLoadEnd"); };
			super.onloadstart = function () { meInstance.#processResponse(this, "onLoadStart"); };
			super.onprogress = function () { meInstance.#processResponse(this, "onProgress"); };
			super.onreadystatechange = function () { meInstance.#processResponse(this, "onReadyStateChange"); };
			super.ontimeout = function () { meInstance.#processResponse(this, "onTimeout"); };
			super.open(this.method, this.src, true);
			this.#updateRequestHeaders();
			this.isOpen = true;
		}
	}

	/**
	 * Closes the connection by aborting.
	 */
	close() {
		if (this.isOpen) {
			this.isOpen = false;
			try {
				super.abort();
			} catch {}
		}
	}

	/**
	 * Processes the response from the server.
	 * @param {XMLHttpRequest} instance - The instance reference of the XMLHttpRequest object.
	 * @param {string} source - The event listener name to call.
	 */
	#processResponse(instance, source) {
		let props = this.properties();
		if (Object.keys(props).includes(source) && props[source].value !== undefined && props[source].value !== null) {
			let cb = props[source].value;
			if (cb instanceof Function) {
				cb.call(this, new ServerResponse(instance.response));
			} else if (typeof cb === "object" && cb.class && cb.method) {
				let obj = cb.class;
				let method = cb.method;
				if (typeof obj[method] === "function") {
					obj[method].call(obj, new ServerResponse(instance.response));
				}
			}
		}
	}

	/**
	 * Sends data to the server.
	 * @param {object} payload - The payload to send to the server.
	 */
	send(payload = null) {
		super.send(Server.isValid(payload) ? Server.serialize(payload) : null);
	}

	/**
	 * Determines if the value is not null and not undefined.
	 * @param {*} value - The value to check.
	 * @returns {boolean}
	 */
	static isValid(value) {
		return value !== undefined && value !== null;
	}

	/**
	 * Serializes an object into a URL-encoded string for the HTTP request payload.
	 * @param {object} payload - A collection that will be iterated through.
	 * @returns {string}
	 */
	static serialize(payload) {
		let item, value;
		let formData = new FormData();
		for ([item, value] of Object.entries(payload))
			formData.append(item, value);
		let res = "";
		for ([item, value] of formData.entries())
			res += (res.length > 0 ? "&" : "") + encodeURI(item) + "=" + encodeURI(value);
		return res;
	}

	/**
	 * Deserializes the input into a JSON object.
	 * @param {string} value - The value to deserialize.
	 * @returns {object|string}
	 */
	static deserialize(value) {
		try {
			return JSON.parse(value);
		} catch {}
		return value;
	}

	/**
	 * Determines if the value is an acceptable JSON string.
	 * @param {*} value - The value to check.
	 * @returns {boolean}
	 */
	static isJson(value) {
		try {
			JSON.stringify(value);
			return true;
		} catch {}
		return false;
	}

	/**
	 * Sends an HTTP request to the destination.
	 * @param {object} args - A JSON object with "src" (string) and "args" (object) properties.
	 * @param {boolean} useAsync - Deprecated compatibility parameter.
	 * @param {Function|object} callBackFunction - The callback function or {class, method} object.
	 */
	static send(args, useAsync = true, callBackFunction) {
		let ins = new Server();
		ins.src = args["src"];
		ins.onLoadEnd = callBackFunction;
		ins.open();
		ins.send(args["args"]);
	}

	/**
	 * Alias for Server.send with capitalized name for backward compatibility.
	 * @param {object} args - Request arguments.
	 * @param {boolean} useAsync - Deprecated compatibility parameter.
	 * @param {Function} callBackFunction - The callback function.
	 */
	static Send(args, useAsync = true, callBackFunction) {
		Server.send(args, useAsync, callBackFunction);
	}

	/**
	 * Serializes a string value into a URL/URI safe string.
	 * @param {string} value - The string value to serialize.
	 * @returns {string}
	 */
	static serializeUrl(value) {
		return encodeURI(value);
	}
}
