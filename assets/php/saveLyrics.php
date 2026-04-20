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
$lyricsRaw  = $input["lyrics_raw"]  ?? null;   // Raw LRC string from file upload
$language   = $input["language"] ?? "en";

if (strlen($songId) === 0) {
	echo json_encode(["success" => false, "message" => "Song ID is required."]);
	exit;
}

$lyricsStr = null;

if (is_string($lyricsRaw) && strlen(trim($lyricsRaw)) > 0) {
	// Raw LRC / plain-text file — store as-is (JS Lyrics.fromLrc() handles parsing)
	// Basic sanity check: must contain at least one LRC timestamp pattern
	if (preg_match('/\[\d{1,2}:\d{2}/', $lyricsRaw)) {
		$lyricsStr = $lyricsRaw; // stored directly, not JSON-encoded
	} else {
		// Treat as pre-formatted text; still store raw
		$lyricsStr = $lyricsRaw;
	}
} elseif (is_array($lyricsJson) || is_object($lyricsJson)) {
	// JSON array [{timestamp, text}, ...] from the editor
	// IMPORTANT: empty-text entries are kept — they represent intentional
	// silent gaps / pauses between lyric lines and must not be stripped.
	$filtered = [];
	if (is_array($lyricsJson)) {
		foreach ($lyricsJson as $entry) {
			if (isset($entry["timestamp"])) {
				$ts   = $entry["timestamp"];
				$text = isset($entry["text"]) ? (string)$entry["text"] : "";
				if (is_numeric($ts) && $ts >= 0) {
					$filtered[] = ["timestamp" => (float)$ts, "text" => $text];
				}
			}
		}
	}
	$lyricsStr = json_encode($filtered);
} else {
	echo json_encode(["success" => false, "message" => "Invalid lyrics data."]);
	exit;
}

try {
	$pdo = Database::connect("musicplayer");

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
