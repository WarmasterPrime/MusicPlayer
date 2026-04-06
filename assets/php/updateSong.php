<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/Authority.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$songId = $input["song_id"] ?? "";

if (strlen($songId) === 0) {
	echo json_encode(["success" => false, "message" => "Song ID is required."]);
	exit;
}

try {
	$pdo = Database::connect("media");

	// Fetch the song to check ownership and visibility
	$stmt = $pdo->prepare("SELECT `id`, `uploaded_by` FROM `songs` WHERE `id` = ?");
	$stmt->execute([$songId]);
	$song = $stmt->fetch();

	if (!$song) {
		echo json_encode(["success" => false, "message" => "Song not found."]);
		exit;
	}

	$isOwner = ($song["uploaded_by"] === $user["id"]);
	if (!$isOwner && !Authority::hasFlag($user["authority"], "ClientModifyPublic")) {
		echo json_encode(["success" => false, "message" => "Insufficient permissions."]);
		exit;
	}
	if ($isOwner && !Authority::hasFlag($user["authority"], "ClientModifyOwn")) {
		echo json_encode(["success" => false, "message" => "Insufficient permissions."]);
		exit;
	}

	$fields = [];
	$values = [];

	$allowedFields = [
		"title" => "name",
		"artist" => "artist",
		"album" => "album",
		"genre" => "genre",
		"publisher" => "publisher",
		"keywords" => "keywords",
		"composer" => "composer",
		"album_artist" => "album_artist",
		"source_url" => "source_url"
	];
	foreach ($allowedFields as $inputKey => $dbColumn) {
		if (isset($input[$inputKey])) {
			$fields[] = "`$dbColumn` = ?";
			$values[] = trim($input[$inputKey]);
		}
	}

	// Handle publish_date separately (nullable date field)
	if (array_key_exists("publish_date", $input)) {
		$dateVal = trim($input["publish_date"]);
		if (strlen($dateVal) > 0) {
			$parsed = date("Y-m-d H:i:s", strtotime($dateVal));
			if ($parsed !== false && $parsed !== "1970-01-01 00:00:00") {
				$fields[] = "`published_date` = ?";
				$values[] = $parsed;
			}
		} else {
			$fields[] = "`published_date` = NULL";
		}
	}

	if (count($fields) === 0) {
		echo json_encode(["success" => false, "message" => "No fields to update."]);
		exit;
	}

	$values[] = $songId;
	$sql = "UPDATE `songs` SET " . implode(", ", $fields) . " WHERE `id` = ?";
	$stmt = $pdo->prepare($sql);
	$stmt->execute($values);

	echo json_encode(["success" => true, "message" => "Song updated."]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
