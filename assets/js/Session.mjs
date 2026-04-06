import { Server } from "./lib/Server.mjs";
import { ServerResponse } from "./lib/ServerResponse.mjs";

/**
 * Manages client-side session state by communicating with PHP session endpoints.
 */
export class Session {

	static user = null;
	static authority = "";
	static subscriptionTier = "free";
	static features = {};

	/**
	 * Checks the current session state with the server.
	 * @returns {Promise<boolean>} Whether the user is logged in.
	 */
	static check() {
		return new Promise(function (resolve) {
			let a = {
				"src": "assets/php/checkSession.php",
				"args": {}
			};
			Server.send(a, true, function (response) {
				let data = Session.#unwrap(response);
				try {
					if (typeof data === "string") data = JSON.parse(data);
				} catch {}
				if (data && data.loggedIn === true && data.user) {
					Session.user = data.user;
					Session.authority = data.user.authority || "";
					resolve(true);
				} else {
					Session.user = null;
					Session.authority = "";
					resolve(false);
				}
			});
		});
	}

	/**
	 * Returns whether a user is currently logged in.
	 * @returns {boolean}
	 */
	static isLoggedIn() {
		return Session.user !== null;
	}

	/**
	 * Checks if the current user has a specific authority flag.
	 * @param {string} flag - The authority flag to check.
	 * @returns {boolean}
	 */
	static hasFlag(flag) {
		if (!Session.authority || typeof Session.authority !== "string") return false;
		return Session.authority.split(",").includes(flag);
	}

	/**
	 * Checks if the current user has a specific feature (subscription-based).
	 * @param {string} featureKey
	 * @returns {boolean}
	 */
	static hasFeature(featureKey) {
		if (Session.subscriptionTier !== "free") return true;
		let feature = Session.features[featureKey];
		if (!feature) return false;
		return feature.allowed === true;
	}

	/**
	 * Logs out the current user.
	 * @returns {Promise<void>}
	 */
	static logout() {
		return new Promise(function (resolve) {
			let a = {
				"src": "assets/php/logout.php",
				"args": {}
			};
			Server.send(a, true, function () {
				Session.user = null;
				Session.authority = "";
				Session.subscriptionTier = "free";
				Session.features = {};
				resolve();
			});
		});
	}

	/**
	 * Unwraps a ServerResponse if applicable.
	 * @param {*} value - The response value.
	 * @returns {*}
	 */
	static #unwrap(value) {
		return (value instanceof ServerResponse) ? value.value : value;
	}
}
