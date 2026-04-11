<?php
/**
 * Updates user profile fields (username, email, authority)
 * and syncs feature flags (grants new, revokes removed).
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("UserAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$admin = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$userId = $input["user_id"] ?? "";

if (empty($userId)) {
	echo json_encode(["success" => false, "message" => "User ID required."]);
	exit;
}

$fields = [];
$params = [];

if (isset($input["username"]) && strlen(trim($input["username"])) >= 3) {
	$fields[] = "`username` = ?";
	$params[] = trim($input["username"]);
}
if (isset($input["email"])) {
	$fields[] = "`email` = ?";
	$params[] = trim($input["email"]);
}
if (isset($input["authority"])) {
	$fields[] = "`authority` = ?";
	$params[] = $input["authority"];
}

try {
	$pdo = Database::connect("accounts");

	// Update user profile fields
	if (!empty($fields)) {
		$params[] = $userId;
		$sql = "UPDATE `users` SET " . implode(", ", $fields) . " WHERE `id` = ?";
		$pdo->prepare($sql)->execute($params);
	}

	// Sync feature flags if provided
	if (isset($input["features"]) && is_array($input["features"])) {
		$desired = $input["features"];

		// Get current granted features for this user
		$stmt = $pdo->prepare("SELECT `feature_key` FROM `feature_flags` WHERE `user_id` = ?");
		$stmt->execute([$userId]);
		$current = $stmt->fetchAll(PDO::FETCH_COLUMN);

		// Grant new features (checked but not currently granted)
		$toGrant = array_diff($desired, $current);
		foreach ($toGrant as $featureKey) {
			$id = Database::generateId(255);
			$stmt = $pdo->prepare("INSERT INTO `feature_flags` (`id`, `user_id`, `feature_key`, `granted`, `granted_by`) VALUES (?, ?, ?, 1, ?)");
			$stmt->execute([$id, $userId, $featureKey, $admin["id"]]);
		}

		// Revoke removed features (currently granted but unchecked)
		$toRevoke = array_diff($current, $desired);
		if (!empty($toRevoke)) {
			$placeholders = implode(",", array_fill(0, count($toRevoke), "?"));
			$revokeParams = array_merge([$userId], array_values($toRevoke));
			$pdo->prepare("DELETE FROM `feature_flags` WHERE `user_id` = ? AND `feature_key` IN ($placeholders)")->execute($revokeParams);
		}
	}

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	// Duplicate username/email
	if ($e->getCode() == 23000) {
		echo json_encode(["success" => false, "message" => "Username or email already taken."]);
	} else {
		echo json_encode(["success" => false, "message" => "Error updating user."]);
	}
}
