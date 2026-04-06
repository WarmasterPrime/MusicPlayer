<?php
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
$query = $input["query"] ?? "";
$genre = $input["genre"] ?? "";
$limit = isset($input["limit"]) ? min((int)$input["limit"], 100) : 50;
$offset = isset($input["offset"]) ? max((int)$input["offset"], 0) : 0;

try {
	$pdo = Database::connect("media");

	$conditions = [];
	$params = [];

	if (strlen(trim($query)) > 0) {
		$q = "%" . trim($query) . "%";
		$conditions[] = "(`name` LIKE ? OR `artist` LIKE ? OR `keywords` LIKE ? OR `album` LIKE ? OR `publisher` LIKE ?)";
		$params = array_merge($params, [$q, $q, $q, $q, $q]);
	}

	if (strlen(trim($genre)) > 0) {
		$conditions[] = "`genre` = ?";
		$params[] = trim($genre);
	}

	$where = "";
	if (count($conditions) > 0) {
		$where = "WHERE " . implode(" AND ", $conditions);
	}

	// Get total count
	$countSql = "SELECT COUNT(*) FROM `songs` $where";
	$stmt = $pdo->prepare($countSql);
	$stmt->execute($params);
	$total = (int)$stmt->fetchColumn();

	// Get paginated results
	$sql = "SELECT `id`, `name` AS `title`, `artist`, `album`, `genre`, `duration_ms` FROM `songs` $where ORDER BY `name` ASC LIMIT ? OFFSET ?";
	$params[] = $limit;
	$params[] = $offset;
	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);
	$songs = $stmt->fetchAll();

	$result = [];
	foreach ($songs as $song) {
		$result[] = [
			"song_id" => $song["id"],
			"title" => $song["title"],
			"artist" => $song["artist"] ?? "",
			"album" => $song["album"] ?? "",
			"genre" => $song["genre"] ?? "",
			"duration" => $song["duration_ms"] ?? 0,
			"stream_url" => "assets/php/streamSong.php?id=" . urlencode($song["id"])
		];
	}

	echo json_encode([
		"songs" => $result,
		"total" => $total,
		"limit" => $limit,
		"offset" => $offset
	]);

} catch (PDOException $e) {
	echo json_encode(["error" => "Search failed."]);
}
