<?php
/**
 * Cleans up stale chat conversations older than 1 month.
 * Deletes messages, typing indicators, uploads, and conversation records.
 * Can be called via cron or by an admin.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

// Allow cron (CLI) or logged-in admin
$isCli = php_sapi_name() === "cli";
if (!$isCli) {
	if (!isLoggedIn()) {
		echo json_encode(["success" => false, "message" => "Not logged in."]);
		exit;
	}

	if (!hasAuthority("Moderator") && !hasAuthority("UserAdmin")) {
		echo json_encode(["success" => false, "message" => "Access denied."]);
		exit;
	}
}

try {
	$pdo = Database::connect("accounts");

	// Find stale conversations (last_activity older than 1 month)
	$stmt = $pdo->prepare("
		SELECT `id` FROM `chat_conversations`
		WHERE `last_activity` < DATE_SUB(NOW(), INTERVAL 1 MONTH)
	");
	$stmt->execute();
	$staleConversations = $stmt->fetchAll(PDO::FETCH_COLUMN);

	$deletedCount = 0;
	$uploadDir = realpath(__DIR__ . "/../../uploads") ?: (__DIR__ . "/../../uploads");

	foreach ($staleConversations as $conversationId) {
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

		$deletedCount++;
	}

	echo json_encode([
		"success" => true,
		"deleted_count" => $deletedCount
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error cleaning up stale conversations."]);
}
