<?php
/**
 * Seeds the store database with the Creator Upgrade product and pricing.
 * Run this once after schema setup to populate the product catalog.
 *
 * Usage: Navigate to this file in your browser, or run via CLI:
 *   php seedProducts.php
 *
 * This script is idempotent — it checks for existing products before creating.
 */

require_once __DIR__ . "/../System/StoreSchemaSetup.php";
require_once __DIR__ . "/../System/Payments/PayPalProduct.php";
require_once __DIR__ . "/../System/Payments/PayPalApi.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

$results = [];

// ── Step 1: Run schema setup ──
try {
	$schema = new StoreSchemaSetup();
	$schemaResults = $schema->run();
	$results["schema"] = "OK — " . count($schemaResults) . " migrations checked.";
} catch (Exception $e) {
	$results["schema"] = "ERROR: " . $e->getMessage();
	echo json_encode($results, JSON_PRETTY_PRINT);
	exit;
}

// ── Step 2: Check if Creator Upgrade already exists ──
try {
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("SELECT `id` FROM `products` WHERE `name` = ? LIMIT 1");
	$stmt->execute(["Creator Upgrade"]);
	$existing = $stmt->fetch();

	if ($existing) {
		$results["product"] = "Already exists (ID: " . $existing["id"] . "). Skipping.";

		// Check if it has prices
		$stmt = $pdo->prepare("SELECT COUNT(*) FROM `prices` WHERE `product_id` = ?");
		$stmt->execute([$existing["id"]]);
		$priceCount = (int)$stmt->fetchColumn();
		$results["prices"] = $priceCount . " price(s) already exist.";

		echo json_encode($results, JSON_PRETTY_PRINT);
		exit;
	}
} catch (Exception $e) {
	$results["check"] = "ERROR: " . $e->getMessage();
	echo json_encode($results, JSON_PRETTY_PRINT);
	exit;
}

// ── Step 3: Create Creator Upgrade product ──
try {
	$metadata = json_encode([
		"features" => "Unlimited uploads, Unlimited playlists, Custom backgrounds, Custom fonts, Lyrics display, Lyrics editing, Song name customization, Creator badge, URL shared playlists, 5GB cloud storage",
		"tier" => "creator"
	]);

	$product = PayPalProduct::create(
		"Creator Upgrade",
		"Unlock all creator features: unlimited uploads, playlists, custom backgrounds, fonts, lyrics tools, and more.",
		$metadata,
		true  // sync to PayPal sandbox
	);

	if (isset($product["error"])) {
		$results["product"] = "ERROR: " . $product["error"];
		echo json_encode($results, JSON_PRETTY_PRINT);
		exit;
	}

	$results["product"] = [
		"id" => $product["id"],
		"paypal_product_id" => $product["paypal_product_id"],
		"name" => $product["name"]
	];

	$productId = $product["id"];

} catch (Exception $e) {
	$results["product"] = "ERROR: " . $e->getMessage();
	echo json_encode($results, JSON_PRETTY_PRINT);
	exit;
}

// ── Step 4: Create monthly price ($4.99/month) ──
try {
	$monthlyPrice = PayPalProduct::createPrice(
		$productId,
		499,       // $4.99 in cents
		"USD",
		"MONTH",
		1,
		true       // sync to PayPal as billing plan
	);

	if (isset($monthlyPrice["error"])) {
		$results["monthly_price"] = "ERROR: " . $monthlyPrice["error"];
	} else {
		$results["monthly_price"] = [
			"id" => $monthlyPrice["id"],
			"paypal_plan_id" => $monthlyPrice["paypal_plan_id"],
			"amount" => "$4.99/month"
		];
	}
} catch (Exception $e) {
	$results["monthly_price"] = "ERROR: " . $e->getMessage();
}

// ── Step 5: Create yearly price ($49.99/year — saves ~17%) ──
try {
	$yearlyPrice = PayPalProduct::createPrice(
		$productId,
		4999,      // $49.99 in cents
		"USD",
		"YEAR",
		1,
		true       // sync to PayPal as billing plan
	);

	if (isset($yearlyPrice["error"])) {
		$results["yearly_price"] = "ERROR: " . $yearlyPrice["error"];
	} else {
		$results["yearly_price"] = [
			"id" => $yearlyPrice["id"],
			"paypal_plan_id" => $yearlyPrice["paypal_plan_id"],
			"amount" => "$49.99/year"
		];
	}
} catch (Exception $e) {
	$results["yearly_price"] = "ERROR: " . $e->getMessage();
}

$results["status"] = "Seed complete.";
echo json_encode($results, JSON_PRETTY_PRINT);
