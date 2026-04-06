<?php
/**
 * Deletes a user-uploaded font (owner or admin only).
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$fontId = $input["font_id"] ?? "";

if (empty($fontId)) {
	echo json_encode(["success" => false, "message" => "Font ID required."]);
	exit;
}

try {
	$pdo = Database::connect("media");

	// Check ownership
	$stmt = $pdo->prepare("SELECT `uploaded_by` FROM `fonts` WHERE `id` = ?");
	$stmt->execute([$fontId]);
	$font = $stmt->fetch();

	if (!$font) {
		echo json_encode(["success" => false, "message" => "Font not found."]);
		exit;
	}

	$isOwner = $font["uploaded_by"] === $user["id"];
	$isAdmin = hasAuthority("UserAdmin");

	if (!$isOwner && !$isAdmin) {
		echo json_encode(["success" => false, "message" => "Access denied."]);
		exit;
	}

	// Remove font option references first
	$pdoAccounts = Database::connect("accounts");
	$stmt = $pdoAccounts->prepare("DELETE FROM `font_options` WHERE `font_id` = ?");
	$stmt->execute([$fontId]);

	// Delete the font
	$stmt = $pdo->prepare("DELETE FROM `fonts` WHERE `id` = ?");
	$stmt->execute([$fontId]);

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to delete font."]);
}
