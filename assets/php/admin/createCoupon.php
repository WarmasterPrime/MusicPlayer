<?php
/**
 * Creates a Stripe coupon.
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
$name = $input["name"] ?? "";
$percentOff = $input["percent_off"] ?? null;
$amountOff = $input["amount_off"] ?? null;
$currency = $input["currency"] ?? "usd";
$duration = $input["duration"] ?? "once"; // once, repeating, forever
$durationInMonths = $input["duration_in_months"] ?? null;

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Coupon name required."]);
	exit;
}

if ($percentOff === null && $amountOff === null) {
	echo json_encode(["success" => false, "message" => "Either percent_off or amount_off is required."]);
	exit;
}

try {
	StripeApi::init("development");

	$data = [
		"name" => $name,
		"duration" => $duration
	];

	if ($percentOff !== null) {
		$data["percent_off"] = floatval($percentOff);
	} else {
		$data["amount_off"] = intval($amountOff);
		$data["currency"] = $currency;
	}

	if ($duration === "repeating" && $durationInMonths !== null) {
		$data["duration_in_months"] = intval($durationInMonths);
	}

	$result = StripeApi::post("coupons", $data);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "coupon" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to create coupon."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating coupon."]);
}
