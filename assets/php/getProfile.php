<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$pdo = Database::connect("accounts");
	//$stmt = $pdo->prepare("
	//	SELECT `username`, `email`, `phone`, `first_name`, `last_name`, `dob`,
	//	       `country`, `state_region`, `language`, `user_description`, `authority`,
	//	    CASE WHEN `profile_picture` IS NOT NULL AND LENGTH(`profile_picture`) > 0 THEN 1 ELSE 0 END AS `has_picture`,
	//		CASE WHEN `profile_background` IS NOT NULL AND LENGTH(`profile_background`) > 0 THEN 1 ELSE 0 END AS `has_background`
	//	FROM `users` WHERE `id` = ? LIMIT 1
	//");
	$stmt = $pdo->prepare("
		SELECT `username`, `email`, `phone`, `first_name`, `last_name`, `dob`,
		       `country`, `state_region`, `language`, `user_description`, `authority`,
		       CASE WHEN `profile_picture` IS NOT NULL AND LENGTH(`profile_picture`) > 0 THEN 1 ELSE 0 END AS `has_picture`,
		       CASE WHEN `background` IS NOT NULL AND LENGTH(`background`) > 0 THEN 1 ELSE 0 END AS `has_background`
		FROM `users`
		WHERE `id` = ?
		LIMIT 1
	");
	$stmt->execute([$user["id"]]);
	$profile = $stmt->fetch();

	if (!$profile) {
		echo json_encode(["success" => false, "message" => "User not found."]);
		exit;
	}

	echo json_encode([
		"success" => true,
		"profile" => [
			"username" => $profile["username"],
			"email" => $profile["email"] ?? "",
			"phone" => $profile["phone"] ?? "",
			"first_name" => $profile["first_name"] ?? "",
			"last_name" => $profile["last_name"] ?? "",
			"dob" => $profile["dob"] ?? "",
			"country" => $profile["country"] ?? "",
			"region" => $profile["state_region"] ?? "",
			"language" => $profile["language"] ?? "",
			"description" => $profile["user_description"] ?? "",
			"authority" => $profile["authority"] ?? "",
			"has_picture" => (int)($profile["has_picture"] ?? 0) === 1,
			"has_bg" => (int)($profile["has_background"] ?? 0) === 1,
		]
	]);
} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
