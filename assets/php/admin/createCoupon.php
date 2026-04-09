<?php
/**
 * Creates a coupon in the local database.
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
$name = $input["name"] ?? "";
$percentOff = $input["percent_off"] ?? null;
$amountOff = $input["amount_off"] ?? null;
$currency = $input["currency"] ?? "usd";
$duration = $input["duration"] ?? "once"; // once, repeating, forever
$durationInMonths = $input["duration_in_months"] ?? null;
$maxRedemptions = $input["max_redemptions"] ?? null;

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Coupon name required."]);
	exit;
}

if ($percentOff === null && $amountOff === null) {
	echo json_encode(["success" => false, "message" => "Either percent_off or amount_off is required."]);
	exit;
}

try {
	$pdo = Database::connect("store");
	$id = Database::generateId(255);

	$stmt = $pdo->prepare("
		INSERT INTO `coupons` (`id`, `name`, `percent_off`, `amount_off`, `currency`, `duration`, `duration_in_months`, `max_redemptions`, `active`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
	");
	$stmt->execute([
		$id,
		$name,
		$percentOff !== null ? floatval($percentOff) : null,
		$amountOff !== null ? intval($amountOff) : null,
		$currency,
		$duration,
		$duration === "repeating" && $durationInMonths !== null ? intval($durationInMonths) : null,
		$maxRedemptions !== null ? intval($maxRedemptions) : null
	]);

	// Fetch the created coupon
	$stmt = $pdo->prepare("SELECT * FROM `coupons` WHERE `id` = ?");
	$stmt->execute([$id]);
	$coupon = $stmt->fetch();

	echo json_encode(["success" => true, "coupon" => $coupon]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating coupon."]);
}
