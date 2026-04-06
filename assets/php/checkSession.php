<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

if (isLoggedIn()) {
	$user = getCurrentUser();

	// Refresh authority from database so new flags are picked up without re-login
	try {
		$pdo = Database::connect("accounts");
		$stmt = $pdo->prepare("SELECT `authority` FROM `users` WHERE `id` = ? LIMIT 1");
		$stmt->execute([$user["id"]]);
		$dbAuth = $stmt->fetchColumn();
		if (is_string($dbAuth) && strlen($dbAuth) > 0) {
			$user["authority"] = $dbAuth;
			$_SESSION["authority"] = $dbAuth;
		}
	} catch (PDOException $e) {}

	echo json_encode([
		"loggedIn" => true,
		"user" => $user
	]);
} else {
	echo json_encode([
		"loggedIn" => false,
		"user" => null
	]);
}
