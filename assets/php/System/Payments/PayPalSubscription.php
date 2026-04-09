<?php
/**
 * Manages PayPal subscriptions — retrieving, cancelling, suspending, activating.
 * Also mirrors subscription state in the local store.subscriptions table.
 */

require_once __DIR__ . "/PayPalApi.php";
require_once __DIR__ . "/../Database.php";

class PayPalSubscription {

	/**
	 * Retrieves a subscription from the PayPal API.
	 *
	 * GET /v1/billing/subscriptions/{id}
	 *
	 * @param string $subscriptionId PayPal subscription ID.
	 * @return array Subscription data.
	 */
	public static function get(string $subscriptionId): array {
		return PayPalApi::get("v1/billing/subscriptions/" . $subscriptionId);
	}

	/**
	 * Cancels a PayPal subscription.
	 *
	 * POST /v1/billing/subscriptions/{id}/cancel
	 *
	 * @param string $subscriptionId PayPal subscription ID.
	 * @param string $reason Reason for cancellation.
	 * @return array Result with status or { error }.
	 */
	public static function cancel(string $subscriptionId, string $reason = "Customer requested cancellation"): array {
		$result = PayPalApi::post("v1/billing/subscriptions/" . $subscriptionId . "/cancel", [
			"reason" => $reason
		]);

		// PayPal returns 204 No Content on success
		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to cancel subscription.");
			return ["error" => $msg];
		}

		// Update local mirror
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("
			UPDATE `subscriptions` SET `status` = 'cancelled', `cancel_at_period_end` = 1
			WHERE `paypal_subscription_id` = ?
		");
		$stmt->execute([$subscriptionId]);

		return ["status" => "cancelled", "subscription_id" => $subscriptionId];
	}

	/**
	 * Suspends a PayPal subscription (pauses billing).
	 *
	 * POST /v1/billing/subscriptions/{id}/suspend
	 *
	 * @param string $subscriptionId PayPal subscription ID.
	 * @param string $reason Reason for suspension.
	 * @return array Result with status or { error }.
	 */
	public static function suspend(string $subscriptionId, string $reason = "Customer requested suspension"): array {
		$result = PayPalApi::post("v1/billing/subscriptions/" . $subscriptionId . "/suspend", [
			"reason" => $reason
		]);

		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to suspend subscription.");
			return ["error" => $msg];
		}

		// Update local mirror
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("UPDATE `subscriptions` SET `status` = 'suspended' WHERE `paypal_subscription_id` = ?");
		$stmt->execute([$subscriptionId]);

		return ["status" => "suspended", "subscription_id" => $subscriptionId];
	}

	/**
	 * Activates (resumes) a suspended PayPal subscription.
	 *
	 * POST /v1/billing/subscriptions/{id}/activate
	 *
	 * @param string $subscriptionId PayPal subscription ID.
	 * @param string $reason Reason for reactivation.
	 * @return array Result with status or { error }.
	 */
	public static function activate(string $subscriptionId, string $reason = "Customer requested reactivation"): array {
		$result = PayPalApi::post("v1/billing/subscriptions/" . $subscriptionId . "/activate", [
			"reason" => $reason
		]);

		if (isset($result["_error"])) {
			$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Failed to activate subscription.");
			return ["error" => $msg];
		}

		// Update local mirror
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("UPDATE `subscriptions` SET `status` = 'active' WHERE `paypal_subscription_id` = ?");
		$stmt->execute([$subscriptionId]);

		return ["status" => "active", "subscription_id" => $subscriptionId];
	}

	/**
	 * Syncs a PayPal subscription object to the local store.subscriptions table.
	 * Upserts based on paypal_subscription_id.
	 *
	 * @param array $sub PayPal subscription object (from API or webhook).
	 * @param string|null $userId Optional user ID override (resolved from payer if not provided).
	 */
	public static function syncToLocal(array $sub, ?string $userId = null): void {
		if (!isset($sub["id"])) return;

		$pdo = Database::connect("store");

		// Resolve user_id from paypal_payer_id if not provided
		if ($userId === null && isset($sub["subscriber"]["payer_id"])) {
			$payerId = $sub["subscriber"]["payer_id"];
			$stmt = $pdo->prepare("SELECT `user_id` FROM `accounts` WHERE `paypal_payer_id` = ? LIMIT 1");
			$stmt->execute([$payerId]);
			$userId = $stmt->fetchColumn() ?: null;
		}

		// Fallback: try to resolve by subscription ID from existing record
		if ($userId === null) {
			$stmt = $pdo->prepare("SELECT `user_id` FROM `subscriptions` WHERE `paypal_subscription_id` = ? LIMIT 1");
			$stmt->execute([$sub["id"]]);
			$userId = $stmt->fetchColumn() ?: null;
		}

		if ($userId === null) return;

		$paypalSubId = $sub["id"];
		$paypalPlanId = $sub["plan_id"] ?? "";
		$status = strtolower($sub["status"] ?? "unknown");

		// PayPal uses ISO 8601 date strings, not Unix timestamps
		$periodStart = null;
		if (isset($sub["start_time"])) {
			$dt = DateTime::createFromFormat(DateTime::ATOM, $sub["start_time"]);
			if ($dt) $periodStart = $dt->format("Y-m-d H:i:s");
		}
		// Use billing_info.next_billing_time as period end
		$periodEnd = null;
		if (isset($sub["billing_info"]["next_billing_time"])) {
			$dt = DateTime::createFromFormat(DateTime::ATOM, $sub["billing_info"]["next_billing_time"]);
			if ($dt) $periodEnd = $dt->format("Y-m-d H:i:s");
		}

		$cancelAtEnd = ($status === "cancelled" || ($sub["status_change_note"] ?? "") !== "") ? 1 : 0;

		// Check if exists
		$stmt = $pdo->prepare("SELECT `id` FROM `subscriptions` WHERE `paypal_subscription_id` = ?");
		$stmt->execute([$paypalSubId]);
		$existingId = $stmt->fetchColumn();

		if ($existingId) {
			$stmt = $pdo->prepare("
				UPDATE `subscriptions` SET
					`paypal_plan_id` = ?,
					`status` = ?,
					`current_period_start` = ?,
					`current_period_end` = ?,
					`cancel_at_period_end` = ?
				WHERE `paypal_subscription_id` = ?
			");
			$stmt->execute([$paypalPlanId, $status, $periodStart, $periodEnd, $cancelAtEnd, $paypalSubId]);
		} else {
			$id = Database::generateId(255);
			$stmt = $pdo->prepare("
				INSERT INTO `subscriptions` (`id`, `user_id`, `paypal_subscription_id`, `paypal_plan_id`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			");
			$stmt->execute([$id, $userId, $paypalSubId, $paypalPlanId, $status, $periodStart, $periodEnd, $cancelAtEnd]);
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
