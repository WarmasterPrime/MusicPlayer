<?php
/**
 * Handles custom font file upload.
 * Feature-gated: requires custom_fonts feature.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/FeatureGate.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

// Feature gate check
$gate = FeatureGate::check($user["id"], "custom_fonts");
if (!$gate["allowed"]) {
	echo json_encode(["success" => false, "message" => $gate["message"], "feature_gated" => true]);
	exit;
}

if (!isset($_FILES["font_file"]) || $_FILES["font_file"]["error"] !== UPLOAD_ERR_OK) {
	echo json_encode(["success" => false, "message" => "No font file uploaded."]);
	exit;
}

$file = $_FILES["font_file"];
$name = trim($_POST["name"] ?? pathinfo($file["name"], PATHINFO_FILENAME));

if (empty($name)) {
	echo json_encode(["success" => false, "message" => "Font name is required."]);
	exit;
}

// Validate file extension
$ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
$allowedExts = ["ttf", "otf", "woff", "woff2"];

if (!in_array($ext, $allowedExts)) {
	echo json_encode(["success" => false, "message" => "Invalid font file type. Allowed: TTF, OTF, WOFF, WOFF2."]);
	exit;
}

// Determine MIME type from extension
$mimeMap = ["ttf" => "font/ttf", "otf" => "font/otf", "woff" => "font/woff", "woff2" => "font/woff2"];
$mime = $mimeMap[$ext] ?? "font/ttf";

// Read file content
$blob = file_get_contents($file["tmp_name"]);
if ($blob === false) {
	echo json_encode(["success" => false, "message" => "Failed to read font file."]);
	exit;
}

// Max 5MB
if (strlen($blob) > 5 * 1024 * 1024) {
	echo json_encode(["success" => false, "message" => "Font file too large. Max 5MB."]);
	exit;
}

try {
	$pdo = Database::connect("media");
	$id = Database::generateId(255);
	$stmt = $pdo->prepare("INSERT INTO `fonts` (`id`, `name`, `file_blob`, `mime_type`, `uploaded_by`) VALUES (?, ?, ?, ?, ?)");
	$stmt->execute([$id, $name, $blob, $mime, $user["id"]]);

	echo json_encode(["success" => true, "font_id" => $id, "name" => $name]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Failed to save font."]);
}
