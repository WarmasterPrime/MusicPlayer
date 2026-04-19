<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

$songId = null;
$input = json_decode(file_get_contents("php://input"), true);

if (isset($input["song_id"])) {
	$songId = $input["song_id"];
} elseif (isset($_POST["song_id"])) {
	$songId = $_POST["song_id"];
} elseif (isset($_GET["song_id"])) {
	$songId = $_GET["song_id"];
}

if (!is_string($songId) || strlen($songId) === 0) {
	echo json_encode(null);
	exit;
}

try {
	$pdo = Database::connect("musicplayer");
	$stmt = $pdo->prepare("SELECT `lyrics_json`, `language` FROM `lyrics` WHERE `song_id` = ? LIMIT 1");
	$stmt->execute([$songId]);
	$row = $stmt->fetch();

	if ($row && $row["lyrics_json"]) {
		$raw = $row["lyrics_json"];
		$decoded = json_decode($raw, true);

		if ($decoded !== null) {
			// Stored as valid JSON (array or object) — return decoded value
			echo json_encode($decoded);
		} else {
			// Stored as a raw LRC string — return it as a JSON string so the
			// client's Lyrics.fromLrc() can parse it.
			echo json_encode($raw);
		}
	} else {
		echo json_encode(null);
	}
} catch (PDOException $e) {
	echo json_encode(null);
}
