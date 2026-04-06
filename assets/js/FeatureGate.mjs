import { Api } from "./Api.mjs";
import { Modal } from "./Modal.mjs";
import { Session } from "./Session.mjs";

/**
 * Client-side feature gating.
 * Caches subscription status and provides feature checks + upgrade prompts.
 */
export class FeatureGate {

	static features = {};
	static tier = "free";
	static loaded = false;

	/**
	 * Fetches subscription status from the server and caches it.
	 */
	static async load() {
		if (!Session.isLoggedIn()) {
			FeatureGate.tier = "free";
			FeatureGate.features = {};
			FeatureGate.loaded = true;
			return;
		}
		try {
			let result = await Api.send("assets/php/store/getSubscriptionStatus.php");
			if (result && result.success) {
				FeatureGate.tier = result.tier || "free";
				FeatureGate.features = result.features || {};
			}
		} catch (e) {
			// Silently fail — default to free tier
		}
		FeatureGate.loaded = true;
	}

	/**
	 * Checks if a feature is allowed for the current user.
	 * @param {string} featureKey
	 * @returns {boolean}
	 */
	static check(featureKey) {
		if (FeatureGate.tier !== "free") return true;
		let feature = FeatureGate.features[featureKey];
		if (!feature) return false;
		return feature.allowed === true;
	}

	/**
	 * Gets the limit info for a feature.
	 * @param {string} featureKey
	 * @returns {{ allowed: boolean, limit: number|null, current: number|null, message: string }|null}
	 */
	static getFeatureInfo(featureKey) {
		return FeatureGate.features[featureKey] || null;
	}

	/**
	 * Requires a feature — calls callback if allowed, shows upgrade prompt if not.
	 * @param {string} featureKey
	 * @param {Function} callback - Called if feature is allowed.
	 */
	static requireFeature(featureKey, callback) {
		if (FeatureGate.check(featureKey)) {
			callback();
		} else {
			FeatureGate.showUpgradePrompt(featureKey);
		}
	}

	/**
	 * Shows an upgrade prompt modal for a gated feature.
	 * @param {string} featureKey
	 */
	static showUpgradePrompt(featureKey) {
		let info = FeatureGate.features[featureKey];
		let message = "This feature requires a subscription.";
		if (info && info.message) {
			message = info.message;
		}

		let limitInfo = "";
		if (info && info.limit !== null && info.current !== null) {
			limitInfo = "<div class='upgrade-limit-info'>Usage: " + info.current + " / " + info.limit + "</div>";
		}

		let featureLabel = featureKey.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });

		let html = "";
		html += "<div class='upgrade-prompt'>";
		html += "<div class='modal-form-title'>Upgrade Required</div>";
		html += "<p>" + FeatureGate.escapeHtml(message) + "</p>";
		html += "<div class='upgrade-feature-name'>" + FeatureGate.escapeHtml(featureLabel) + " <span class='upgrade-badge'>PRO</span></div>";
		html += limitInfo;
		html += "<button class='modal-form-btn' id='upgrade-btn'>View Plans</button>";
		html += "<button class='modal-form-btn upgrade-dismiss' id='upgrade-dismiss'>Maybe Later</button>";
		html += "</div>";

		Modal.openRaw(html);
		setTimeout(function () {
			let btn = document.getElementById("upgrade-btn");
			if (btn) {
				btn.addEventListener("click", function () {
					Modal.open("store");
				});
			}
			let dismiss = document.getElementById("upgrade-dismiss");
			if (dismiss) {
				dismiss.addEventListener("click", function () {
					Modal.close();
				});
			}
		}, 0);
	}

	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}
}
