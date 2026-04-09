<?php
/**
 * Creates or updates a tax rate in the local database.
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
$id = $input["id"] ?? "";
$name = trim($input["name"] ?? "");
$percentage = isset($input["percentage"]) ? floatval($input["percentage"]) : null;
$active = isset($input["active"]) ? ($input["active"] ? 1 : 0) : 1;

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Tax name required."]);
	exit;
}

if ($percentage === null || $percentage < 0 || $percentage > 100) {
	echo json_encode(["success" => false, "message" => "Tax percentage must be between 0 and 100."]);
	exit;
}

try {
	$pdo = Database::connect("store");

	if (!empty($id)) {
		// Update existing
		$stmt = $pdo->prepare("UPDATE `tax_rates` SET `name` = ?, `percentage` = ?, `active` = ? WHERE `id` = ?");
		$stmt->execute([$name, $percentage, $active, $id]);
	} else {
		// Create new
		$id = Database::generateId(255);
		$stmt = $pdo->prepare("INSERT INTO `tax_rates` (`id`, `name`, `percentage`, `active`) VALUES (?, ?, ?, ?)");
		$stmt->execute([$id, $name, $percentage, $active]);
	}

	$stmt = $pdo->prepare("SELECT * FROM `tax_rates` WHERE `id` = ?");
	$stmt->execute([$id]);
	$rate = $stmt->fetch();

	echo json_encode(["success" => true, "tax_rate" => $rate]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error saving tax rate."]);
}
