<?php
/**
 * Lists all active Stripe products with their prices.
 * Public endpoint — no authentication required.
 */

require_once __DIR__ . "/../System/Payments/StripeApi.php";

header("Content-Type: application/json");

try {
	// Fetch products (optionally include inactive for admin views)
	$params = ["limit" => 100];
	if (($_GET["include_inactive"] ?? "") !== "1") {
		$params["active"] = "true";
	}
	$products = StripeApi::get("products", $params);
	if (isset($products["_error"])) {
		echo json_encode(["success" => false, "message" => "Failed to fetch products."]);
		exit;
	}

	// Fetch all active prices
	$prices = StripeApi::get("prices", ["active" => "true", "limit" => 100]);
	if (isset($prices["_error"])) {
		echo json_encode(["success" => false, "message" => "Failed to fetch prices."]);
		exit;
	}

	// Map prices by product ID
	$pricesByProduct = [];
	foreach ($prices["data"] ?? [] as $price) {
		$prodId = $price["product"] ?? "";
		if (!isset($pricesByProduct[$prodId])) {
			$pricesByProduct[$prodId] = [];
		}
		$pricesByProduct[$prodId][] = [
			"id" => $price["id"],
			"unit_amount" => $price["unit_amount"] ?? 0,
			"currency" => $price["currency"] ?? "usd",
			"recurring" => $price["recurring"] ?? null,
			"type" => $price["type"] ?? "one_time"
		];
	}

	// Build response
	$result = [];
	foreach ($products["data"] ?? [] as $product) {
		$prodId = $product["id"] ?? "";
		$result[] = [
			"id" => $prodId,
			"name" => $product["name"] ?? "",
			"description" => $product["description"] ?? "",
			"active" => $product["active"] ?? true,
			"images" => $product["images"] ?? [],
			"metadata" => $product["metadata"] ?? [],
			"prices" => $pricesByProduct[$prodId] ?? []
		];
	}

	echo json_encode(["success" => true, "products" => $result]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error fetching products."]);
}
