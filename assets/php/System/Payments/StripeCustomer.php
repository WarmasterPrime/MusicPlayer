<?php
/**
 * Manages Stripe customer creation and retrieval.
 * Links MusicPlayer users to Stripe customers via store.accounts table.
 */

require_once __DIR__ . "/StripeApi.php";
require_once __DIR__ . "/../Database.php";

class StripeCustomer {

	/**
	 * Gets or creates a Stripe customer for the given user.
	 * Checks store.accounts first; if no record, creates customer on Stripe and stores link.
	 *
	 * @param string $userId The MusicPlayer user ID (CHAR(36) UUID).
	 * @param string $email The user's email address.
	 * @param string $name Optional display name for the Stripe customer.
	 * @return array { stripe_customer_id: string, created: bool } or { error: string }
	 */
	public static function getOrCreate(string $userId, string $email, string $name = ""): array {
		$pdo = Database::connect("store");

		// Check existing link
		$stmt = $pdo->prepare("SELECT `stripe_customer_id` FROM `accounts` WHERE `user_id` = ?");
		$stmt->execute([$userId]);
		$existing = $stmt->fetchColumn();

		if ($existing) {
			return ["stripe_customer_id" => $existing, "created" => false];
		}

		// Create customer on Stripe
		$data = ["email" => $email];
		if (strlen($name) > 0) {
			$data["name"] = $name;
		}
		$data["metadata"] = ["musicplayer_user_id" => $userId];

		$result = StripeApi::post("customers", $data);

		if (isset($result["_error"])) {
			$msg = $result["error"]["message"] ?? "Failed to create Stripe customer.";
			return ["error" => $msg];
		}

		$stripeCustomerId = $result["id"] ?? "";
		if (strlen($stripeCustomerId) === 0) {
			return ["error" => "Stripe returned no customer ID."];
		}

		// Store link in store.accounts
		$id = Database::generateId(255);
		$stmt = $pdo->prepare("INSERT INTO `accounts` (`id`, `user_id`, `stripe_customer_id`) VALUES (?, ?, ?)");
		$stmt->execute([$id, $userId, $stripeCustomerId]);

		return ["stripe_customer_id" => $stripeCustomerId, "created" => true];
	}

	/**
	 * Gets the Stripe customer ID for a user, or null if not linked.
	 * @param string $userId
	 * @return string|null
	 */
	public static function getCustomerId(string $userId): ?string {
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("SELECT `stripe_customer_id` FROM `accounts` WHERE `user_id` = ?");
		$stmt->execute([$userId]);
		$result = $stmt->fetchColumn();
		return $result ?: null;
	}

	/**
	 * Gets the MusicPlayer user ID from a Stripe customer ID.
	 * @param string $stripeCustomerId
	 * @return string|null
	 */
	public static function getUserId(string $stripeCustomerId): ?string {
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("SELECT `user_id` FROM `accounts` WHERE `stripe_customer_id` = ?");
		$stmt->execute([$stripeCustomerId]);
		$result = $stmt->fetchColumn();
		return $result ?: null;
	}

	/**
	 * Retrieves a Stripe customer object from the Stripe API.
	 * @param string $customerId Stripe customer ID.
	 * @return array Stripe customer data.
	 */
	public static function get(string $customerId): array {
		return StripeApi::get("customers/" . $customerId);
	}
}
