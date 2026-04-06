<?php
/**
 * Deletes a Stripe coupon.
 * Requires StoreAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeApi.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("StoreAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$couponId = $input["coupon_id"] ?? "";

if (empty($couponId)) {
	echo json_encode(["success" => false, "message" => "Coupon ID required."]);
	exit;
}

try {
	StripeApi::init("development");
	$result = StripeApi::delete("coupons/" . $couponId);

	if (isset($result["deleted"]) && $result["deleted"]) {
		echo json_encode(["success" => true]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to delete coupon."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error deleting coupon."]);
}
