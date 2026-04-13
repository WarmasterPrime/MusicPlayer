<?php
/**
 * Deletes a chat conversation and all associated data.
 * Removes messages, typing indicators, upload files, and the conversation record.
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

	// Delete messages
	$stmt = $pdo->prepare("DELETE FROM `chat_messages` WHERE `conversation_id` = ?");
	$stmt->execute([$conversationId]);

	// Delete typing indicators
	$stmt = $pdo->prepare("DELETE FROM `chat_typing` WHERE `conversation_id` = ?");
	$stmt->execute([$conversationId]);

	// Delete the conversation record
	$stmt = $pdo->prepare("DELETE FROM `chat_conversations` WHERE `id` = ?");
	$stmt->execute([$conversationId]);

	// Remove uploaded files directory
	$uploadDir = realpath(__DIR__ . "/../../uploads") ?: (__DIR__ . "/../../uploads");
	$chatDir = $uploadDir . "/chat/" . $conversationId;
	if (is_dir($chatDir)) {
		$files = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator($chatDir, RecursiveDirectoryIterator::SKIP_DOTS),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ($files as $fileInfo) {
			if ($fileInfo->isDir()) {
				rmdir($fileInfo->getRealPath());
			} else {
				unlink($fileInfo->getRealPath());
			}
		}
		rmdir($chatDir);
	}

	echo json_encode(["success" => true]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error deleting conversation."]);
}
