<?php
/**
 * Lists available fonts uploaded by the current user.
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
	$pdo = Database::connect("media");
	$stmt = $pdo->prepare("
		SELECT `id`, `name`, `mime_type`, `uploaded_by`, `created_at`
		FROM `fonts`
		WHERE `uploaded_by` = ?
		ORDER BY `name` ASC
	");
	$stmt->execute([$user["id"]]);
	$fonts = $stmt->fetchAll();

	echo json_encode(["success" => true, "fonts" => $fonts]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to load fonts."]);
}
