<?php
/**
 * Returns user display preferences from accounts.font_options.
 * Uses the font_options table as a general key-value store for user preferences.
 */

require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("SELECT `option_key`, `option_value` FROM `font_options` WHERE `user_id` = ?");
	$stmt->execute([$user["id"]]);
	$rows = $stmt->fetchAll();

	$prefs = [];
	foreach ($rows as $row) {
		$prefs[$row["option_key"]] = $row["option_value"];
	}

	echo json_encode(["success" => true, "preferences" => $prefs]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to load preferences."]);
}
