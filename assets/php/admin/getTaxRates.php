<?php
/**
 * Lists tax rates from the local database.
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

try {
	$pdo = Database::connect("store");
	$stmt = $pdo->query("SELECT * FROM `tax_rates` ORDER BY `created_at` DESC");
	$rates = $stmt->fetchAll();

	echo json_encode(["success" => true, "tax_rates" => $rates]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error loading tax rates."]);
}
