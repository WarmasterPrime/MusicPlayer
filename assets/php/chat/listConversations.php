<?php
/**
 * Lists chat conversations with pagination and status filter.
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

$status = trim($_GET["status"] ?? "");
$page = max(1, intval($_GET["page"] ?? 1));
$limit = 20;
$offset = ($page - 1) * $limit;

try {
	$pdo = Database::connect("accounts");

	$where = "";
	$params = [];

	if ($status === "open" || $status === "closed") {
		$where = "WHERE c.`status` = ?";
		$params[] = $status;
	}

	// Count total
	$countStmt = $pdo->prepare("SELECT COUNT(*) AS `total` FROM `chat_conversations` c $where");
	$countStmt->execute($params);
	$total = (int)$countStmt->fetch()["total"];

	// Fetch conversations with user info and latest message preview
	$params[] = $limit;
	$params[] = $offset;
	$stmt = $pdo->prepare("
		SELECT c.`id`, c.`user_id`, c.`assigned_to`, c.`status`, c.`created_at`, c.`last_activity`,
		       u.`username`,
		       (
		           SELECT m.`message`
		           FROM `chat_messages` m
		           WHERE m.`conversation_id` = c.`id`
		           ORDER BY m.`created_at` DESC
		           LIMIT 1
		       ) AS `last_message`
		FROM `chat_conversations` c
		LEFT JOIN `users` u ON c.`user_id` = u.`id`
		$where
		ORDER BY c.`last_activity` DESC
		LIMIT ? OFFSET ?
	");
	$stmt->execute($params);
	$conversations = $stmt->fetchAll();

	echo json_encode([
		"success" => true,
		"conversations" => $conversations,
		"total" => $total,
		"page" => $page,
		"pages" => max(1, (int)ceil($total / $limit))
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading conversations."]);
}
