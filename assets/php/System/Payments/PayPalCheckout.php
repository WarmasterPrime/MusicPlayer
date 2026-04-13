<?php
/**
 * Handles PayPal checkout flows — one-time orders and subscription creation.
 * Replaces StripeCheckout for PayPal-based payments.
 */

require_once __DIR__ . "/PayPalApi.php";

class PayPalCheckout {

	/**
	 * Creates a PayPal order for a one-time payment.
	 *
	 * POST /v2/checkout/orders
	 *
	 * @param int $amountCents Amount in cents (e.g. 999 = $9.99).
	 * @param string $currency Currency code (e.g. "USD").
	 * @param string $description Description shown to the buyer.
	 * @param string $returnUrl URL to redirect after approval.
	 * @param string $cancelUrl URL to redirect if buyer cancels.
	 * @return array { order_id, approval_url } or { error }
	 */
	public static function createOrder(
		int $amountCents,
		string $currency,
		string $description,
		string $returnUrl,
		string $cancelUrl
	): array {
		// PayPal expects decimal amount strings, not cents
		$amountStr = number_format($amountCents / 100, 2, ".", "");

		$data = [
			"intent" => "CAPTURE",
			"purchase_units" => [
				[
					"description" => $description,
					"amount" => [
						"currency_code" => strtoupper($currency),
						"value" => $amountStr
					]
				]
			],
			"application_context" => [
				"return_url" => $returnUrl,
				"cancel_url" => $cancelUrl,
				"brand_name" => "MusicPlayer",
				"landing_page" => "LOGIN",
				"user_action" => "PAY_NOW"
			]
		];

		$result = PayPalApi::post("v2/checkout/orders", $data);

		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to create PayPal order.");
			return ["error" => $msg];
		}

		$approvalUrl = self::getApprovalUrl($result);

		return [
			"order_id" => $result["id"] ?? "",
			"approval_url" => $approvalUrl
		];
	}

	/**
	 * Captures a previously approved order.
	 * Call this after the buyer approves payment and is redirected to returnUrl.
	 *
	 * POST /v2/checkout/orders/{id}/capture
	 *
	 * @param string $orderId The PayPal order ID.
	 * @return array Captured order data or { error }.
	 */
	public static function captureOrder(string $orderId): array {
		$result = PayPalApi::post("v2/checkout/orders/" . $orderId . "/capture");

		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to capture PayPal order.");
			return ["error" => $msg];
		}

		return $result;
	}

	/**
	 * Retrieves an order by ID.
	 *
	 * GET /v2/checkout/orders/{id}
	 *
	 * @param string $orderId The PayPal order ID.
	 * @return array Order data.
	 */
	public static function getOrder(string $orderId): array {
		return PayPalApi::get("v2/checkout/orders/" . $orderId);
	}

	/**
	 * Creates a PayPal subscription with optional coupon discount.
	 *
	 * POST /v1/billing/subscriptions
	 *
	 * When a coupon is provided, the billing cycle pricing is overridden:
	 *   - "forever" duration: the regular cycle price is set to the discounted amount.
	 *   - "once": a 1-cycle trial at the discounted price is prepended, regular stays full.
	 *   - "repeating": an N-cycle trial at the discounted price, regular stays full.
	 *
	 * @param string $planId The PayPal billing plan ID.
	 * @param string $returnUrl URL to redirect after approval.
	 * @param string $cancelUrl URL to redirect if subscriber cancels.
	 * @param string $email Optional subscriber email address.
	 * @param array|null $coupon Optional coupon info with keys:
	 *   discount (int cents), duration (string), duration_in_months (int|null),
	 *   original_amount (int cents), currency (string).
	 * @return array { subscription_id, approval_url } or { error }
	 */
	public static function createSubscription(
		string $planId,
		string $returnUrl,
		string $cancelUrl,
		string $email = "",
		?array $coupon = null
	): array {
		$data = [
			"plan_id" => $planId,
			"application_context" => [
				"brand_name" => "MusicPlayer",
				"return_url" => $returnUrl,
				"cancel_url" => $cancelUrl,
				"user_action" => "SUBSCRIBE_NOW"
			]
		];

		// Include subscriber info if email is provided
		if (strlen($email) > 0) {
			$data["subscriber"] = [
				"email_address" => $email
			];
		}

		// Apply coupon discount by overriding the plan's billing cycle pricing
		if ($coupon && $coupon["discount"] > 0) {
			$originalCents = (int)$coupon["original_amount"];
			$discountCents = (int)$coupon["discount"];
			$discountedCents = max(0, $originalCents - $discountCents);
			$currency = strtoupper($coupon["currency"] ?? "USD");
			$duration = $coupon["duration"] ?? "forever";
			$durationMonths = isset($coupon["duration_in_months"]) ? (int)$coupon["duration_in_months"] : 0;

			$discountedStr = number_format($discountedCents / 100, 2, ".", "");
			$originalStr = number_format($originalCents / 100, 2, ".", "");

			if ($duration === "forever") {
				// Override the regular cycle to the discounted price permanently
				$data["plan"] = [
					"billing_cycles" => [
						[
							"sequence" => 1,
							"tenure_type" => "REGULAR",
							"total_cycles" => 0,
							"pricing_scheme" => [
								"fixed_price" => [
									"value" => $discountedStr,
									"currency_code" => $currency
								]
							]
						]
					]
				];
			} elseif ($duration === "once") {
				// 1-cycle trial at discounted price, then regular at full price
				$data["plan"] = [
					"billing_cycles" => [
						[
							"sequence" => 1,
							"tenure_type" => "TRIAL",
							"total_cycles" => 1,
							"pricing_scheme" => [
								"fixed_price" => [
									"value" => $discountedStr,
									"currency_code" => $currency
								]
							]
						],
						[
							"sequence" => 2,
							"tenure_type" => "REGULAR",
							"total_cycles" => 0,
							"pricing_scheme" => [
								"fixed_price" => [
									"value" => $originalStr,
									"currency_code" => $currency
								]
							]
						]
					]
				];
			} elseif ($duration === "repeating" && $durationMonths > 0) {
				// N-cycle trial at discounted price, then regular at full price
				$data["plan"] = [
					"billing_cycles" => [
						[
							"sequence" => 1,
							"tenure_type" => "TRIAL",
							"total_cycles" => $durationMonths,
							"pricing_scheme" => [
								"fixed_price" => [
									"value" => $discountedStr,
									"currency_code" => $currency
								]
							]
						],
						[
							"sequence" => 2,
							"tenure_type" => "REGULAR",
							"total_cycles" => 0,
							"pricing_scheme" => [
								"fixed_price" => [
									"value" => $originalStr,
									"currency_code" => $currency
								]
							]
						]
					]
				];
			}
		}

		$result = PayPalApi::post("v1/billing/subscriptions", $data);

		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to create PayPal subscription.");
			return ["error" => $msg];
		}

		$approvalUrl = self::getApprovalUrl($result);

		return [
			"subscription_id" => $result["id"] ?? "",
			"approval_url" => $approvalUrl
		];
	}

	/**
	 * Extracts the approval URL from a PayPal response links array.
	 * PayPal responses include a HATEOAS links array with rel-typed URLs.
	 *
	 * @param array $response The PayPal API response.
	 * @return string The approval URL, or empty string if not found.
	 */
	public static function getApprovalUrl(array $response): string {
		if (!isset($response["links"]) || !is_array($response["links"])) {
			return "";
		}

		foreach ($response["links"] as $link) {
			if (isset($link["rel"]) && $link["rel"] === "approve") {
				return $link["href"] ?? "";
			}
		}

		return "";
	}
}
