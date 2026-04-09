<?php
/**
 * Deactivates a tax rate.
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

if (empty($id)) {
	echo json_encode(["success" => false, "message" => "Tax rate ID required."]);
	exit;
}

try {
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("UPDATE `tax_rates` SET `active` = 0 WHERE `id` = ?");
	$stmt->execute([$id]);

	echo json_encode(["success" => $stmt->rowCount() > 0]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error deleting tax rate."]);
}
