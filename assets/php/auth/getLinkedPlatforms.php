<?php
/**
 * Returns the linked platforms for the current user.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("
		SELECT `platform`, `platform_email`, `created_at`
		FROM `link_platforms`
		WHERE `user_id` = ?
		ORDER BY `created_at` ASC
	");
	$stmt->execute([$user["id"]]);
	$platforms = $stmt->fetchAll();

	echo json_encode(["success" => true, "platforms" => $platforms]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading linked platforms."]);
}
