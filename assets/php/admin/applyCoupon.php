<?php
/**
 * Applies a coupon to a user's subscription.
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeApi.php";

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
$couponId = $input["coupon_id"] ?? "";

if (empty($subscriptionId) || empty($couponId)) {
	echo json_encode(["success" => false, "message" => "Subscription ID and Coupon ID required."]);
	exit;
}

try {
	StripeApi::init("development");
	$result = StripeApi::post("subscriptions/" . $subscriptionId, [
		"coupon" => $couponId
	]);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "subscription" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to apply coupon."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error applying coupon."]);
}
