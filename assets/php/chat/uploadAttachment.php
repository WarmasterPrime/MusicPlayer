<?php
/**
 * Uploads a file attachment to a chat conversation.
 * Accepts multipart/form-data with max 5MB file size.
 * Allowed: jpg, png, gif, webp, pdf, txt.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$conversationId = trim($_POST["conversation_id"] ?? "");
$message = trim($_POST["message"] ?? "");

if (strlen($conversationId) === 0) {
	echo json_encode(["success" => false, "message" => "Conversation ID required."]);
	exit;
}

if (!isset($_FILES["file"]) || $_FILES["file"]["error"] !== UPLOAD_ERR_OK) {
	echo json_encode(["success" => false, "message" => "No file uploaded or upload error."]);
	exit;
}

$file = $_FILES["file"];
$maxSize = 5 * 1024 * 1024; // 5MB

if ($file["size"] > $maxSize) {
	echo json_encode(["success" => false, "message" => "File too large. Maximum size is 5MB."]);
	exit;
}

// Validate MIME type
$allowedMimes = [
	"image/jpeg", "image/png", "image/gif", "image/webp",
	"application/pdf", "text/plain"
];
$allowedExts = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "txt"];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file["tmp_name"]);
finfo_close($finfo);

$ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

if (!in_array($mimeType, $allowedMimes, true) || !in_array($ext, $allowedExts, true)) {
	echo json_encode(["success" => false, "message" => "Invalid file type. Allowed: jpg, png, gif, webp, pdf, txt."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");

	// Verify access to conversation
	$stmt = $pdo->prepare("SELECT `user_id` FROM `chat_conversations` WHERE `id` = ?");
	$stmt->execute([$conversationId]);
	$conv = $stmt->fetch();

	if (!$conv) {
		echo json_encode(["success" => false, "message" => "Conversation not found."]);
		exit;
	}

	if ($conv["user_id"] !== $user["id"] && !$isMod) {
		echo json_encode(["success" => false, "message" => "Access denied."]);
		exit;
	}

	// Create upload directory
	$uploadDir = realpath(__DIR__ . "/../../uploads") ?: (__DIR__ . "/../../uploads");
	$chatDir = $uploadDir . "/chat/" . $conversationId;
	if (!is_dir($chatDir)) {
		mkdir($chatDir, 0775, true);
	}

	// Generate unique filename to prevent collisions
	$safeFilename = Database::generateId(16) . "." . $ext;
	$destPath = $chatDir . "/" . $safeFilename;

	if (!move_uploaded_file($file["tmp_name"], $destPath)) {
		echo json_encode(["success" => false, "message" => "Failed to save file."]);
		exit;
	}

	// Relative path for serving the file
	$attachmentPath = "assets/uploads/chat/" . $conversationId . "/" . $safeFilename;

	// Insert message with attachment info
	$messageId = Database::generateUUID();
	$stmt = $pdo->prepare("
		INSERT INTO `chat_messages` (`id`, `conversation_id`, `sender_id`, `message`, `has_attachment`,
		                             `attachment_name`, `attachment_path`, `attachment_size`, `created_at`)
		VALUES (?, ?, ?, ?, 1, ?, ?, ?, NOW())
	");
	$stmt->execute([
		$messageId,
		$conversationId,
		$user["id"],
		$message,
		$file["name"],
		$attachmentPath,
		$file["size"]
	]);

	// Update conversation last_activity
	$stmt = $pdo->prepare("UPDATE `chat_conversations` SET `last_activity` = NOW() WHERE `id` = ?");
	$stmt->execute([$conversationId]);

	// Clear typing indicator
	$stmt = $pdo->prepare("DELETE FROM `chat_typing` WHERE `conversation_id` = ? AND `user_id` = ?");
	$stmt->execute([$conversationId, $user["id"]]);

	echo json_encode([
		"success" => true,
		"message_id" => $messageId,
		"attachment_path" => $attachmentPath
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error uploading attachment."]);
}
