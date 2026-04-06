<?php
/**
 * Updates a Stripe coupon (name and metadata only — Stripe limitation).
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

$data = [];
if (isset($input["name"])) $data["name"] = $input["name"];
if (isset($input["metadata"]) && is_array($input["metadata"])) $data["metadata"] = $input["metadata"];

if (empty($data)) {
	echo json_encode(["success" => false, "message" => "No fields to update. Only name and metadata can be changed."]);
	exit;
}

try {
	StripeApi::init("development");
	$result = StripeApi::post("coupons/" . $couponId, $data);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "coupon" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to update coupon."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error updating coupon."]);
}
