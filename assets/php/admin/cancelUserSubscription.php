<?php
/**
 * Admin-cancels a user's subscription via Stripe API.
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/Payments/StripeApi.php";
require_once __DIR__ . "/../System/Payments/StripeSubscription.php";

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
$subscriptionId = $input["subscription_id"] ?? "";

if (empty($subscriptionId)) {
	echo json_encode(["success" => false, "message" => "Subscription ID required."]);
	exit;
}

try {
	StripeApi::init("development");
	$result = StripeSubscription::cancel($subscriptionId);

	if (isset($result["id"])) {
		// Sync status to local DB
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("UPDATE `subscriptions` SET `status` = 'canceled', `updated_at` = NOW() WHERE `stripe_subscription_id` = ?");
		$stmt->execute([$subscriptionId]);

		echo json_encode(["success" => true, "subscription" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to cancel subscription."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error canceling subscription."]);
}
