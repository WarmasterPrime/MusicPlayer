<?php
/**
 * Updates a product in the local database and optionally in PayPal.
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

if (empty($productId)) {
	echo json_encode(["success" => false, "message" => "Product ID required."]);
	exit;
}

$fields = [];
if (isset($input["name"])) $fields["name"] = $input["name"];
if (isset($input["description"])) $fields["description"] = $input["description"];
if (isset($input["active"])) $fields["active"] = (bool)$input["active"];
if (isset($input["metadata"])) $fields["metadata"] = $input["metadata"];

// Feature flags: array of feature keys → comma-separated string (empty array = clear all flags)
if (isset($input["feature_flags"]) && is_array($input["feature_flags"])) {
	$flags = array_filter($input["feature_flags"], "is_string");
	$fields["feature_flags"] = count($flags) > 0 ? implode(",", $flags) : null;
}

if (empty($fields)) {
	echo json_encode(["success" => false, "message" => "No fields to update."]);
	exit;
}

$syncToPayPal = ($input["sync_to_paypal"] ?? true) !== false;

try {
	$result = PayPalProduct::update($productId, $fields, $syncToPayPal);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
	} else {
		echo json_encode(["success" => true, "product" => $result]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error updating product."]);
}
