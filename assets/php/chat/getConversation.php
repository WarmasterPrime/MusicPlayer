<?php
/**
 * Returns a chat conversation with its messages.
 * Logged-in users get their own active conversation.
 * Moderators/admins can fetch any conversation by ID.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");

try {
	$pdo = Database::connect("accounts");

	if ($isMod && isset($_GET["conversation_id"])) {
		// Moderators/admins can load any conversation
		$conversationId = trim($_GET["conversation_id"]);
		$stmt = $pdo->prepare("
			SELECT c.`id`, c.`user_id`, c.`assigned_to`, c.`status`, c.`created_at`, c.`last_activity`,
			       u.`username` AS `user_username`
			FROM `chat_conversations` c
			LEFT JOIN `users` u ON c.`user_id` = u.`id`
			WHERE c.`id` = ?
		");
		$stmt->execute([$conversationId]);
	} else {
		// Regular users get their own active conversation
		$stmt = $pdo->prepare("
			SELECT c.`id`, c.`user_id`, c.`assigned_to`, c.`status`, c.`created_at`, c.`last_activity`,
			       u.`username` AS `user_username`
			FROM `chat_conversations` c
			LEFT JOIN `users` u ON c.`user_id` = u.`id`
			WHERE c.`user_id` = ? AND c.`status` = 'open'
			ORDER BY c.`last_activity` DESC
			LIMIT 1
		");
		$stmt->execute([$user["id"]]);
	}

	$conversation = $stmt->fetch();

	if (!$conversation) {
		echo json_encode(["success" => true, "conversation" => null]);
		exit;
	}

	// Fetch messages with sender username
	$msgStmt = $pdo->prepare("
		SELECT m.`id`, m.`conversation_id`, m.`sender_id`, m.`message`, m.`has_attachment`,
		       m.`attachment_name`, m.`attachment_path`, m.`attachment_size`,
		       m.`created_at`, u.`username` AS `sender_username`
		FROM `chat_messages` m
		LEFT JOIN `users` u ON m.`sender_id` = u.`id`
		WHERE m.`conversation_id` = ?
		ORDER BY m.`created_at` ASC
	");
	$msgStmt->execute([$conversation["id"]]);
	$messages = $msgStmt->fetchAll();

	$conversation["messages"] = $messages;

	echo json_encode(["success" => true, "conversation" => $conversation]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading conversation."]);
}
