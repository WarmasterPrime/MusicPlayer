<?php
/**
 * Handles PayPal webhook event processing.
 * Verifies signatures via PayPal's server-side verification and dispatches events.
 */

require_once __DIR__ . "/PayPalApi.php";
require_once __DIR__ . "/PayPalSubscription.php";
require_once __DIR__ . "/../Database.php";

class PayPalWebhook {

	/**
	 * Verifies a PayPal webhook signature.
	 * Delegates to PayPalApi::verifyWebhookSignature which calls PayPal's
	 * /v1/notifications/verify-webhook-signature endpoint.
	 *
	 * @param array $headers The incoming HTTP request headers.
	 * @param string $body The raw webhook request body.
	 * @param string $webhookId The PayPal webhook ID (from developer dashboard).
	 * @return bool True if signature is valid.
	 */
	public static function verify(array $headers, string $body, string $webhookId): bool {
		return PayPalApi::verifyWebhookSignature($headers, $body, $webhookId);
	}

	/**
	 * Processes a verified webhook event.
	 * @param array $event The decoded PayPal event object.
	 * @return array { handled: bool, type: string, message: string }
	 */
	public static function process(array $event): array {
		$type = $event["event_type"] ?? "";

		switch ($type) {
			case "BILLING.SUBSCRIPTION.CREATED":
				return self::handleSubscriptionCreated($event["resource"] ?? []);

			case "BILLING.SUBSCRIPTION.UPDATED":
				return self::handleSubscriptionUpdated($event["resource"] ?? []);

			case "BILLING.SUBSCRIPTION.CANCELLED":
				return self::handleSubscriptionCancelled($event["resource"] ?? []);

			case "BILLING.SUBSCRIPTION.SUSPENDED":
				return self::handleSubscriptionSuspended($event["resource"] ?? []);

			case "BILLING.SUBSCRIPTION.ACTIVATED":
				return self::handleSubscriptionActivated($event["resource"] ?? []);

			case "PAYMENT.SALE.COMPLETED":
				return self::handlePaymentCompleted($event["resource"] ?? []);

			case "CHECKOUT.ORDER.APPROVED":
				return self::handleOrderApproved($event["resource"] ?? []);

			default:
				return ["handled" => false, "type" => $type, "message" => "Unhandled event type."];
		}
	}

	/**
	 * Handles BILLING.SUBSCRIPTION.CREATED: syncs new subscription to local table.
	 */
	private static function handleSubscriptionCreated(array $sub): array {
		$userId = self::resolveUserId($sub);
		PayPalSubscription::syncToLocal($sub, $userId);
		return ["handled" => true, "type" => "BILLING.SUBSCRIPTION.CREATED", "message" => "Subscription created and synced."];
	}

	/**
	 * Handles BILLING.SUBSCRIPTION.UPDATED: syncs updated subscription data.
	 */
	private static function handleSubscriptionUpdated(array $sub): array {
		PayPalSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "BILLING.SUBSCRIPTION.UPDATED", "message" => "Subscription updated and synced."];
	}

	/**
	 * Handles BILLING.SUBSCRIPTION.CANCELLED: marks subscription as cancelled.
	 */
	private static function handleSubscriptionCancelled(array $sub): array {
		$sub["status"] = "CANCELLED";
		PayPalSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "BILLING.SUBSCRIPTION.CANCELLED", "message" => "Subscription marked cancelled."];
	}

	/**
	 * Handles BILLING.SUBSCRIPTION.SUSPENDED: marks subscription as suspended.
	 */
	private static function handleSubscriptionSuspended(array $sub): array {
		$sub["status"] = "SUSPENDED";
		PayPalSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "BILLING.SUBSCRIPTION.SUSPENDED", "message" => "Subscription marked suspended."];
	}

	/**
	 * Handles BILLING.SUBSCRIPTION.ACTIVATED: marks subscription as active.
	 */
	private static function handleSubscriptionActivated(array $sub): array {
		$sub["status"] = "ACTIVE";
		PayPalSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "BILLING.SUBSCRIPTION.ACTIVATED", "message" => "Subscription marked active."];
	}

	/**
	 * Handles PAYMENT.SALE.COMPLETED: records a completed payment transaction.
	 * Links to user via subscription ID or payer ID.
	 */
	private static function handlePaymentCompleted(array $sale): array {
		$pdo = Database::connect("store");

		$userId = null;

		// Try to resolve user from the billing agreement (subscription) ID
		$billingAgreementId = $sale["billing_agreement_id"] ?? "";
		if (strlen($billingAgreementId) > 0) {
			$stmt = $pdo->prepare("SELECT `user_id` FROM `subscriptions` WHERE `paypal_subscription_id` = ? LIMIT 1");
			$stmt->execute([$billingAgreementId]);
			$userId = $stmt->fetchColumn() ?: null;
		}

		// Fallback: resolve from payer ID via accounts table
		if ($userId === null) {
			$payerId = "";
			if (isset($sale["payer_id"])) {
				$payerId = $sale["payer_id"];
			}
			if (strlen($payerId) > 0) {
				$stmt = $pdo->prepare("SELECT `user_id` FROM `accounts` WHERE `paypal_payer_id` = ? LIMIT 1");
				$stmt->execute([$payerId]);
				$userId = $stmt->fetchColumn() ?: null;
			}
		}

		if (!$userId) {
			return ["handled" => false, "type" => "PAYMENT.SALE.COMPLETED", "message" => "Could not resolve user for payment."];
		}

		$amountValue = $sale["amount"]["total"] ?? ($sale["amount"]["value"] ?? "0.00");
		$currency = $sale["amount"]["currency"] ?? ($sale["amount"]["currency_code"] ?? "USD");
		$amountCents = (int)round((float)$amountValue * 100);
		$paypalTransactionId = $sale["id"] ?? "";

		$id = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `paypal_capture_id`, `amount_cents`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, 'completed')
		");
		$stmt->execute([
			$id,
			$userId,
			$paypalTransactionId,
			$amountCents,
			strtolower($currency),
			"PayPal payment completed"
		]);

		return ["handled" => true, "type" => "PAYMENT.SALE.COMPLETED", "message" => "Payment recorded."];
	}

	/**
	 * Handles CHECKOUT.ORDER.APPROVED: records a one-time payment approval.
	 */
	private static function handleOrderApproved(array $order): array {
		$pdo = Database::connect("store");

		$userId = null;

		// Resolve user from payer info
		$payerId = $order["payer"]["payer_id"] ?? "";
		if (strlen($payerId) > 0) {
			$stmt = $pdo->prepare("SELECT `user_id` FROM `accounts` WHERE `paypal_payer_id` = ? LIMIT 1");
			$stmt->execute([$payerId]);
			$userId = $stmt->fetchColumn() ?: null;
		}

		if (!$userId) {
			return ["handled" => false, "type" => "CHECKOUT.ORDER.APPROVED", "message" => "Could not resolve user for order."];
		}

		// Extract amount from first purchase unit
		$purchaseUnit = $order["purchase_units"][0] ?? [];
		$amountValue = $purchaseUnit["amount"]["value"] ?? "0.00";
		$currency = $purchaseUnit["amount"]["currency_code"] ?? "USD";
		$amountCents = (int)round((float)$amountValue * 100);
		$orderId = $order["id"] ?? "";
		$description = $purchaseUnit["description"] ?? "PayPal order approved";

		$id = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `paypal_order_id`, `amount_cents`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, 'approved')
		");
		$stmt->execute([
			$id,
			$userId,
			$orderId,
			$amountCents,
			strtolower($currency),
			$description
		]);

		return ["handled" => true, "type" => "CHECKOUT.ORDER.APPROVED", "message" => "Order approval recorded."];
	}

	/**
	 * Resolves a MusicPlayer user_id from a PayPal subscription or payer object.
	 * Checks the store.accounts table by paypal_payer_id.
	 *
	 * @param array $sub PayPal subscription resource.
	 * @return string|null The user_id or null if not found.
	 */
	private static function resolveUserId(array $sub): ?string {
		$payerId = $sub["subscriber"]["payer_id"] ?? "";
		if (strlen($payerId) === 0) return null;

		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("SELECT `user_id` FROM `accounts` WHERE `paypal_payer_id` = ? LIMIT 1");
		$stmt->execute([$payerId]);
		$result = $stmt->fetchColumn();
		return $result ?: null;
	}
}
