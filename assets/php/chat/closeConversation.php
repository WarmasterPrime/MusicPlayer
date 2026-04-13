<?php
/**
 * Closes a chat conversation.
 * Requires Moderator or UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("Moderator") && !hasAuthority("UserAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$conversationId = trim($input["conversation_id"] ?? "");

if (strlen($conversationId) === 0) {
	echo json_encode(["success" => false, "message" => "Conversation ID required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");

	$stmt = $pdo->prepare("SELECT `id` FROM `chat_conversations` WHERE `id` = ?");
	$stmt->execute([$conversationId]);

	if (!$stmt->fetch()) {
		echo json_encode(["success" => false, "message" => "Conversation not found."]);
		exit;
	}

	$stmt = $pdo->prepare("UPDATE `chat_conversations` SET `status` = 'closed' WHERE `id` = ?");
	$stmt->execute([$conversationId]);

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error closing conversation."]);
}
