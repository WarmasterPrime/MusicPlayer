<?php
/**
 * Returns current user's font preferences.
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
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("
		SELECT fo.`option_key`, fo.`font_id`, fo.`option_value`, f.`name` AS `font_name`
		FROM `font_options` fo
		LEFT JOIN `media`.`fonts` f ON f.`id` = fo.`font_id`
		WHERE fo.`user_id` = ?
	");
	$stmt->execute([$user["id"]]);
	$options = $stmt->fetchAll();

	$result = [];
	foreach ($options as $opt) {
		$result[$opt["option_key"]] = [
			"font_id" => $opt["font_id"],
			"font_name" => $opt["font_name"],
			"value" => $opt["option_value"]
		];
	}

	echo json_encode(["success" => true, "options" => $result]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to load font options."]);
}
