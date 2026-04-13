import { Api } from "./Api.mjs";

/**
 * Manages ad loading and display via Monetag.
 * Subscribers with the no_ads feature bypass ad loading entirely.
 */
export class AdService {

	static #loaded = false;
	static #showAds = false;
	static #zoneId = "";

	/**
	 * Initializes the ad service by checking the server-side config.
	 * If ads should be shown, loads the Monetag script and injects ad units.
	 */
	static async init() {
		try {
			let config = await Api.send("assets/php/getAdConfig.php");
			if (!config || !config.success) return;

			AdService.#showAds = config.show_ads === true;
			AdService.#zoneId = config.zone_id || "";

			// Don't load if ads are disabled or no zone configured
			if (!AdService.#showAds || !AdService.#zoneId || AdService.#zoneId === "XXXXXXX") return;

			AdService.#loadScript();
			AdService.#injectAdUnits();
			AdService.#loaded = true;
		} catch (e) {
			// Ads are non-critical — fail silently
		}
	}

	/**
	 * Loads the Monetag script tag.
	 */
	static #loadScript() {
		if (document.querySelector("script[data-zone='" + AdService.#zoneId + "']")) return;
		let script = document.createElement("script");
		script.async = true;
		script.setAttribute("data-zone", AdService.#zoneId);
		script.src = "https://alwingulla.com/88/tag.min.js";
		document.head.appendChild(script);
	}

	/**
	 * Injects ad unit containers into the page.
	 */
	static #injectAdUnits() {
		let container = document.getElementById("ad-container");
		if (!container) {
			container = document.createElement("div");
			container.id = "ad-container";
			container.className = "ad-container";
			document.body.appendChild(container);
		}
	}

	/**
	 * Removes all ad units and the Monetag script (e.g. after user subscribes).
	 */
	static removeAds() {
		let container = document.getElementById("ad-container");
		if (container) container.remove();
		let script = document.querySelector("script[data-zone]");
		if (script) script.remove();
		AdService.#loaded = false;
		AdService.#showAds = false;
	}

	/**
	 * Whether ads are currently active.
	 * @returns {boolean}
	 */
	static get isActive() {
		return AdService.#loaded && AdService.#showAds;
	}
}
