<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/Authority.php";

header("Content-Type: application/json");

$user = getCurrentUser();

// If logged in, check that the user has ClientViewPublic
if ($user) {
	if (!Authority::hasFlag($user["authority"], "ClientViewPublic")) {
		echo json_encode(["success" => false, "message" => "Permission denied."]);
		exit;
	}
}

try {
	$pdo = Database::connect("media");
	$pdoAccounts = Database::connect("accounts");

	// Build query to find playlists where view permission has public=1
	$sql = "
		SELECT p.`id`, p.`title`, p.`description`, p.`user_id`, p.`created_at`, p.`updated_at`,
		       COUNT(ps.`song_id`) AS `song_count`
		FROM `playlists` p
		INNER JOIN `playlist_permissions` pp ON pp.`playlist_id` = p.`id`
			AND pp.`permission_name` = 'view'
			AND pp.`public` = 1
		LEFT JOIN `playlist_songs` ps ON ps.`playlist_id` = p.`id`
	";

	$params = [];

	$sql .= " GROUP BY p.`id`, p.`title`, p.`description`, p.`user_id`, p.`created_at`, p.`updated_at` ORDER BY p.`updated_at` DESC";

	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);
	$playlists = $stmt->fetchAll();

	// Collect unique owner UIDs to fetch usernames
	$ownerUids = array_unique(array_column($playlists, "user_id"));
	$usernameMap = [];

	if (count($ownerUids) > 0) {
		$placeholders = implode(",", array_fill(0, count($ownerUids), "?"));
		$userStmt = $pdoAccounts->prepare("SELECT `id`, `username` FROM `users` WHERE `id` IN ({$placeholders})");
		$userStmt->execute(array_values($ownerUids));
		$users = $userStmt->fetchAll();
		foreach ($users as $u) {
			$usernameMap[$u["id"]] = $u["username"];
		}
	}

	$result = [];
	foreach ($playlists as $row) {
		$result[] = [
			"id" => $row["id"],
			"title" => $row["title"],
			"description" => $row["description"] ?? "",
			"user_id" => $row["user_id"],
			"owner_username" => $usernameMap[$row["user_id"]] ?? "",
			"created_at" => $row["created_at"],
			"updated_at" => $row["updated_at"],
			"song_count" => (int)$row["song_count"],
		];
	}

	echo json_encode(["success" => true, "playlists" => $result]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
