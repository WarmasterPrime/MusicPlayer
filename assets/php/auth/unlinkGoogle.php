<?php
/**
 * Unlinks a Google account from the current user.
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
	$stmt = $pdo->prepare("DELETE FROM `link_platforms` WHERE `user_id` = ? AND `platform` = 'google'");
	$stmt->execute([$user["id"]]);

	$affected = $stmt->rowCount();
	if ($affected > 0) {
		echo json_encode(["success" => true, "message" => "Google account unlinked."]);
	} else {
		echo json_encode(["success" => false, "message" => "No Google account linked."]);
	}

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error unlinking account."]);
}
