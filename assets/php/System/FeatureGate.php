<?php
/**
 * Central feature gating logic.
 * Checks subscription status and manual feature grants to determine access.
 */

require_once __DIR__ . "/Database.php";

class FeatureGate {

	/**
	 * Feature definitions: key => [free_limit, paid].
	 * free_limit: 0 means disabled for free users; positive int is a count limit.
	 * paid: true means feature is available to paid subscribers.
	 */
	const FEATURES = [
		"file_upload"             => ["free_limit" => 5,         "paid" => true],
		"cloud_storage"           => ["free_limit" => 104857600, "paid" => true],  // 100MB in bytes
		"creator_badge"           => ["free_limit" => 0,         "paid" => true],
		"playlists"               => ["free_limit" => 3,         "paid" => true],
		"url_shared_playlists"    => ["free_limit" => 0,         "paid" => true],
		"custom_backgrounds"      => ["free_limit" => 0,         "paid" => true],
		"custom_fonts"            => ["free_limit" => 0,         "paid" => true],
		"lyrics_display"          => ["free_limit" => 0,         "paid" => true],
		"lyrics_editing"          => ["free_limit" => 0,         "paid" => true],
		"song_name_customization" => ["free_limit" => 0,         "paid" => true],
	];

	/**
	 * Checks if a user is allowed to use a feature.
	 *
	 * @param string $userId The user's ID.
	 * @param string $featureKey The feature to check.
	 * @return array { allowed: bool, message: string, limit: int|null, current: int|null }
	 */
	public static function check(string $userId, string $featureKey): array {
		if (!isset(self::FEATURES[$featureKey])) {
			return ["allowed" => false, "message" => "Unknown feature.", "limit" => null, "current" => null];
		}

		$feature = self::FEATURES[$featureKey];

		// Check if user has an active subscription
		if (self::hasActiveSubscription($userId)) {
			return ["allowed" => true, "message" => "Active subscription.", "limit" => null, "current" => null];
		}

		// Check manual feature grants
		if (self::hasManualGrant($userId, $featureKey)) {
			return ["allowed" => true, "message" => "Feature manually granted.", "limit" => null, "current" => null];
		}

		// Apply free tier limits
		$freeLimit = $feature["free_limit"];
		if ($freeLimit === 0) {
			return [
				"allowed" => false,
				"message" => "This feature requires a subscription.",
				"limit" => 0,
				"current" => null
			];
		}

		// Count-based limits need current usage
		$current = self::getCurrentUsage($userId, $featureKey);
		if ($current >= $freeLimit) {
			return [
				"allowed" => false,
				"message" => "Free tier limit reached ($current/$freeLimit).",
				"limit" => $freeLimit,
				"current" => $current
			];
		}

		return [
			"allowed" => true,
			"message" => "Within free tier limit.",
			"limit" => $freeLimit,
			"current" => $current
		];
	}

	/**
	 * Gets the user's subscription tier.
	 * @param string $userId
	 * @return string "free" or "paid"
	 */
	public static function getUserTier(string $userId): string {
		return self::hasActiveSubscription($userId) ? "paid" : "free";
	}

	/**
	 * Gets all feature statuses for a user.
	 * @param string $userId
	 * @return array Map of feature_key => { allowed, limit, current }
	 */
	public static function getAllFeatures(string $userId): array {
		$result = [];
		foreach (self::FEATURES as $key => $def) {
			$result[$key] = self::check($userId, $key);
		}
		return $result;
	}

	/**
	 * Checks if a user has an active subscription.
	 * @param string $userId
	 * @return bool
	 */
	private static function hasActiveSubscription(string $userId): bool {
		try {
			$pdo = Database::connect("store");
			$stmt = $pdo->prepare("
				SELECT COUNT(*) FROM `subscriptions`
				WHERE `user_id` = ? AND `status` IN ('active', 'trialing')
			");
			$stmt->execute([$userId]);
			return (int)$stmt->fetchColumn() > 0;
		} catch (PDOException $e) {
			return false;
		}
	}

	/**
	 * Checks if a user has a manual feature grant (not expired).
	 * @param string $userId
	 * @param string $featureKey
	 * @return bool
	 */
	private static function hasManualGrant(string $userId, string $featureKey): bool {
		try {
			$pdo = Database::connect("accounts");
			$stmt = $pdo->prepare("
				SELECT COUNT(*) FROM `feature_flags`
				WHERE `user_id` = ? AND `feature_key` = ? AND `granted` = 1
				AND (`expires_at` IS NULL OR `expires_at` > NOW())
			");
			$stmt->execute([$userId, $featureKey]);
			return (int)$stmt->fetchColumn() > 0;
		} catch (PDOException $e) {
			return false;
		}
	}

	/**
	 * Gets the current usage count for a count-based feature.
	 * @param string $userId
	 * @param string $featureKey
	 * @return int
	 */
	private static function getCurrentUsage(string $userId, string $featureKey): int {
		try {
			switch ($featureKey) {
				case "file_upload":
					$pdo = Database::connect("media");
					$stmt = $pdo->prepare("SELECT COUNT(*) FROM `songs` WHERE `uploaded_by` = ?");
					$stmt->execute([$userId]);
					return (int)$stmt->fetchColumn();

				case "cloud_storage":
					$pdo = Database::connect("media");
					$stmt = $pdo->prepare("
						SELECT COALESCE(SUM(sf.`file_size_bytes`), 0)
						FROM `song_files` sf
						INNER JOIN `songs` s ON sf.`song_id` = s.`id`
						WHERE s.`uploaded_by` = ?
					");
					$stmt->execute([$userId]);
					return (int)$stmt->fetchColumn();

				case "playlists":
					$pdo = Database::connect("media");
					$stmt = $pdo->prepare("SELECT COUNT(*) FROM `playlists` WHERE `owner_uid` = ?");
					$stmt->execute([$userId]);
					return (int)$stmt->fetchColumn();

				default:
					return 0;
			}
		} catch (PDOException $e) {
			return 0;
		}
	}
}
