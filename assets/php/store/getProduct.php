<?php
/**
 * Returns a single product with its prices from the local database.
 * Public endpoint — no authentication required.
 */

require_once __DIR__ . "/../System/Payments/PayPalProduct.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
$productId = trim($input["product_id"] ?? $_GET["product_id"] ?? "");

if (strlen($productId) === 0) {
	echo json_encode(["success" => false, "message" => "Product ID is required."]);
	exit;
}

try {
	$product = PayPalProduct::getWithPrices($productId);

	if (isset($product["error"])) {
		echo json_encode(["success" => false, "message" => $product["error"]]);
		exit;
	}

	echo json_encode(["success" => true, "product" => $product]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error fetching product."]);
}
