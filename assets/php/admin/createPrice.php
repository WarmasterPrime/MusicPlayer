<?php
/**
 * Creates a price (billing plan) for a product.
 * Stored locally and optionally synced to PayPal as a billing plan.
 * Requires StoreAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/PayPalProduct.php";

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
$currency = strtoupper($input["currency"] ?? "USD");
$intervalUnit = strtoupper($input["interval"] ?? $input["interval_unit"] ?? "MONTH");
$intervalCount = intval($input["interval_count"] ?? 1);
$syncToPayPal = ($input["sync_to_paypal"] ?? true) !== false;

if (empty($productId) || $unitAmount <= 0) {
	echo json_encode(["success" => false, "message" => "Product ID and unit amount (in cents) required."]);
	exit;
}

try {
	$result = PayPalProduct::createPrice($productId, $unitAmount, $currency, $intervalUnit, $intervalCount, $syncToPayPal);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
	} else {
		echo json_encode(["success" => true, "price" => $result]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating price."]);
}
