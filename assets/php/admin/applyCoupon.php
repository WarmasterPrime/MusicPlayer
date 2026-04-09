<?php
/**
 * Applies a coupon to a user's subscription.
 * Since PayPal doesn't have native coupon application to subscriptions,
 * this records the coupon usage locally and could be used for future billing adjustments.
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
$subscriptionId = $input["subscription_id"] ?? "";
$couponId = $input["coupon_id"] ?? "";

if (empty($subscriptionId) || empty($couponId)) {
	echo json_encode(["success" => false, "message" => "Subscription ID and Coupon ID required."]);
	exit;
}

try {
	$pdo = Database::connect("store");

	// Verify subscription exists
	$stmt = $pdo->prepare("SELECT * FROM `subscriptions` WHERE `id` = ? OR `paypal_subscription_id` = ?");
	$stmt->execute([$subscriptionId, $subscriptionId]);
	$sub = $stmt->fetch();

	if (!$sub) {
		echo json_encode(["success" => false, "message" => "Subscription not found."]);
		exit;
	}

	// Verify coupon exists and is active
	$stmt = $pdo->prepare("SELECT * FROM `coupons` WHERE `id` = ? AND `active` = 1");
	$stmt->execute([$couponId]);
	$coupon = $stmt->fetch();

	if (!$coupon) {
		echo json_encode(["success" => false, "message" => "Coupon not found or inactive."]);
		exit;
	}

	// Check max redemptions
	if ($coupon["max_redemptions"] !== null && (int)$coupon["times_redeemed"] >= (int)$coupon["max_redemptions"]) {
		echo json_encode(["success" => false, "message" => "Coupon has reached maximum redemptions."]);
		exit;
	}

	// Increment redemption count
	$stmt = $pdo->prepare("UPDATE `coupons` SET `times_redeemed` = `times_redeemed` + 1 WHERE `id` = ?");
	$stmt->execute([$couponId]);

	echo json_encode([
		"success" => true,
		"message" => "Coupon applied. Discount will be reflected in the next billing cycle.",
		"coupon" => $coupon
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error applying coupon."]);
}
