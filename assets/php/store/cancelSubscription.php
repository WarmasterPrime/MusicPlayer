<?php
/**
 * Cancels a user's subscription (sets cancel_at_period_end).
 * Requires authentication. Only allows cancelling own subscriptions.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeSubscription.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$subscriptionId = trim($input["subscription_id"] ?? "");

if (strlen($subscriptionId) === 0) {
	echo json_encode(["success" => false, "message" => "Subscription ID is required."]);
	exit;
}

try {
	// Verify the subscription belongs to this user
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("SELECT `user_id` FROM `subscriptions` WHERE `stripe_subscription_id` = ?");
	$stmt->execute([$subscriptionId]);
	$ownerId = $stmt->fetchColumn();

	if ($ownerId !== $user["id"]) {
		echo json_encode(["success" => false, "message" => "Subscription not found."]);
		exit;
	}

	// Cancel at period end (not immediately)
	$result = StripeSubscription::cancel($subscriptionId, false);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
		exit;
	}

	echo json_encode(["success" => true, "message" => "Subscription will cancel at end of billing period."]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Failed to cancel subscription."]);
}
