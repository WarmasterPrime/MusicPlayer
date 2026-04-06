<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/parse.php";

header("Content-Type: application/json");

$username = null;
$password = null;

$input = json_decode(file_get_contents("php://input"), true);
if (isset($input["username"])) {
	$username = $input["username"];
	$password = $input["password"] ?? null;
} elseif (isset($_POST["username"])) {
	$username = parse($_POST["username"]);
	$password = $_POST["password"] ?? null;
}

if (!is_string($username) || !is_string($password) || strlen($username) === 0 || strlen($password) === 0) {
	echo json_encode(["success" => false, "message" => "Username and password are required."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("SELECT `id`, `username`, `password_hash`, `authority` FROM `users` WHERE `username` = ? LIMIT 1");
	$stmt->execute([$username]);
	$user = $stmt->fetch();

	if (!$user) {
		echo json_encode(["success" => false, "message" => "User not found."]);
		exit;
	}

	$passwordHash = $user["password_hash"];
	$verified = false;

	// Try bcrypt verification first
	if (password_verify($password, $passwordHash)) {
		$verified = true;
		// Re-hash if bcrypt cost needs upgrading
		if (password_needs_rehash($passwordHash, PASSWORD_BCRYPT)) {
			$newHash = password_hash($password, PASSWORD_BCRYPT);
			$updateStmt = $pdo->prepare("UPDATE `users` SET `password_hash` = ? WHERE `id` = ?");
			$updateStmt->execute([$newHash, $user["id"]]);
		}
	}
	// Fallback: check legacy SHA-256 hash and migrate to bcrypt
	elseif (hash("sha256", $password) === $passwordHash) {
		$verified = true;
		$newHash = password_hash($password, PASSWORD_BCRYPT);
		$updateStmt = $pdo->prepare("UPDATE `users` SET `password_hash` = ? WHERE `id` = ?");
		$updateStmt->execute([$newHash, $user["id"]]);
	}

	if ($verified) {
		loginUser($user);
		echo json_encode([
			"success" => true,
			"message" => "Login successful.",
			"user" => [
				"id" => $user["id"],
				"username" => $user["username"],
				"authority" => $user["authority"]
			]
		]);
	} else {
		echo json_encode(["success" => false, "message" => "Invalid password."]);
	}

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
