<?php
/**
 * Returns the currently active tax rate (the first active one).
 * Public endpoint for the store checkout to calculate tax.
 */

require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

try {
	$pdo = Database::connect("store");
	$stmt = $pdo->query("SELECT * FROM `tax_rates` WHERE `active` = 1 ORDER BY `created_at` ASC LIMIT 1");
	$rate = $stmt->fetch();

	if ($rate) {
		echo json_encode(["success" => true, "tax_rate" => $rate]);
	} else {
		echo json_encode(["success" => true, "tax_rate" => null]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error loading tax rate."]);
}
