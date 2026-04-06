<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

if (!isLoggedIn()) {
	http_response_code(401);
	exit;
}

$user = getCurrentUser();
$targetId = $_GET["id"] ?? $user["id"];

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("SELECT `profile_picture` FROM `users` WHERE `id` = ? AND `profile_picture` IS NOT NULL LIMIT 1");
	$stmt->execute([$targetId]);
	$row = $stmt->fetch();

	if (!$row || empty($row["profile_picture"])) {
		http_response_code(404);
		exit;
	}

	$blob = $row["profile_picture"];

	// Detect MIME type from the binary data
	$finfo = new finfo(FILEINFO_MIME_TYPE);
	$mime = $finfo->buffer($blob);
	if (!$mime || !str_starts_with($mime, "image/")) {
		$mime = "image/png";
	}

	header("Content-Type: " . $mime);
	header("Content-Length: " . strlen($blob));
	header("Cache-Control: private, max-age=3600");
	echo $blob;

} catch (PDOException $e) {
	http_response_code(500);
}
