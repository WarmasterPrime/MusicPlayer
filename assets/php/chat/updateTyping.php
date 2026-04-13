<?php
/**
 * Updates the typing indicator for the current user in a conversation.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for upsert behavior.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$conversationId = trim($input["conversation_id"] ?? "");
$content = $input["content"] ?? "";

if (strlen($conversationId) === 0) {
	echo json_encode(["success" => false, "message" => "Conversation ID required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");

	// Verify user has access to this conversation
	$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");
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

	// Upsert typing indicator
	$stmt = $pdo->prepare("
		INSERT INTO `chat_typing` (`conversation_id`, `user_id`, `content`, `updated_at`)
		VALUES (?, ?, ?, NOW())
		ON DUPLICATE KEY UPDATE `content` = VALUES(`content`), `updated_at` = NOW()
	");
	$stmt->execute([$conversationId, $user["id"], $content]);

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error updating typing indicator."]);
}
