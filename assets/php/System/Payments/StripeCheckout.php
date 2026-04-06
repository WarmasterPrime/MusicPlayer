<?php
/**
 * Creates Stripe Checkout Sessions for payments and subscriptions.
 */

require_once __DIR__ . "/StripeApi.php";

class StripeCheckout {

	/**
	 * Creates a Stripe Checkout Session.
	 *
	 * @param string $customerId Stripe customer ID.
	 * @param string $priceId Stripe price ID.
	 * @param string $mode "subscription" or "payment".
	 * @param string $successUrl URL to redirect after successful payment.
	 * @param string $cancelUrl URL to redirect if user cancels.
	 * @param array $metadata Optional metadata to attach to the session.
	 * @return array { session_id, checkout_url } or { error }
	 */
	public static function createSession(
		string $customerId,
		string $priceId,
		string $mode,
		string $successUrl,
		string $cancelUrl,
		array $metadata = []
	): array {
		$data = [
			"customer" => $customerId,
			"mode" => $mode,
			"success_url" => $successUrl,
			"cancel_url" => $cancelUrl,
			"line_items" => [
				[
					"price" => $priceId,
					"quantity" => 1
				]
			]
		];

		if (!empty($metadata)) {
			$data["metadata"] = $metadata;
		}

		// For subscriptions, allow promotion codes
		if ($mode === "subscription") {
			$data["allow_promotion_codes"] = "true";
		}

		$result = StripeApi::post("checkout/sessions", $data);

		if (isset($result["_error"])) {
			$msg = $result["error"]["message"] ?? "Failed to create checkout session.";
			return ["error" => $msg];
		}

		return [
			"session_id" => $result["id"] ?? "",
			"checkout_url" => $result["url"] ?? ""
		];
	}

	/**
	 * Retrieves a Checkout Session by ID.
	 * @param string $sessionId
	 * @return array Stripe session data.
	 */
	public static function getSession(string $sessionId): array {
		return StripeApi::get("checkout/sessions/" . $sessionId, [
			"expand" => ["line_items", "subscription"]
		]);
	}
}
