/**
 * Promise-based API wrapper for server communication.
 */
export class Api {

	/**
	 * Sends a POST request with JSON body to a PHP endpoint.
	 * @param {string} endpoint - The PHP file path relative to project root.
	 * @param {object} data - The request payload.
	 * @returns {Promise<object>}
	 */
	static async send(endpoint, data = {}) {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		});
		return await response.json();
	}

	/**
	 * Sends a GET request to a PHP endpoint.
	 * @param {string} url - The full URL with query parameters.
	 * @returns {Promise<object>}
	 */
	static async get(url) {
		const response = await fetch(url);
		return await response.json();
	}

	/**
	 * Uploads a file with multipart form data.
	 * @param {string} endpoint - The PHP file path.
	 * @param {FormData} formData - The form data containing the file.
	 * @param {Function} onProgress - Optional progress callback (0-100).
	 * @returns {Promise<object>}
	 */
	static upload(endpoint, formData, onProgress = null) {
		return new Promise(function (resolve, reject) {
			let xhr = new XMLHttpRequest();
			xhr.open("POST", endpoint, true);

			if (typeof onProgress === "function") {
				xhr.upload.addEventListener("progress", function (event) {
					if (event.lengthComputable) {
						let percent = Math.round((event.loaded / event.total) * 100);
						onProgress(percent);
					}
				});
			}

			xhr.onload = function () {
				try {
					resolve(JSON.parse(xhr.responseText));
				} catch {
					resolve({ success: false, message: "Invalid response." });
				}
			};

			xhr.onerror = function () {
				reject(new Error("Upload failed."));
			};

			xhr.send(formData);
		});
	}
}
