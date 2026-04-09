import { Api } from "../Api.mjs";
import { Toast } from "../Toast.mjs";

/**
 * Handles PayPal checkout session creation and redirect.
 */
export class StoreCheckout {

	/**
	 * Creates a checkout session and redirects to PayPal for approval.
	 * @param {string} priceId - The local price ID.
	 * @param {string} mode - "subscription" or "payment".
	 * @param {string} [couponCode] - Optional coupon code.
	 */
	static async startCheckout(priceId, mode, couponCode) {
		Toast.success("Preparing checkout...");

		try {
			let payload = {
				"price_id": priceId,
				"mode": mode || "subscription"
			};
			if (couponCode && couponCode.length > 0) {
				payload["coupon_code"] = couponCode;
			}
			let result = await Api.send("assets/php/store/createCheckoutSession.php", payload);

			if (result && result.success && result.approval_url) {
				// Redirect to PayPal for approval
				window.location.href = result.approval_url;
			} else {
				Toast.error(result.message || "Failed to create checkout session.");
			}
		} catch (e) {
			Toast.error("Checkout error. Please try again.");
		}
	}

	/**
	 * Handles checkout callback URL parameters on page load.
	 * Checks for ?checkout=success or ?checkout=cancel in the URL.
	 */
	static handleCallback() {
		let params = new URLSearchParams(window.location.search);
		let status = params.get("checkout");

		if (status === "success") {
			Toast.success("Payment successful! Thank you.");
			StoreCheckout.cleanUrl("checkout");
		} else if (status === "cancel") {
			Toast.error("Checkout was cancelled.");
			StoreCheckout.cleanUrl("checkout");
		} else if (status === "error") {
			Toast.error("There was an error with your payment.");
			StoreCheckout.cleanUrl("checkout");
		}
	}

	/**
	 * Removes a query parameter from the URL without reloading.
	 * @param {string} param
	 */
	static cleanUrl(param) {
		let url = new URL(window.location.href);
		url.searchParams.delete(param);
		let cleanedUrl = url.pathname + (url.search || "") + (url.hash || "");
		window.history.replaceState({}, "", cleanedUrl);
	}
}
