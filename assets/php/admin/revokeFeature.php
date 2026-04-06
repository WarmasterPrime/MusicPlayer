<?php
/**
 * Revokes a manually granted feature from a user.
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

$input = json_decode(file_get_contents("php://input"), true);
$userId = $input["user_id"] ?? "";
$featureKey = $input["feature_key"] ?? "";

if (empty($userId) || empty($featureKey)) {
	echo json_encode(["success" => false, "message" => "User ID and feature key required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("DELETE FROM `feature_flags` WHERE `user_id` = ? AND `feature_key` = ?");
	$stmt->execute([$userId, $featureKey]);

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error revoking feature."]);
}
