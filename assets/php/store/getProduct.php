<?php
/**
 * Returns a single Stripe product with its prices.
 * Public endpoint — no authentication required.
 */

require_once __DIR__ . "/../System/Payments/StripeApi.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
$productId = trim($input["product_id"] ?? $_GET["product_id"] ?? "");

if (strlen($productId) === 0) {
	echo json_encode(["success" => false, "message" => "Product ID is required."]);
	exit;
}

try {
	$product = StripeApi::get("products/" . $productId);
	if (isset($product["_error"])) {
		echo json_encode(["success" => false, "message" => "Product not found."]);
		exit;
	}

	// Fetch prices for this product
	$prices = StripeApi::get("prices", ["product" => $productId, "active" => "true", "limit" => 50]);
	$priceList = [];
	foreach ($prices["data"] ?? [] as $price) {
		$priceList[] = [
			"id" => $price["id"],
			"unit_amount" => $price["unit_amount"] ?? 0,
			"currency" => $price["currency"] ?? "usd",
			"recurring" => $price["recurring"] ?? null,
			"type" => $price["type"] ?? "one_time"
		];
	}

	echo json_encode([
		"success" => true,
		"product" => [
			"id" => $product["id"],
			"name" => $product["name"] ?? "",
			"description" => $product["description"] ?? "",
			"images" => $product["images"] ?? [],
			"metadata" => $product["metadata"] ?? [],
			"prices" => $priceList
		]
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error fetching product."]);
}
