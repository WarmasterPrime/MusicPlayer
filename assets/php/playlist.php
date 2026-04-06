<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/Authority.php";
require_once __DIR__ . "/System/FeatureGate.php";

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) $input = $_POST;
$cmd = $input["cmd"] ?? null;

if (!is_string($cmd) || strlen($cmd) === 0) {
	echo json_encode(["success" => false, "message" => "cmd is required."]);
	exit;
}

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Authentication required."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("media");

	switch ($cmd) {

		case "create":
			// Feature gate check for playlist creation
			$gate = FeatureGate::check($user["id"], "playlists");
			if (!$gate["allowed"]) {
				echo json_encode(["success" => false, "message" => $gate["message"], "feature_gated" => true]);
				exit;
			}

			$title = $input["title"] ?? null;
			$description = $input["description"] ?? "";

			if (!is_string($title) || strlen($title) === 0) {
				echo json_encode(["success" => false, "message" => "title is required."]);
				exit;
			}

			$playlistId = Database::generateUUID();
			$now = date("Y-m-d H:i:s");

			// Determine visibility from default view permission (public=1 → 'public')
			$visibility = "public";

			$stmt = $pdo->prepare("
				INSERT INTO `playlists` (`id`, `title`, `description`, `user_id`, `visibility`, `created_at`, `updated_at`)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			");
			$stmt->execute([$playlistId, $title, $description, $user["id"], $visibility, $now, $now]);

			// Insert default permission rows
			$defaultPermissions = [
				["view",            1, 1, 1],
				["like",            0, 1, 1],
				["add_to_playlist", 0, 0, 1],
				["edit_lyrics",     0, 0, 0],
				["edit_song_info",  0, 0, 0],
			];

			$permStmt = $pdo->prepare("
				INSERT INTO `playlist_permissions` (`id`, `playlist_id`, `permission_name`, `private`, `unlisted`, `public`)
				VALUES (?, ?, ?, ?, ?, ?)
			");
			foreach ($defaultPermissions as $perm) {
				$permStmt->execute([
					Database::generateUUID(),
					$playlistId,
					$perm[0],
					$perm[1],
					$perm[2],
					$perm[3],
				]);
			}

			echo json_encode([
				"success" => true,
				"message" => "Playlist created.",
				"playlist" => [
					"id" => $playlistId,
					"title" => $title,
					"description" => $description,
					"user_id" => $user["id"],
					"created_at" => $now,
					"updated_at" => $now,
				]
			]);
			break;

		case "delete":
			$playlistId = $input["playlist_id"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];
			if (!$isOwner && !Authority::hasFlag($user["authority"], "ClientModifyPublic")) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			$pdo->prepare("DELETE FROM `playlist_songs` WHERE `playlist_id` = ?")->execute([$playlistId]);
			$pdo->prepare("DELETE FROM `playlist_permissions` WHERE `playlist_id` = ?")->execute([$playlistId]);
			$pdo->prepare("DELETE FROM `playlists` WHERE `id` = ?")->execute([$playlistId]);

			echo json_encode(["success" => true, "message" => "Playlist deleted."]);
			break;

		case "update":
			$playlistId = $input["playlist_id"] ?? null;
			$title = $input["title"] ?? null;
			$description = $input["description"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];

			// Determine visibility for permission check
			$permStmt = $pdo->prepare("
				SELECT `public`, `unlisted`, `private`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ? AND `permission_name` = 'view'
				LIMIT 1
			");
			$permStmt->execute([$playlistId]);
			$viewPerm = $permStmt->fetch();

			$visibility = "private";
			if ($viewPerm) {
				if ($viewPerm["public"]) $visibility = "public";
				elseif ($viewPerm["unlisted"]) $visibility = "unlisted";
			}

			if (!Authority::canModify($user["authority"], $visibility, $isOwner)) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			$fields = [];
			$params = [];
			if (is_string($title) && strlen($title) > 0) {
				$fields[] = "`title` = ?";
				$params[] = $title;
			}
			if (is_string($description)) {
				$fields[] = "`description` = ?";
				$params[] = $description;
			}

			if (count($fields) === 0) {
				echo json_encode(["success" => false, "message" => "Nothing to update."]);
				exit;
			}

			$fields[] = "`updated_at` = ?";
			$params[] = date("Y-m-d H:i:s");
			$params[] = $playlistId;

			$sql = "UPDATE `playlists` SET " . implode(", ", $fields) . " WHERE `id` = ?";
			$pdo->prepare($sql)->execute($params);

			echo json_encode(["success" => true, "message" => "Playlist updated."]);
			break;

		case "addSong":
			$playlistId = $input["playlist_id"] ?? null;
			$songId = $input["song_id"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}
			if (!is_string($songId) || strlen($songId) === 0) {
				echo json_encode(["success" => false, "message" => "song_id is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];

			// Check add_to_playlist permission based on visibility
			$permStmt = $pdo->prepare("
				SELECT `public`, `unlisted`, `private`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ? AND `permission_name` = 'add_to_playlist'
				LIMIT 1
			");
			$permStmt->execute([$playlistId]);
			$addPerm = $permStmt->fetch();

			$allowed = $isOwner;
			if (!$allowed && $addPerm) {
				if ($addPerm["public"]) $allowed = true;
				elseif ($addPerm["unlisted"] && Authority::hasFlag($user["authority"], "ClientViewUnlisted")) $allowed = true;
				elseif ($addPerm["private"] && Authority::hasFlag($user["authority"], "ClientViewPrivate")) $allowed = true;
			}

			if (!$allowed) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			// Get the next position
			$posStmt = $pdo->prepare("SELECT COALESCE(MAX(`position`), 0) + 1 AS `next_pos` FROM `playlist_songs` WHERE `playlist_id` = ?");
			$posStmt->execute([$playlistId]);
			$nextPos = (int)$posStmt->fetch()["next_pos"];

			$stmt = $pdo->prepare("
				INSERT INTO `playlist_songs` (`playlist_id`, `song_id`, `position`, `added_at`)
				VALUES (?, ?, ?, NOW())
			");
			$stmt->execute([$playlistId, $songId, $nextPos]);

			echo json_encode([
				"success" => true,
				"message" => "Song added to playlist.",
				"entry" => [
					"playlist_id" => $playlistId,
					"song_id" => $songId,
					"position" => $nextPos,
				]
			]);
			break;

		case "removeSong":
			$playlistId = $input["playlist_id"] ?? null;
			$songId = $input["song_id"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}
			if (!is_string($songId) || strlen($songId) === 0) {
				echo json_encode(["success" => false, "message" => "song_id is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];

			// Determine visibility for modify check
			$permStmt = $pdo->prepare("
				SELECT `public`, `unlisted`, `private`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ? AND `permission_name` = 'view'
				LIMIT 1
			");
			$permStmt->execute([$playlistId]);
			$viewPerm = $permStmt->fetch();

			$visibility = "private";
			if ($viewPerm) {
				if ($viewPerm["public"]) $visibility = "public";
				elseif ($viewPerm["unlisted"]) $visibility = "unlisted";
			}

			if (!Authority::canModify($user["authority"], $visibility, $isOwner)) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			$stmt = $pdo->prepare("DELETE FROM `playlist_songs` WHERE `song_id` = ? AND `playlist_id` = ?");
			$stmt->execute([$songId, $playlistId]);

			echo json_encode(["success" => true, "message" => "Song removed from playlist."]);
			break;

		case "reorder":
			$playlistId = $input["playlist_id"] ?? null;
			$items = $input["items"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}
			if (!is_array($items) || count($items) === 0) {
				echo json_encode(["success" => false, "message" => "items array is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];

			$permStmt = $pdo->prepare("
				SELECT `public`, `unlisted`, `private`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ? AND `permission_name` = 'view'
				LIMIT 1
			");
			$permStmt->execute([$playlistId]);
			$viewPerm = $permStmt->fetch();

			$visibility = "private";
			if ($viewPerm) {
				if ($viewPerm["public"]) $visibility = "public";
				elseif ($viewPerm["unlisted"]) $visibility = "unlisted";
			}

			if (!Authority::canModify($user["authority"], $visibility, $isOwner)) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			// Offset all positions high to avoid unique constraint violations during reorder
			$offsetStmt = $pdo->prepare("UPDATE `playlist_songs` SET `position` = `position` + 100000 WHERE `playlist_id` = ?");
			$offsetStmt->execute([$playlistId]);

			$updateStmt = $pdo->prepare("UPDATE `playlist_songs` SET `position` = ? WHERE `song_id` = ? AND `playlist_id` = ?");
			foreach ($items as $item) {
				$songId = $item["song_id"] ?? null;
				$position = $item["position"] ?? null;
				if (is_string($songId) && is_numeric($position)) {
					$updateStmt->execute([(int)$position, $songId, $playlistId]);
				}
			}

			echo json_encode(["success" => true, "message" => "Playlist reordered."]);
			break;

		case "getPermissions":
			$playlistId = $input["playlist_id"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id`, `title`, `description` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$permStmt = $pdo->prepare("
				SELECT `permission_name`, `private`, `unlisted`, `public`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ?
			");
			$permStmt->execute([$playlistId]);
			$permRows = $permStmt->fetchAll();

			$permissions = [];
			foreach ($permRows as $row) {
				$permissions[] = [
					"name" => $row["permission_name"],
					"private" => (int)$row["private"],
					"unlisted" => (int)$row["unlisted"],
					"public" => (int)$row["public"],
				];
			}

			echo json_encode([
				"success" => true,
				"playlist" => [
					"id" => $playlist["id"],
					"title" => $playlist["title"],
					"description" => $playlist["description"] ?? "",
				],
				"permissions" => $permissions
			]);
			break;

		case "updatePermissions":
			$playlistId = $input["playlist_id"] ?? null;
			$permissions = $input["permissions"] ?? null;

			if (!is_string($playlistId) || strlen($playlistId) === 0) {
				echo json_encode(["success" => false, "message" => "playlist_id is required."]);
				exit;
			}
			if (!is_array($permissions)) {
				echo json_encode(["success" => false, "message" => "permissions array is required."]);
				exit;
			}

			$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `playlists` WHERE `id` = ? LIMIT 1");
			$stmt->execute([$playlistId]);
			$playlist = $stmt->fetch();

			if (!$playlist) {
				echo json_encode(["success" => false, "message" => "Playlist not found."]);
				exit;
			}

			$isOwner = $playlist["user_id"] === $user["id"];

			// Determine visibility for modify check
			$permStmt = $pdo->prepare("
				SELECT `public`, `unlisted`, `private`
				FROM `playlist_permissions`
				WHERE `playlist_id` = ? AND `permission_name` = 'view'
				LIMIT 1
			");
			$permStmt->execute([$playlistId]);
			$viewPerm = $permStmt->fetch();

			$visibility = "private";
			if ($viewPerm) {
				if ($viewPerm["public"]) $visibility = "public";
				elseif ($viewPerm["unlisted"]) $visibility = "unlisted";
			}

			if (!Authority::canModify($user["authority"], $visibility, $isOwner)) {
				echo json_encode(["success" => false, "message" => "Permission denied."]);
				exit;
			}

			$validNames = ["view", "like", "add_to_playlist", "edit_lyrics", "edit_song_info"];
			$updateStmt = $pdo->prepare("
				UPDATE `playlist_permissions`
				SET `private` = ?, `unlisted` = ?, `public` = ?
				WHERE `playlist_id` = ? AND `permission_name` = ?
			");

			foreach ($permissions as $perm) {
				$name = $perm["name"] ?? null;
				if (!is_string($name) || !in_array($name, $validNames, true)) continue;
				$priv = (int)($perm["private"] ?? 0);
				$unl = (int)($perm["unlisted"] ?? 0);
				$pub = (int)($perm["public"] ?? 0);
				$updateStmt->execute([$priv, $unl, $pub, $playlistId, $name]);
			}

			echo json_encode(["success" => true, "message" => "Permissions updated."]);
			break;

		default:
			echo json_encode(["success" => false, "message" => "Unknown command: " . $cmd]);
			break;
	}

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
