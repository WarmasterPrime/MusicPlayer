<?php
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
$query = trim($input["query"] ?? $_POST["query"] ?? $_GET["query"] ?? "");
$limit = (int)($input["limit"] ?? $_POST["limit"] ?? $_GET["limit"] ?? 8);
$offset = (int)($input["offset"] ?? $_POST["offset"] ?? $_GET["offset"] ?? 0);

if ($limit < 1) $limit = 8;
if ($offset < 0) $offset = 0;

$searchColumns = ["`name`", "`artist`", "`genre`", "`album`", "`keywords`", "`composer`", "`album_artist`", "`publisher`"];

try {
	$pdo = Database::connect("media");

	$selectCols = "`id`, `name` AS `title`, `artist`, `album`, `genre`, `duration_ms`,
		`publisher`, `keywords`, `composer`, `album_artist`, `published_date`, `source_url`";

	// "*" means show all songs (no limit)
	if ($query === "*") {
		$countStmt = $pdo->query("SELECT COUNT(*) FROM `songs`");
		$total = (int)$countStmt->fetchColumn();

		$stmt = $pdo->query("
			SELECT {$selectCols}
			FROM `songs`
			ORDER BY `name` ASC
		");

	} elseif (strlen($query) > 0) {
		// Split query into individual words for per-word wildcard matching
		$words = preg_split('/\s+/', $query);
		$words = array_filter($words, function ($w) { return strlen($w) > 0; });
		$words = array_values($words);

		if (count($words) === 0) {
			echo json_encode(["songs" => [], "total" => 0, "limit" => $limit, "offset" => $offset]);
			exit;
		}

		// Build a relevance score: each word that matches any column adds 1 point
		// A word matches if ANY of the search columns contains it (OR across columns)
		$relevanceParts = [];
		$params = [];

		foreach ($words as $word) {
			$like = "%" . $word . "%";
			$wordConditions = [];
			foreach ($searchColumns as $col) {
				$wordConditions[] = "$col LIKE ?";
				$params[] = $like;
			}
			// This evaluates to 1 if the word matches any column, 0 otherwise
			$relevanceParts[] = "(" . implode(" OR ", $wordConditions) . ")";
		}

		$relevanceExpr = implode(" + ", $relevanceParts);

		// WHERE: at least one word matches at least one column
		$whereConditions = [];
		$whereParams = [];
		foreach ($words as $word) {
			$like = "%" . $word . "%";
			$wordConds = [];
			foreach ($searchColumns as $col) {
				$wordConds[] = "$col LIKE ?";
				$whereParams[] = $like;
			}
			$whereConditions[] = "(" . implode(" OR ", $wordConds) . ")";
		}
		$whereClause = implode(" OR ", $whereConditions);

		// Count total matching results
		$countSql = "SELECT COUNT(*) FROM `songs` WHERE $whereClause";
		$countStmt = $pdo->prepare($countSql);
		$countStmt->execute($whereParams);
		$total = (int)$countStmt->fetchColumn();

		// Fetch results ordered by relevance (more matching words first), then by name
		$sql = "
			SELECT {$selectCols},
			       ($relevanceExpr) AS `relevance`
			FROM `songs`
			WHERE $whereClause
			ORDER BY `relevance` DESC, `name` ASC
			LIMIT ? OFFSET ?
		";
		$allParams = array_merge($params, $whereParams, [$limit, $offset]);
		$stmt = $pdo->prepare($sql);
		$stmt->execute($allParams);

	} else {
		// No query: return initial set
		$countStmt = $pdo->query("SELECT COUNT(*) FROM `songs`");
		$total = (int)$countStmt->fetchColumn();

		$stmt = $pdo->prepare("
			SELECT {$selectCols}
			FROM `songs`
			ORDER BY `name` ASC
			LIMIT ? OFFSET ?
		");
		$stmt->execute([$limit, $offset]);
	}

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
			"publisher" => $song["publisher"] ?? "",
			"keywords" => $song["keywords"] ?? "",
			"composer" => $song["composer"] ?? "",
			"album_artist" => $song["album_artist"] ?? "",
			"publish_date" => $song["published_date"] ?? "",
			"source_url" => $song["source_url"] ?? "",
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
	echo json_encode(["songs" => [], "total" => 0, "error" => "Failed to load songs."]);
}
