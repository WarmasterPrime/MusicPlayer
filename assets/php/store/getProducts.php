<?php
/**
 * Lists all active products with their prices from the local database.
 * Public endpoint — no authentication required.
 */

require_once __DIR__ . "/../System/Payments/PayPalProduct.php";

header("Content-Type: application/json");

try {
	$activeOnly = ($_GET["include_inactive"] ?? "") !== "1";
	$products = PayPalProduct::listAll($activeOnly);

	echo json_encode(["success" => true, "products" => $products]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error fetching products."]);
}
