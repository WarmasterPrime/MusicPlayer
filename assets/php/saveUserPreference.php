<?php
/**
 * Saves a single user preference to accounts.font_options.
 * Non-gated keys (like song_display_format) are available to all users.
 * Font-specific keys require custom_fonts feature.
 */

require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$key = trim($input["key"] ?? "");
$value = trim($input["value"] ?? "");

$allowedKeys = ["song_display_format"];

if (!in_array($key, $allowedKeys, true)) {
	echo json_encode(["success" => false, "message" => "Invalid preference key."]);
	exit;
}

// Validate values per key
if ($key === "song_display_format" && !in_array($value, ["artist-title", "title-artist"], true)) {
	echo json_encode(["success" => false, "message" => "Invalid display format."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");

	$stmt = $pdo->prepare("SELECT `id` FROM `font_options` WHERE `user_id` = ? AND `option_key` = ?");
	$stmt->execute([$user["id"], $key]);
	$existing = $stmt->fetch();

	if ($existing) {
		$stmt = $pdo->prepare("UPDATE `font_options` SET `option_value` = ? WHERE `id` = ?");
		$stmt->execute([$value, $existing["id"]]);
	} else {
		$id = Database::generateId(255);
		$stmt = $pdo->prepare("INSERT INTO `font_options` (`id`, `user_id`, `option_key`, `option_value`) VALUES (?, ?, ?, ?)");
		$stmt->execute([$id, $user["id"], $key, $value]);
	}

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to save preference."]);
}
