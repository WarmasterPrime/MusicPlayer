<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Authentication required."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("media");

	$stmt = $pdo->prepare("
		SELECT p.`id`, p.`title`, p.`description`, p.`user_id`, p.`created_at`, p.`updated_at`,
		       COUNT(ps.`song_id`) AS `song_count`
		FROM `playlists` p
		LEFT JOIN `playlist_songs` ps ON ps.`playlist_id` = p.`id`
		WHERE p.`user_id` = ?
		GROUP BY p.`id`, p.`title`, p.`description`, p.`user_id`, p.`created_at`, p.`updated_at`
		ORDER BY p.`updated_at` DESC
	");
	$stmt->execute([$user["id"]]);
	$playlists = $stmt->fetchAll();

	$result = [];
	foreach ($playlists as $row) {
		$result[] = [
			"id" => $row["id"],
			"title" => $row["title"],
			"description" => $row["description"] ?? "",
			"user_id" => $row["user_id"],
			"created_at" => $row["created_at"],
			"updated_at" => $row["updated_at"],
			"song_count" => (int)$row["song_count"],
		];
	}

	echo json_encode(["success" => true, "playlists" => $result]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
