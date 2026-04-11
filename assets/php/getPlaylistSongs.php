<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
$playlistId = $input["playlist_id"] ?? $_POST["playlist_id"] ?? $_GET["playlist_id"] ?? null;

if (!is_string($playlistId) || strlen($playlistId) === 0) {
	echo json_encode(["success" => false, "message" => "playlist_id is required."]);
	exit;
}

try {
	$pdo = Database::connect("media");

	// Fetch playlist info
	$stmt = $pdo->prepare("SELECT `id`, `title`, `description`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
	$stmt->execute([$playlistId]);
	$playlist = $stmt->fetch();

	if (!$playlist) {
		echo json_encode(["success" => false, "message" => "Playlist not found."]);
		exit;
	}

	// Fetch songs in order
	$songStmt = $pdo->prepare("
		SELECT ps.`song_id`, ps.`position`, s.`name` AS `title`, s.`artist`, s.`album`, s.`genre`, s.`duration_ms`, s.`source_url`
		FROM `playlist_songs` ps
		INNER JOIN `songs` s ON s.`id` = ps.`song_id`
		WHERE ps.`playlist_id` = ?
		ORDER BY ps.`position` ASC
	");
	$songStmt->execute([$playlistId]);
	$rows = $songStmt->fetchAll();

	$songs = [];
	foreach ($rows as $row) {
		$songs[] = [
			"song_id" => $row["song_id"],
			"title" => $row["title"],
			"artist" => $row["artist"] ?? "",
			"album" => $row["album"] ?? "",
			"genre" => $row["genre"] ?? "",
			"duration" => $row["duration_ms"] ?? 0,
			"source_url" => $row["source_url"] ?? "",
			"position" => (int)$row["position"],
			"stream_url" => "assets/php/streamSong.php?id=" . urlencode($row["song_id"])
		];
	}

	echo json_encode([
		"success" => true,
		"playlist" => [
			"id" => $playlist["id"],
			"title" => $playlist["title"],
			"description" => $playlist["description"] ?? ""
		],
		"songs" => $songs
	]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
