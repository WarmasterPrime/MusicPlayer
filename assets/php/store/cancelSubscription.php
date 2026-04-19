<?php
/**
 * Cancels a user's PayPal subscription.
 * Requires authentication. Only allows cancelling own subscriptions.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/PayPal.php";
require_once __DIR__ . "/../System/Payments/PayPalApi.php";
require_once __DIR__ . "/../System/Payments/PayPalSubscription.php";
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
	$stmt = $pdo->prepare("SELECT `user_id`, `paypal_subscription_id` FROM `subscriptions` WHERE `id` = ? OR `paypal_subscription_id` = ?");
	$stmt->execute([$subscriptionId, $subscriptionId]);
	$sub = $stmt->fetch();

	if (!$sub || $sub["user_id"] !== $user["id"]) {
		echo json_encode(["success" => false, "message" => "Subscription not found."]);
		exit;
	}

	$paypalSubId = $sub["paypal_subscription_id"];

	// Cancel via PayPal API
	PayPalApi::init(PayPal::defaultEnv());
	$result = PayPalSubscription::cancel($paypalSubId);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
		exit;
	}

	echo json_encode(["success" => true, "message" => "Subscription cancelled."]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Failed to cancel subscription."]);
}
