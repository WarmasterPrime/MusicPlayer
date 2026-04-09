<?php
/**
 * Validates a coupon code and returns discount details.
 * Public endpoint (requires authentication).
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$code = trim($input["code"] ?? "");

if (strlen($code) === 0) {
	echo json_encode(["success" => false, "message" => "Coupon code is required."]);
	exit;
}

try {
	$pdo = Database::connect("store");

	$stmt = $pdo->prepare("SELECT * FROM `coupons` WHERE `name` = ? AND `active` = 1 LIMIT 1");
	$stmt->execute([$code]);
	$coupon = $stmt->fetch();

	if (!$coupon) {
		echo json_encode(["success" => false, "message" => "Invalid or expired coupon code."]);
		exit;
	}

	// Check max redemptions
	if ($coupon["max_redemptions"] !== null && (int)$coupon["times_redeemed"] >= (int)$coupon["max_redemptions"]) {
		echo json_encode(["success" => false, "message" => "This coupon has reached its maximum usage."]);
		exit;
	}

	echo json_encode([
		"success" => true,
		"coupon" => [
			"id" => $coupon["id"],
			"name" => $coupon["name"],
			"percent_off" => $coupon["percent_off"] !== null ? floatval($coupon["percent_off"]) : null,
			"amount_off" => $coupon["amount_off"] !== null ? (int)$coupon["amount_off"] : null,
			"currency" => $coupon["currency"],
			"duration" => $coupon["duration"]
		]
	]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error validating coupon."]);
}
