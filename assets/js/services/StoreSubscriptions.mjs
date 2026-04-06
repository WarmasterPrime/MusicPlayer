import { Api } from "../Api.mjs";
import { Toast } from "../Toast.mjs";

/**
 * Fetches and renders the user's subscriptions in the Store sub-tab.
 */
export class StoreSubscriptions {

	static subscriptions = [];
	static loaded = false;

	/**
	 * Loads subscriptions and renders into the container.
	 * @param {HTMLElement} container
	 */
	static async load(container) {
		container.innerHTML = "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.5);'>Loading subscriptions...</div>";

		try {
			let result = await Api.send("assets/php/store/getSubscriptions.php");
			if (result && result.success) {
				StoreSubscriptions.subscriptions = result.subscriptions || [];
				StoreSubscriptions.loaded = true;
			} else {
				StoreSubscriptions.subscriptions = [];
			}
		} catch (e) {
			StoreSubscriptions.subscriptions = [];
		}

		container.innerHTML = StoreSubscriptions.render();
		StoreSubscriptions.attachListeners(container);
	}

	/**
	 * Renders the subscription cards.
	 * @returns {string}
	 */
	static render() {
		if (StoreSubscriptions.subscriptions.length === 0) {
			return "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.4);'>No subscriptions.</div>";
		}

		let html = "";
		for (let sub of StoreSubscriptions.subscriptions) {
			let statusClass = (sub.status === "active" || sub.status === "trialing") ? "" : " canceled";
			let statusLabel = sub.status || "unknown";
			if (sub.cancel_at_period_end == 1 && sub.status === "active") {
				statusLabel = "canceling";
				statusClass = " canceled";
			}

			html += "<div class='subscription-card'>";
			html += "<div class='subscription-card-header'>";
			html += "<span class='subscription-card-name'>" + StoreSubscriptions.escapeHtml(sub.stripe_price_id || "Subscription") + "</span>";
			html += "<span class='subscription-card-status" + statusClass + "'>" + StoreSubscriptions.escapeHtml(statusLabel) + "</span>";
			html += "</div>";

			if (sub.current_period_end) {
				let endDate = StoreSubscriptions.formatDate(sub.current_period_end);
				let label = sub.cancel_at_period_end == 1 ? "Ends" : "Renews";
				html += "<div class='subscription-card-detail'>" + label + ": " + StoreSubscriptions.escapeHtml(endDate) + "</div>";
			}

			html += "<div class='subscription-card-actions'>";
			if (sub.status === "active" && sub.cancel_at_period_end != 1) {
				html += "<button class='modal-form-btn sub-cancel-btn' data-sub-id='" + StoreSubscriptions.escapeAttr(sub.stripe_subscription_id) + "' style='width:auto;font-size:12px;padding:6px 14px;'>Cancel</button>";
			}
			html += "<button class='modal-form-btn sub-portal-btn' style='width:auto;font-size:12px;padding:6px 14px;margin-left:6px;'>Manage Billing</button>";
			html += "</div>";
			html += "</div>";
		}
		return html;
	}

	/**
	 * Attaches event listeners for subscription actions.
	 * @param {HTMLElement} container
	 */
	static attachListeners(container) {
		// Cancel buttons
		container.addEventListener("click", function (event) {
			let cancelBtn = event.target.closest(".sub-cancel-btn");
			if (cancelBtn) {
				let subId = cancelBtn.getAttribute("data-sub-id");
				if (subId) {
					StoreSubscriptions.confirmCancel(subId, container);
				}
				return;
			}

			let portalBtn = event.target.closest(".sub-portal-btn");
			if (portalBtn) {
				StoreSubscriptions.openPortal();
			}
		});
	}

	/**
	 * Confirms and processes subscription cancellation.
	 * @param {string} subscriptionId
	 * @param {HTMLElement} container
	 */
	static async confirmCancel(subscriptionId, container) {
		// Simple confirmation via custom UI
		if (!confirm("Cancel this subscription? It will remain active until the end of the current billing period.")) {
			return;
		}

		try {
			let result = await Api.send("assets/php/store/cancelSubscription.php", {
				"subscription_id": subscriptionId
			});

			if (result && result.success) {
				Toast.success("Subscription will cancel at end of billing period.");
				// Reload subscriptions
				StoreSubscriptions.load(container);
			} else {
				Toast.error(result.message || "Failed to cancel subscription.");
			}
		} catch (e) {
			Toast.error("Error cancelling subscription.");
		}
	}

	/**
	 * Opens the Stripe Customer Portal for self-service billing management.
	 */
	static async openPortal() {
		try {
			let result = await Api.send("assets/php/store/createPortalSession.php");
			if (result && result.success && result.portal_url) {
				window.open(result.portal_url, "_blank");
			} else {
				Toast.error(result.message || "Failed to open billing portal.");
			}
		} catch (e) {
			Toast.error("Error opening billing portal.");
		}
	}

	static formatDate(dateStr) {
		if (!dateStr) return "";
		try {
			let d = new Date(dateStr);
			return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
		} catch (e) {
			return dateStr;
		}
	}

	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
