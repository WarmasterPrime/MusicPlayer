<?php
/**
 * Returns the user's billing history from the local transactions table.
 * Requires authentication.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("
		SELECT `id`, `stripe_payment_intent`, `stripe_checkout_id`, `amount_cents`, `currency`, `description`, `status`, `created_at`
		FROM `transactions`
		WHERE `user_id` = ?
		ORDER BY `created_at` DESC
		LIMIT 100
	");
	$stmt->execute([$user["id"]]);
	$transactions = $stmt->fetchAll();

	echo json_encode(["success" => true, "transactions" => $transactions]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to load billing history."]);
}
