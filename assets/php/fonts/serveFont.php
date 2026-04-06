<?php
/**
 * Serves a font file by ID with correct MIME type headers.
 * Used as src in @font-face CSS rules.
 */

require_once __DIR__ . "/../System/Database.php";

$id = $_GET["id"] ?? "";
if (empty($id)) {
	http_response_code(400);
	exit("Missing font ID.");
}

try {
	$pdo = Database::connect("media");
	$stmt = $pdo->prepare("SELECT `file_blob`, `mime_type`, `name` FROM `fonts` WHERE `id` = ?");
	$stmt->execute([$id]);
	$font = $stmt->fetch();

	if (!$font) {
		http_response_code(404);
		exit("Font not found.");
	}

	header("Content-Type: " . $font["mime_type"]);
	header("Content-Disposition: inline; filename=\"" . addslashes($font["name"]) . "\"");
	header("Cache-Control: public, max-age=31536000");
	echo $font["file_blob"];
} catch (PDOException $e) {
	http_response_code(500);
	exit("Error serving font.");
}
