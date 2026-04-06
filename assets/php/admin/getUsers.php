<?php
/**
 * Lists/searches users with pagination.
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("UserAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$search = $_GET["search"] ?? "";
$page = max(1, intval($_GET["page"] ?? 1));
$limit = 20;
$offset = ($page - 1) * $limit;

try {
	$pdo = Database::connect("accounts");

	if (!empty($search)) {
		$like = "%" . $search . "%";
		$stmt = $pdo->prepare("
			SELECT `id`, `username`, `email`, `authority`, `created_at`
			FROM `users`
			WHERE `username` LIKE ? OR `email` LIKE ?
			ORDER BY `created_at` DESC
			LIMIT ? OFFSET ?
		");
		$stmt->execute([$like, $like, $limit, $offset]);

		$countStmt = $pdo->prepare("SELECT COUNT(*) AS `total` FROM `users` WHERE `username` LIKE ? OR `email` LIKE ?");
		$countStmt->execute([$like, $like]);
	} else {
		$stmt = $pdo->prepare("
			SELECT `id`, `username`, `email`, `authority`, `created_at`
			FROM `users`
			ORDER BY `created_at` DESC
			LIMIT ? OFFSET ?
		");
		$stmt->execute([$limit, $offset]);

		$countStmt = $pdo->prepare("SELECT COUNT(*) AS `total` FROM `users`");
		$countStmt->execute();
	}

	$users = $stmt->fetchAll();
	$total = $countStmt->fetch()["total"];

	echo json_encode([
		"success" => true,
		"users" => $users,
		"total" => intval($total),
		"page" => $page,
		"pages" => max(1, ceil($total / $limit))
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Error loading users."]);
}
