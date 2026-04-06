<?php
/**
 * Creates a Stripe price for a product.
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
$productId = $input["product_id"] ?? "";
$unitAmount = intval($input["unit_amount"] ?? 0);
$currency = $input["currency"] ?? "usd";
$interval = $input["interval"] ?? "month"; // month, year

if (empty($productId) || $unitAmount <= 0) {
	echo json_encode(["success" => false, "message" => "Product ID and unit amount (in cents) required."]);
	exit;
}

try {
	StripeApi::init("development");

	$data = [
		"product" => $productId,
		"unit_amount" => $unitAmount,
		"currency" => $currency,
		"recurring" => ["interval" => $interval]
	];

	$result = StripeApi::post("prices", $data);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "price" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to create price."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating price."]);
}
