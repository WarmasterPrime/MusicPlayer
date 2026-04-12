import { Api } from "./Api.mjs";

/**
 * Manages ad loading and display via Google AdSense.
 * Subscribers with the no_ads feature bypass ad loading entirely.
 */
export class AdService {

	static #loaded = false;
	static #showAds = false;
	static #publisherId = "";
	static #adSlot = "";

	/**
	 * Initializes the ad service by checking the server-side config.
	 * If ads should be shown, loads the AdSense script and injects ad units.
	 */
	static async init() {
		try {
			let config = await Api.send("assets/php/getAdConfig.php");
			if (!config || !config.success) return;

			AdService.#showAds = config.show_ads === true;
			AdService.#publisherId = config.publisher_id || "";
			AdService.#adSlot = config.ad_slot || "";

			if (!AdService.#showAds || !AdService.#publisherId) return;

			AdService.#loadScript();
			AdService.#injectAdUnits();
			AdService.#loaded = true;
		} catch (e) {
			// Ads are non-critical — fail silently
		}
	}

	/**
	 * Loads the Google AdSense script tag.
	 */
	static #loadScript() {
		if (document.querySelector("script[src*='adsbygoogle']")) return;
		let script = document.createElement("script");
		script.async = true;
		script.crossOrigin = "anonymous";
		script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AdService.#publisherId;
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

		let ins = document.createElement("ins");
		ins.className = "adsbygoogle";
		ins.style.display = "block";
		ins.setAttribute("data-ad-client", AdService.#publisherId);
		ins.setAttribute("data-ad-slot", AdService.#adSlot);
		ins.setAttribute("data-ad-format", "auto");
		ins.setAttribute("data-full-width-responsive", "true");
		container.appendChild(ins);

		try {
			(window.adsbygoogle = window.adsbygoogle || []).push({});
		} catch (e) {}
	}

	/**
	 * Removes all ad units and the AdSense script (e.g. after user subscribes).
	 */
	static removeAds() {
		let container = document.getElementById("ad-container");
		if (container) container.remove();
		let script = document.querySelector("script[src*='adsbygoogle']");
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
