<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/parse.php";

header("Content-Type: application/json");

$songId = null;
$input = json_decode(file_get_contents("php://input"), true);

if (isset($input["song_id"])) {
	$songId = $input["song_id"];
} elseif (isset($_POST["song_id"])) {
	$songId = parse($_POST["song_id"]);
} elseif (isset($_GET["song_id"]) || isset($_GET["id"])) {
	$songId = parse($_GET["song_id"] ?? $_GET["id"]);
}

if (!is_string($songId) || strlen($songId) === 0) {
	echo json_encode(["success" => false, "message" => "song_id is required."]);
	exit;
}

try {
	$pdo = Database::connect("media");
	$stmt = $pdo->prepare("
		SELECT `id`, `name` AS `title`, `artist`, `album`, `genre`,
		       `duration_ms`, `publisher`
		FROM `songs`
		WHERE `id` = ?
		LIMIT 1
	");
	$stmt->execute([$songId]);
	$song = $stmt->fetch();

	if ($song) {
		echo json_encode([
			"success" => true,
			"song" => [
				"song_id" => $song["id"],
				"title" => $song["title"],
				"artist" => $song["artist"] ?? "",
				"album" => $song["album"] ?? "",
				"genre" => $song["genre"] ?? "",
				"duration" => $song["duration_ms"] ?? 0,
				"path" => "assets/php/streamSong.php?id=" . urlencode($song["id"]),
				"stream_url" => "assets/php/streamSong.php?id=" . urlencode($song["id"])
			]
		]);
	} else {
		echo json_encode(["success" => false, "message" => "Song not found."]);
	}
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
