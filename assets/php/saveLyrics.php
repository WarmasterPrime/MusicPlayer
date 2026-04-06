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
$lyricsJson = $input["lyrics_json"] ?? null;
$language = $input["language"] ?? "en";

if (strlen($songId) === 0) {
	echo json_encode(["success" => false, "message" => "Song ID is required."]);
	exit;
}

if (!is_array($lyricsJson) && !is_object($lyricsJson)) {
	echo json_encode(["success" => false, "message" => "Invalid lyrics data."]);
	exit;
}

// Validate and filter lyrics entries
$filtered = [];
if (is_array($lyricsJson)) {
	foreach ($lyricsJson as $entry) {
		if (isset($entry["timestamp"]) && isset($entry["text"])) {
			$ts = $entry["timestamp"];
			$text = trim($entry["text"]);
			if (is_numeric($ts) && $ts >= 0 && strlen($text) > 0) {
				$filtered[] = ["timestamp" => (float)$ts, "text" => $text];
			}
		}
	}
}

try {
	$pdo = Database::connect("musicplayer");
	$lyricsStr = json_encode($filtered);

	// Upsert: check if lyrics exist for this song
	$stmt = $pdo->prepare("SELECT `id` FROM `lyrics` WHERE `song_id` = ? AND `language` = ?");
	$stmt->execute([$songId, $language]);
	$existing = $stmt->fetch();

	if ($existing) {
		$stmt = $pdo->prepare("UPDATE `lyrics` SET `lyrics_json` = ?, `updated_by` = ? WHERE `id` = ?");
		$stmt->execute([$lyricsStr, $user["id"], $existing["id"]]);
	} else {
		$id = Database::generateUUID();
		$stmt = $pdo->prepare("
			INSERT INTO `lyrics` (`id`, `song_id`, `lyrics_json`, `language`, `updated_by`)
			VALUES (?, ?, ?, ?, ?)
		");
		$stmt->execute([$id, $songId, $lyricsStr, $language, $user["id"]]);
	}

	echo json_encode(["success" => true, "message" => "Lyrics saved."]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
