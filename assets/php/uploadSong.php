<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/Authority.php";
require_once __DIR__ . "/System/FeatureGate.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

// Re-read authority from database in case it was updated since login
try {
	$accPdo = Database::connect("accounts");
	$authStmt = $accPdo->prepare("SELECT `authority` FROM `users` WHERE `id` = ? LIMIT 1");
	$authStmt->execute([$user["id"]]);
	$dbAuth = $authStmt->fetchColumn();
	if (is_string($dbAuth) && strlen($dbAuth) > 0) {
		$user["authority"] = $dbAuth;
		$_SESSION["authority"] = $dbAuth;
	}
} catch (PDOException $e) {}

if (!Authority::hasFlag($user["authority"], "DbInsert")) {
	echo json_encode(["success" => false, "message" => "Insufficient permissions."]);
	exit;
}

// Feature gate check for file uploads
$gate = FeatureGate::check($user["id"], "file_upload");
if (!$gate["allowed"]) {
	echo json_encode(["success" => false, "message" => $gate["message"], "feature_gated" => true]);
	exit;
}

if (!isset($_FILES["audio_file"]) || $_FILES["audio_file"]["error"] !== UPLOAD_ERR_OK) {
	echo json_encode(["success" => false, "message" => "No file uploaded or upload error."]);
	exit;
}

$title = $_POST["title"] ?? "";
$artist = $_POST["artist"] ?? "";
$album = $_POST["album"] ?? "";
$albumArtist = $_POST["album_artist"] ?? "";
$genre = $_POST["genre"] ?? "";
$composer = $_POST["composer"] ?? "";
$publisher = $_POST["publisher"] ?? "";
$publishDate = $_POST["publish_date"] ?? "";
$sourceUrl = $_POST["source_url"] ?? "";
$keywords = $_POST["keywords"] ?? "";

if (strlen(trim($title)) === 0) {
	echo json_encode(["success" => false, "message" => "Title is required."]);
	exit;
}

$file = $_FILES["audio_file"];
$allowedTypes = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/mp3", "audio/aac"];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file["tmp_name"]);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes, true)) {
	echo json_encode(["success" => false, "message" => "Invalid file type. Allowed: mp3, m4a, mp4, aac."]);
	exit;
}

try {
	$pdo = Database::connect("media");

	// Check for duplicate title + artist
	$stmt = $pdo->prepare("SELECT COUNT(*) FROM `songs` WHERE `name` = ? AND `artist` = ?");
	$stmt->execute([trim($title), trim($artist)]);
	if ((int)$stmt->fetchColumn() > 0) {
		echo json_encode(["success" => false, "message" => "A song with this title and artist already exists."]);
		exit;
	}

	$songId = Database::generateUUID();
	$fileBlob = file_get_contents($file["tmp_name"]);
	$fileSize = $file["size"];

	// Insert song metadata
	$pubDateVal = null;
	if (strlen(trim($publishDate)) > 0) {
		$d = DateTime::createFromFormat("Y-m-d", trim($publishDate));
		if ($d !== false) $pubDateVal = $d->format("Y-m-d");
	}

	$stmt = $pdo->prepare("
		INSERT INTO `songs` (`id`, `name`, `artist`, `album`, `album_artist`, `genre`, `composer`, `publisher`, `published_date`, `source_url`, `keywords`, `uploaded_by`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	");
	$stmt->execute([
		$songId,
		trim($title),
		trim($artist),
		trim($album),
		trim($albumArtist),
		trim($genre),
		trim($composer),
		trim($publisher),
		$pubDateVal,
		trim($sourceUrl),
		trim($keywords),
		$user["id"]
	]);

	// Insert file blob
	$fileId = Database::generateUUID();
	$stmt = $pdo->prepare("
		INSERT INTO `song_files` (`id`, `song_id`, `file_blob`, `mime_type`, `file_size_bytes`, `original_filename`, `file_ext`)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	");
	$fileExt = pathinfo($file["name"], PATHINFO_EXTENSION);
	$stmt->execute([
		$fileId,
		$songId,
		$fileBlob,
		$mimeType,
		$fileSize,
		$file["name"],
		$fileExt
	]);

	echo json_encode([
		"success" => true,
		"message" => "Song uploaded successfully.",
		"song" => [
			"song_id" => $songId,
			"title" => trim($title),
			"artist" => trim($artist),
			"stream_url" => "assets/php/streamSong.php?id=" . urlencode($songId)
		]
	]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
