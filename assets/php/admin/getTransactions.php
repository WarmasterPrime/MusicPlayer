<?php
/**
 * Returns transactions with user info for the admin Transactions tab.
 * Supports date range filtering and search by username/email.
 * Requires UserAdmin or StoreAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("UserAdmin") && !hasAuthority("StoreAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$search = trim($_GET["search"] ?? "");
$dateFrom = trim($_GET["date_from"] ?? "");
$dateTo = trim($_GET["date_to"] ?? "");
$limit = intval($_GET["limit"] ?? 200);
if ($limit < 1 || $limit > 1000) $limit = 200;

try {
	$pdoStore = Database::connect("store");
	$pdoAccounts = Database::connect("accounts");

	// Build base query
	$sql = "SELECT t.`id`, t.`user_id`, t.`paypal_capture_id`, t.`paypal_order_id`, t.`amount_cents`, t.`tax_amount`, t.`currency`, t.`description`, t.`status`, t.`created_at` FROM `transactions` t WHERE 1=1";
	$params = [];

	// Date range filter
	if (!empty($dateFrom)) {
		$sql .= " AND t.`created_at` >= ?";
		$params[] = $dateFrom . " 00:00:00";
	}
	if (!empty($dateTo)) {
		$sql .= " AND t.`created_at` <= ?";
		$params[] = $dateTo . " 23:59:59";
	}

	// If search term, first find matching user IDs
	$userIdFilter = [];
	if (!empty($search)) {
		$stmtU = $pdoAccounts->prepare("SELECT `id` FROM `users` WHERE `username` LIKE ? OR `email` LIKE ? LIMIT 100");
		$searchLike = "%" . $search . "%";
		$stmtU->execute([$searchLike, $searchLike]);
		$userIdFilter = $stmtU->fetchAll(PDO::FETCH_COLUMN);

		if (empty($userIdFilter)) {
			// No matching users — return empty
			echo json_encode(["success" => true, "transactions" => [], "total" => 0]);
			exit;
		}

		$placeholders = implode(",", array_fill(0, count($userIdFilter), "?"));
		$sql .= " AND t.`user_id` IN (" . $placeholders . ")";
		$params = array_merge($params, $userIdFilter);
	}

	$sql .= " ORDER BY t.`created_at` DESC LIMIT " . $limit;

	$stmt = $pdoStore->prepare($sql);
	$stmt->execute($params);
	$transactions = $stmt->fetchAll();

	// Collect unique user IDs and batch-fetch usernames
	$userIds = array_unique(array_column($transactions, "user_id"));
	$userMap = [];
	if (!empty($userIds)) {
		$placeholders = implode(",", array_fill(0, count($userIds), "?"));
		$stmtUsers = $pdoAccounts->prepare("SELECT `id`, `username`, `email` FROM `users` WHERE `id` IN (" . $placeholders . ")");
		$stmtUsers->execute(array_values($userIds));
		foreach ($stmtUsers->fetchAll() as $u) {
			$userMap[$u["id"]] = ["username" => $u["username"], "email" => $u["email"]];
		}
	}

	// Attach user info
	foreach ($transactions as &$t) {
		$uid = $t["user_id"];
		$t["username"] = $userMap[$uid]["username"] ?? "Unknown";
		$t["email"] = $userMap[$uid]["email"] ?? "";
	}

	// Get total count for the date range (without limit)
	$countSql = "SELECT COUNT(*) FROM `transactions` t WHERE 1=1";
	$countParams = [];
	if (!empty($dateFrom)) {
		$countSql .= " AND t.`created_at` >= ?";
		$countParams[] = $dateFrom . " 00:00:00";
	}
	if (!empty($dateTo)) {
		$countSql .= " AND t.`created_at` <= ?";
		$countParams[] = $dateTo . " 23:59:59";
	}
	if (!empty($userIdFilter)) {
		$placeholders = implode(",", array_fill(0, count($userIdFilter), "?"));
		$countSql .= " AND t.`user_id` IN (" . $placeholders . ")";
		$countParams = array_merge($countParams, $userIdFilter);
	}
	$stmtCount = $pdoStore->prepare($countSql);
	$stmtCount->execute($countParams);
	$total = (int)$stmtCount->fetchColumn();

	echo json_encode(["success" => true, "transactions" => $transactions, "total" => $total]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error loading transactions."]);
}
