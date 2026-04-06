<?php
/**
 * Lists Stripe coupons.
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

try {
	StripeApi::init("development");
	$result = StripeApi::get("coupons", ["limit" => 100]);

	if (isset($result["data"])) {
		echo json_encode(["success" => true, "coupons" => $result["data"]]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to load coupons."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error loading coupons."]);
}
