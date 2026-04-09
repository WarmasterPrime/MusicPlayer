<?php
/**
 * Deletes (deactivates) a coupon from the local database.
 * Requires StoreAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

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
$couponId = $input["coupon_id"] ?? "";

if (empty($couponId)) {
	echo json_encode(["success" => false, "message" => "Coupon ID required."]);
	exit;
}

try {
	$pdo = Database::connect("store");

	// Soft delete — set active = 0
	$stmt = $pdo->prepare("UPDATE `coupons` SET `active` = 0 WHERE `id` = ?");
	$stmt->execute([$couponId]);

	if ($stmt->rowCount() > 0) {
		echo json_encode(["success" => true]);
	} else {
		echo json_encode(["success" => false, "message" => "Coupon not found."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error deleting coupon."]);
}
