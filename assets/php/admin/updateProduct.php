<?php
/**
 * Updates a Stripe product.
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

if (empty($productId)) {
	echo json_encode(["success" => false, "message" => "Product ID required."]);
	exit;
}

$data = [];
if (isset($input["name"])) $data["name"] = $input["name"];
if (isset($input["description"])) $data["description"] = $input["description"];
if (isset($input["active"])) $data["active"] = $input["active"] ? "true" : "false";
if (isset($input["metadata"]) && is_array($input["metadata"])) $data["metadata"] = $input["metadata"];

if (empty($data)) {
	echo json_encode(["success" => false, "message" => "No fields to update."]);
	exit;
}

try {
	StripeApi::init("development");
	$result = StripeApi::post("products/" . $productId, $data);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "product" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to update product."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error updating product."]);
}
