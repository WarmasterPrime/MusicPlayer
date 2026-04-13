<?php
/**
 * Returns the other party's typing indicator for a conversation.
 * Moderators see the user's typing; users see the moderator's typing.
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

if (strlen($conversationId) === 0) {
	echo json_encode(["success" => false, "message" => "Conversation ID required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$isMod = hasAuthority("Moderator") || hasAuthority("UserAdmin");

	// Get conversation to determine user_id
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

	// Return the other party's typing indicator
	// If moderator: get the user's typing. If user: get anyone else's typing (the moderator).
	if ($isMod) {
		$stmt = $pdo->prepare("
			SELECT `user_id`, `content`, `updated_at`
			FROM `chat_typing`
			WHERE `conversation_id` = ? AND `user_id` = ?
			LIMIT 1
		");
		$stmt->execute([$conversationId, $conv["user_id"]]);
	} else {
		$stmt = $pdo->prepare("
			SELECT `user_id`, `content`, `updated_at`
			FROM `chat_typing`
			WHERE `conversation_id` = ? AND `user_id` != ?
			ORDER BY `updated_at` DESC
			LIMIT 1
		");
		$stmt->execute([$conversationId, $user["id"]]);
	}

	$typing = $stmt->fetch();

	echo json_encode([
		"success" => true,
		"typing" => $typing ?: null
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading typing indicator."]);
}
