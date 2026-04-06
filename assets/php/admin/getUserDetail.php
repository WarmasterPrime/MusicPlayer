<?php
/**
 * Returns full user detail including subscriptions, transactions, and linked platforms.
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

$userId = $_GET["user_id"] ?? "";
if (empty($userId)) {
	echo json_encode(["success" => false, "message" => "User ID required."]);
	exit;
}

try {
	$pdoAccounts = Database::connect("accounts");
	$pdoStore = Database::connect("store");

	// User info
	$stmt = $pdoAccounts->prepare("SELECT `id`, `username`, `email`, `authority`, `created_at` FROM `users` WHERE `id` = ?");
	$stmt->execute([$userId]);
	$user = $stmt->fetch();

	if (!$user) {
		echo json_encode(["success" => false, "message" => "User not found."]);
		exit;
	}

	// Subscriptions
	$stmt = $pdoStore->prepare("SELECT * FROM `subscriptions` WHERE `user_id` = ? ORDER BY `created_at` DESC");
	$stmt->execute([$userId]);
	$subscriptions = $stmt->fetchAll();

	// Transactions
	$stmt = $pdoStore->prepare("SELECT * FROM `transactions` WHERE `user_id` = ? ORDER BY `created_at` DESC LIMIT 50");
	$stmt->execute([$userId]);
	$transactions = $stmt->fetchAll();

	// Linked platforms
	$stmt = $pdoStore->prepare("SELECT `platform`, `platform_email`, `created_at` FROM `link_platforms` WHERE `user_id` = ?");
	$stmt->execute([$userId]);
	$platforms = $stmt->fetchAll();

	// Feature flags
	$stmt = $pdoAccounts->prepare("SELECT * FROM `feature_flags` WHERE `user_id` = ?");
	$stmt->execute([$userId]);
	$features = $stmt->fetchAll();

	echo json_encode([
		"success" => true,
		"user" => $user,
		"subscriptions" => $subscriptions,
		"transactions" => $transactions,
		"platforms" => $platforms,
		"features" => $features
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading user details."]);
}
