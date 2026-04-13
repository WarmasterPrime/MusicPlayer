<?php
/**
 * Sends a message in a chat conversation.
 * Creates a new conversation if none is specified.
 * Clears the sender's typing indicator after sending.
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
$message = trim($input["message"] ?? "");

if (strlen($message) === 0) {
	echo json_encode(["success" => false, "message" => "Message cannot be empty."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");

	// Create conversation if none provided
	if (strlen($conversationId) === 0) {
		// Check if user already has an open conversation
		$stmt = $pdo->prepare("SELECT `id` FROM `chat_conversations` WHERE `user_id` = ? AND `status` = 'open' LIMIT 1");
		$stmt->execute([$user["id"]]);
		$existing = $stmt->fetchColumn();

		if ($existing) {
			$conversationId = $existing;
		} else {
			$conversationId = Database::generateUUID();
			$stmt = $pdo->prepare("
				INSERT INTO `chat_conversations` (`id`, `user_id`, `status`, `created_at`, `last_activity`)
				VALUES (?, ?, 'open', NOW(), NOW())
			");
			$stmt->execute([$conversationId, $user["id"]]);
		}
	} else {
		// Verify the user has access to this conversation
		$stmt = $pdo->prepare("SELECT `id`, `user_id` FROM `chat_conversations` WHERE `id` = ?");
		$stmt->execute([$conversationId]);
		$conv = $stmt->fetch();

		if (!$conv) {
			echo json_encode(["success" => false, "message" => "Conversation not found."]);
			exit;
		}

		// Only the conversation owner or a moderator/admin can send messages
		if ($conv["user_id"] !== $user["id"] && !$isMod) {
			echo json_encode(["success" => false, "message" => "Access denied."]);
			exit;
		}
	}

	// Insert the message
	$messageId = Database::generateUUID();
	$stmt = $pdo->prepare("
		INSERT INTO `chat_messages` (`id`, `conversation_id`, `sender_id`, `message`, `has_attachment`, `created_at`)
		VALUES (?, ?, ?, ?, 0, NOW())
	");
	$stmt->execute([$messageId, $conversationId, $user["id"], $message]);

	// Update conversation last_activity
	$stmt = $pdo->prepare("UPDATE `chat_conversations` SET `last_activity` = NOW() WHERE `id` = ?");
	$stmt->execute([$conversationId]);

	// Clear typing indicator for this user in this conversation
	$stmt = $pdo->prepare("DELETE FROM `chat_typing` WHERE `conversation_id` = ? AND `user_id` = ?");
	$stmt->execute([$conversationId, $user["id"]]);

	echo json_encode([
		"success" => true,
		"message_id" => $messageId,
		"conversation_id" => $conversationId
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error sending message."]);
}
