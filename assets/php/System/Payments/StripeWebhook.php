<?php
/**
 * Handles Stripe webhook event processing.
 * Verifies signatures and dispatches events to appropriate handlers.
 */

require_once __DIR__ . "/StripeApi.php";
require_once __DIR__ . "/StripeSubscription.php";
require_once __DIR__ . "/StripeCustomer.php";
require_once __DIR__ . "/../Database.php";

class StripeWebhook {

	/**
	 * Processes a verified webhook event.
	 * @param array $event The decoded Stripe event object.
	 * @return array { handled: bool, type: string, message: string }
	 */
	public static function process(array $event): array {
		$type = $event["type"] ?? "";

		switch ($type) {
			case "checkout.session.completed":
				return self::handleCheckoutCompleted($event["data"]["object"] ?? []);

			case "customer.subscription.created":
			case "customer.subscription.updated":
				return self::handleSubscriptionUpdated($event["data"]["object"] ?? []);

			case "customer.subscription.deleted":
				return self::handleSubscriptionDeleted($event["data"]["object"] ?? []);

			case "invoice.paid":
				return self::handleInvoicePaid($event["data"]["object"] ?? []);

			case "invoice.payment_failed":
				return self::handleInvoiceFailed($event["data"]["object"] ?? []);

			default:
				return ["handled" => false, "type" => $type, "message" => "Unhandled event type."];
		}
	}

	/**
	 * Handles checkout.session.completed: records the transaction.
	 */
	private static function handleCheckoutCompleted(array $session): array {
		$customerId = $session["customer"] ?? "";
		$userId = StripeCustomer::getUserId($customerId);
		if (!$userId) {
			return ["handled" => false, "type" => "checkout.session.completed", "message" => "Unknown customer."];
		}

		$pdo = Database::connect("store");

		// Record transaction if payment
		$paymentIntent = $session["payment_intent"] ?? null;
		$amountTotal = $session["amount_total"] ?? 0;
		$currency = $session["currency"] ?? "usd";
		$checkoutId = $session["id"] ?? "";

		$id = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `stripe_payment_intent`, `stripe_checkout_id`, `amount_cents`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
		");
		$stmt->execute([$id, $userId, $paymentIntent, $checkoutId, $amountTotal, $currency, "Checkout completed"]);

		// If subscription mode, sync the subscription
		if (($session["mode"] ?? "") === "subscription" && isset($session["subscription"])) {
			$subId = $session["subscription"];
			if (is_string($subId)) {
				$sub = StripeSubscription::get($subId);
				if (!isset($sub["_error"])) {
					StripeSubscription::syncToLocal($sub, $userId);
				}
			}
		}

		return ["handled" => true, "type" => "checkout.session.completed", "message" => "Transaction recorded."];
	}

	/**
	 * Handles subscription created/updated: syncs to local table.
	 */
	private static function handleSubscriptionUpdated(array $sub): array {
		StripeSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "customer.subscription.updated", "message" => "Subscription synced."];
	}

	/**
	 * Handles subscription deleted: marks as canceled in local table.
	 */
	private static function handleSubscriptionDeleted(array $sub): array {
		$sub["status"] = "canceled";
		StripeSubscription::syncToLocal($sub);
		return ["handled" => true, "type" => "customer.subscription.deleted", "message" => "Subscription canceled."];
	}

	/**
	 * Handles invoice.paid: records successful payment.
	 */
	private static function handleInvoicePaid(array $invoice): array {
		$customerId = $invoice["customer"] ?? "";
		$userId = StripeCustomer::getUserId($customerId);
		if (!$userId) {
			return ["handled" => false, "type" => "invoice.paid", "message" => "Unknown customer."];
		}

		$pdo = Database::connect("store");
		$id = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `stripe_payment_intent`, `amount_cents`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, 'completed')
		");
		$stmt->execute([
			$id,
			$userId,
			$invoice["payment_intent"] ?? null,
			$invoice["amount_paid"] ?? 0,
			$invoice["currency"] ?? "usd",
			"Invoice paid: " . ($invoice["number"] ?? "")
		]);

		return ["handled" => true, "type" => "invoice.paid", "message" => "Payment recorded."];
	}

	/**
	 * Handles invoice.payment_failed: updates subscription status.
	 */
	private static function handleInvoiceFailed(array $invoice): array {
		$subId = $invoice["subscription"] ?? "";
		if (strlen($subId) > 0) {
			$pdo = Database::connect("store");
			$stmt = $pdo->prepare("UPDATE `subscriptions` SET `status` = 'past_due' WHERE `stripe_subscription_id` = ?");
			$stmt->execute([$subId]);
		}
		return ["handled" => true, "type" => "invoice.payment_failed", "message" => "Subscription marked past_due."];
	}
}
