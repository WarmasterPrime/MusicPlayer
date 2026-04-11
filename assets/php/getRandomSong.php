<?php
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

$exclude = null;
$input = json_decode(file_get_contents("php://input"), true);
if (isset($input["cmd"])) {
	$exclude = $input["cmd"];
} elseif (isset($_POST["cmd"])) {
	$exclude = $_POST["cmd"];
} elseif (isset($_GET["cmd"])) {
	$exclude = $_GET["cmd"];
}

try {
	$pdo = Database::connect("media");

	if (is_string($exclude) && strlen($exclude) > 0) {
		$stmt = $pdo->prepare("SELECT `id`, `name` AS `title`, `artist`, `source_url` FROM `songs` WHERE `id` != ? ORDER BY RAND() LIMIT 1");
		$stmt->execute([$exclude]);
	} else {
		$stmt = $pdo->query("SELECT `id`, `name` AS `title`, `artist`, `source_url` FROM `songs` ORDER BY RAND() LIMIT 1");
	}

	$song = $stmt->fetch();
	if ($song) {
		echo json_encode([
			"success" => true,
			"song_id" => $song["id"],
			"title" => $song["title"],
			"artist" => $song["artist"] ?? "",
			"source_url" => $song["source_url"] ?? "",
			"stream_url" => "assets/php/streamSong.php?id=" . urlencode($song["id"])
		]);
	} else {
		echo json_encode(["success" => false]);
	}
} catch (PDOException $e) {
	echo json_encode(["success" => false]);
}
