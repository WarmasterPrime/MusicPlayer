<?php
/**
 * Polls for new messages and typing status in a conversation.
 * Returns messages created after the given timestamp.
 * Single query, returns immediately (client polls at intervals).
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$conversationId = trim($_GET["conversation_id"] ?? "");
$after = trim($_GET["after"] ?? "");

if (strlen($conversationId) === 0) {
	echo json_encode(["success" => false, "message" => "Conversation ID required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");

	// Verify access
	$stmt = $pdo->prepare("SELECT `user_id`, `status` FROM `chat_conversations` WHERE `id` = ?");
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

	// Fetch new messages since the given timestamp
	if (strlen($after) > 0) {
		$msgStmt = $pdo->prepare("
			SELECT m.`id`, m.`conversation_id`, m.`sender_id`, m.`message`, m.`has_attachment`,
			       m.`attachment_name`, m.`attachment_path`, m.`attachment_size`,
			       m.`created_at`, u.`username` AS `sender_username`
			FROM `chat_messages` m
			LEFT JOIN `users` u ON m.`sender_id` = u.`id`
			WHERE m.`conversation_id` = ? AND m.`created_at` > ?
			ORDER BY m.`created_at` ASC
		");
		$msgStmt->execute([$conversationId, $after]);
	} else {
		$msgStmt = $pdo->prepare("
			SELECT m.`id`, m.`conversation_id`, m.`sender_id`, m.`message`, m.`has_attachment`,
			       m.`attachment_name`, m.`attachment_path`, m.`attachment_size`,
			       m.`created_at`, u.`username` AS `sender_username`
			FROM `chat_messages` m
			LEFT JOIN `users` u ON m.`sender_id` = u.`id`
			WHERE m.`conversation_id` = ?
			ORDER BY m.`created_at` ASC
		");
		$msgStmt->execute([$conversationId]);
	}

	$messages = $msgStmt->fetchAll();

	// Get the other party's typing indicator
	if ($isMod) {
		$typingStmt = $pdo->prepare("
			SELECT `user_id`, `content`, `updated_at`
			FROM `chat_typing`
			WHERE `conversation_id` = ? AND `user_id` = ?
			LIMIT 1
		");
		$typingStmt->execute([$conversationId, $conv["user_id"]]);
	} else {
		$typingStmt = $pdo->prepare("
			SELECT `user_id`, `content`, `updated_at`
			FROM `chat_typing`
			WHERE `conversation_id` = ? AND `user_id` != ?
			ORDER BY `updated_at` DESC
			LIMIT 1
		");
		$typingStmt->execute([$conversationId, $user["id"]]);
	}

	$typing = $typingStmt->fetch();

	echo json_encode([
		"success" => true,
		"messages" => $messages,
		"typing" => $typing ?: null,
		"status" => $conv["status"]
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error polling conversation."]);
}
