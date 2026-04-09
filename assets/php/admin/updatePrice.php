<?php
/**
 * Updates a price (billing plan) for a product.
 * If the amount changes, the old PayPal plan is deactivated and a new one is created.
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
$priceId = $input["price_id"] ?? "";

if (empty($priceId)) {
	echo json_encode(["success" => false, "message" => "Price ID required."]);
	exit;
}

$fields = [];
if (isset($input["unit_amount"])) $fields["unit_amount"] = intval($input["unit_amount"]);
if (isset($input["currency"])) $fields["currency"] = $input["currency"];
if (isset($input["interval_unit"])) $fields["interval_unit"] = $input["interval_unit"];
if (isset($input["interval_count"])) $fields["interval_count"] = intval($input["interval_count"]);
if (isset($input["active"])) $fields["active"] = (bool)$input["active"];

if (empty($fields)) {
	echo json_encode(["success" => false, "message" => "No fields to update."]);
	exit;
}

$syncToPayPal = ($input["sync_to_paypal"] ?? true) !== false;

try {
	$result = PayPalProduct::updatePrice($priceId, $fields, $syncToPayPal);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
	} else {
		echo json_encode(["success" => true, "price" => $result]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error updating price."]);
}
