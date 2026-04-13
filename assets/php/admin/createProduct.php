<?php
/**
 * Creates a product in the local database and optionally syncs to PayPal.
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
$name = $input["name"] ?? "";
$description = $input["description"] ?? "";
$metadata = isset($input["metadata"]) && is_array($input["metadata"]) ? json_encode($input["metadata"]) : null;
$syncToPayPal = ($input["sync_to_paypal"] ?? true) !== false;

// Feature flags: array of feature keys → comma-separated string
$featureFlags = null;
if (isset($input["feature_flags"]) && is_array($input["feature_flags"])) {
	$featureFlags = implode(",", array_filter($input["feature_flags"], "is_string"));
}

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Product name required."]);
	exit;
}

try {
	$result = PayPalProduct::create($name, $description, $metadata, $syncToPayPal, $featureFlags);

	if (isset($result["error"])) {
		echo json_encode(["success" => false, "message" => $result["error"]]);
	} else {
		echo json_encode(["success" => true, "product" => $result]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating product."]);
}
