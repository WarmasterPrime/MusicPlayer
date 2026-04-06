<?php
/**
 * Creates a Stripe product.
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
$description = $input["description"] ?? "";
$metadata = $input["metadata"] ?? [];

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Product name required."]);
	exit;
}

try {
	StripeApi::init("development");

	$data = [
		"name" => $name,
		"description" => $description
	];

	if (!empty($metadata) && is_array($metadata)) {
		$data["metadata"] = $metadata;
	}

	$result = StripeApi::post("products", $data);

	if (isset($result["id"])) {
		echo json_encode(["success" => true, "product" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Failed to create product."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating product."]);
}
