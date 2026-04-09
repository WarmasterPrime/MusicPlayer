<?php
/**
 * Updates a coupon in the local database.
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

$sets = [];
$values = [];

if (isset($input["name"])) {
	$sets[] = "`name` = ?";
	$values[] = $input["name"];
}
if (isset($input["percent_off"])) {
	$sets[] = "`percent_off` = ?";
	$values[] = floatval($input["percent_off"]);
}
if (isset($input["amount_off"])) {
	$sets[] = "`amount_off` = ?";
	$values[] = intval($input["amount_off"]);
}
if (isset($input["currency"])) {
	$sets[] = "`currency` = ?";
	$values[] = $input["currency"];
}
if (isset($input["duration"])) {
	$sets[] = "`duration` = ?";
	$values[] = $input["duration"];
}
if (isset($input["duration_in_months"])) {
	$sets[] = "`duration_in_months` = ?";
	$values[] = intval($input["duration_in_months"]);
}
if (isset($input["max_redemptions"])) {
	$sets[] = "`max_redemptions` = ?";
	$values[] = intval($input["max_redemptions"]);
}
if (isset($input["active"])) {
	$sets[] = "`active` = ?";
	$values[] = $input["active"] ? 1 : 0;
}

if (empty($sets)) {
	echo json_encode(["success" => false, "message" => "No fields to update."]);
	exit;
}

try {
	$pdo = Database::connect("store");
	$values[] = $couponId;
	$stmt = $pdo->prepare("UPDATE `coupons` SET " . implode(", ", $sets) . " WHERE `id` = ?");
	$stmt->execute($values);

	$stmt = $pdo->prepare("SELECT * FROM `coupons` WHERE `id` = ?");
	$stmt->execute([$couponId]);
	$coupon = $stmt->fetch();

	if ($coupon) {
		echo json_encode(["success" => true, "coupon" => $coupon]);
	} else {
		echo json_encode(["success" => false, "message" => "Coupon not found."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error updating coupon."]);
}
