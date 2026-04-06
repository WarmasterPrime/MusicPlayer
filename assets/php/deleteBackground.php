<?php
/**
 * Removes the user's background image from the database.
 * Sets the background column to NULL.
 */

require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("UPDATE `users` SET `background` = NULL WHERE `id` = ?");
	$stmt->execute([$user["id"]]);

	echo json_encode(["success" => true, "message" => "Background removed."]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
