<?php
/**
 * Admin-cancels a user's subscription via PayPal API.
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/Payments/PayPal.php";
require_once __DIR__ . "/../System/Payments/PayPalApi.php";
require_once __DIR__ . "/../System/Payments/PayPalSubscription.php";

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
	$pdo = Database::connect("store");

	// Look up the PayPal subscription ID
	$stmt = $pdo->prepare("SELECT `paypal_subscription_id` FROM `subscriptions` WHERE `id` = ? OR `paypal_subscription_id` = ?");
	$stmt->execute([$subscriptionId, $subscriptionId]);
	$row = $stmt->fetch();

	if (!$row) {
		echo json_encode(["success" => false, "message" => "Subscription not found."]);
		exit;
	}

	$paypalSubId = $row["paypal_subscription_id"];

	PayPalApi::init(PayPal::defaultEnv());
	$result = PayPalSubscription::cancel($paypalSubId, "Admin cancellation");

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
		exit;
	}

	echo json_encode(["success" => true, "message" => "Subscription cancelled."]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error canceling subscription."]);
}
