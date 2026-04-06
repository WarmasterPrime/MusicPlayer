<?php
/**
 * Manages Stripe subscriptions — listing, cancelling, updating.
 * Also mirrors subscription state in the local store.subscriptions table.
 */

require_once __DIR__ . "/StripeApi.php";
require_once __DIR__ . "/../Database.php";

class StripeSubscription {

	/**
	 * Lists subscriptions for a Stripe customer.
	 * @param string $customerId Stripe customer ID.
	 * @return array Array of subscription objects, or error.
	 */
	public static function listForCustomer(string $customerId): array {
		$result = StripeApi::get("subscriptions", [
			"customer" => $customerId,
			"status" => "all",
			"limit" => 100
		]);

		if (isset($result["_error"])) {
			return ["error" => $result["error"]["message"] ?? "Failed to list subscriptions."];
		}

		return $result["data"] ?? [];
	}

	/**
	 * Cancels a subscription (sets cancel_at_period_end by default).
	 * @param string $subscriptionId Stripe subscription ID.
	 * @param bool $immediate If true, cancel immediately. If false, cancel at period end.
	 * @return array Updated subscription or error.
	 */
	public static function cancel(string $subscriptionId, bool $immediate = false): array {
		if ($immediate) {
			$result = StripeApi::delete("subscriptions/" . $subscriptionId);
		} else {
			$result = StripeApi::post("subscriptions/" . $subscriptionId, [
				"cancel_at_period_end" => "true"
			]);
		}

		if (isset($result["_error"])) {
			return ["error" => $result["error"]["message"] ?? "Failed to cancel subscription."];
		}

		// Update local mirror
		self::syncToLocal($result);

		return $result;
	}

	/**
	 * Updates a subscription on Stripe.
	 * @param string $subscriptionId
	 * @param array $data Fields to update.
	 * @return array Updated subscription or error.
	 */
	public static function update(string $subscriptionId, array $data): array {
		$result = StripeApi::post("subscriptions/" . $subscriptionId, $data);

		if (isset($result["_error"])) {
			return ["error" => $result["error"]["message"] ?? "Failed to update subscription."];
		}

		self::syncToLocal($result);

		return $result;
	}

	/**
	 * Retrieves a single subscription from Stripe.
	 * @param string $subscriptionId
	 * @return array
	 */
	public static function get(string $subscriptionId): array {
		return StripeApi::get("subscriptions/" . $subscriptionId);
	}

	/**
	 * Syncs a Stripe subscription object to the local store.subscriptions table.
	 * Upserts based on stripe_subscription_id.
	 *
	 * @param array $sub Stripe subscription object.
	 * @param string|null $userId Optional user ID override (resolved from customer if not provided).
	 */
	public static function syncToLocal(array $sub, ?string $userId = null): void {
		if (!isset($sub["id"])) return;

		$pdo = Database::connect("store");

		// Resolve user_id if not provided
		if ($userId === null && isset($sub["customer"])) {
			require_once __DIR__ . "/StripeCustomer.php";
			$userId = StripeCustomer::getUserId($sub["customer"]);
		}
		if ($userId === null) return;

		$stripeSubId = $sub["id"];
		$stripePriceId = "";
		if (isset($sub["items"]["data"][0]["price"]["id"])) {
			$stripePriceId = $sub["items"]["data"][0]["price"]["id"];
		}
		$status = $sub["status"] ?? "unknown";
		$periodStart = isset($sub["current_period_start"]) ? date("Y-m-d H:i:s", $sub["current_period_start"]) : null;
		$periodEnd = isset($sub["current_period_end"]) ? date("Y-m-d H:i:s", $sub["current_period_end"]) : null;
		$cancelAtEnd = !empty($sub["cancel_at_period_end"]) ? 1 : 0;

		// Check if exists
		$stmt = $pdo->prepare("SELECT `id` FROM `subscriptions` WHERE `stripe_subscription_id` = ?");
		$stmt->execute([$stripeSubId]);
		$existingId = $stmt->fetchColumn();

		if ($existingId) {
			$stmt = $pdo->prepare("
				UPDATE `subscriptions` SET
					`stripe_price_id` = ?,
					`status` = ?,
					`current_period_start` = ?,
					`current_period_end` = ?,
					`cancel_at_period_end` = ?
				WHERE `stripe_subscription_id` = ?
			");
			$stmt->execute([$stripePriceId, $status, $periodStart, $periodEnd, $cancelAtEnd, $stripeSubId]);
		} else {
			$id = Database::generateId(255);
			$stmt = $pdo->prepare("
				INSERT INTO `subscriptions` (`id`, `user_id`, `stripe_subscription_id`, `stripe_price_id`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			");
			$stmt->execute([$id, $userId, $stripeSubId, $stripePriceId, $status, $periodStart, $periodEnd, $cancelAtEnd]);
		}
	}

	/**
	 * Gets the active subscription for a user from the local store.
	 * @param string $userId
	 * @return array|null Subscription record or null.
	 */
	public static function getActiveForUser(string $userId): ?array {
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("
			SELECT * FROM `subscriptions`
			WHERE `user_id` = ? AND `status` IN ('active', 'trialing')
			ORDER BY `created_at` DESC LIMIT 1
		");
		$stmt->execute([$userId]);
		$row = $stmt->fetch();
		return $row ?: null;
	}

	/**
	 * Gets all subscriptions for a user from the local store.
	 * @param string $userId
	 * @return array
	 */
	public static function getAllForUser(string $userId): array {
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("SELECT * FROM `subscriptions` WHERE `user_id` = ? ORDER BY `created_at` DESC");
		$stmt->execute([$userId]);
		return $stmt->fetchAll();
	}
}
