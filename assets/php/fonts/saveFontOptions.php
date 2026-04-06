<?php
/**
 * Saves user font preferences to accounts.font_options.
 * Feature-gated: requires custom_fonts feature.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/FeatureGate.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

// Feature gate check
$gate = FeatureGate::check($user["id"], "custom_fonts");
if (!$gate["allowed"]) {
	echo json_encode(["success" => false, "message" => $gate["message"], "feature_gated" => true]);
	exit;
}

$input = json_decode(file_get_contents("php://input"), true);
if (!$input || !is_array($input)) {
	echo json_encode(["success" => false, "message" => "Invalid input."]);
	exit;
}

$allowedKeys = ["song_name_font", "lyrics_font", "ui_font"];

try {
	$pdo = Database::connect("accounts");

	foreach ($input as $key => $value) {
		if (!in_array($key, $allowedKeys)) continue;

		$fontId = $value["font_id"] ?? null;
		$optionValue = $value["value"] ?? null;

		// Upsert: check if option already exists
		$stmt = $pdo->prepare("SELECT `id` FROM `font_options` WHERE `user_id` = ? AND `option_key` = ?");
		$stmt->execute([$user["id"], $key]);
		$existing = $stmt->fetch();

		if ($existing) {
			$stmt = $pdo->prepare("UPDATE `font_options` SET `font_id` = ?, `option_value` = ? WHERE `id` = ?");
			$stmt->execute([$fontId, $optionValue, $existing["id"]]);
		} else {
			$id = Database::generateId(255);
			$stmt = $pdo->prepare("INSERT INTO `font_options` (`id`, `user_id`, `font_id`, `option_key`, `option_value`) VALUES (?, ?, ?, ?, ?)");
			$stmt->execute([$id, $user["id"], $fontId, $key, $optionValue]);
		}
	}

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to save font options."]);
}
