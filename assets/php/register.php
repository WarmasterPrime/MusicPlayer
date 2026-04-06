<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/parse.php";

header("Content-Type: application/json");

$username = null;
$password = null;
$email = null;
$firstName = null;
$lastName = null;

$input = json_decode(file_get_contents("php://input"), true);
if (isset($input["username"])) {
	$username = $input["username"];
	$password = $input["password"] ?? null;
	$email = $input["email"] ?? null;
	$firstName = $input["first_name"] ?? null;
	$lastName = $input["last_name"] ?? null;
} elseif (isset($_POST["username"])) {
	$username = parse($_POST["username"]);
	$password = $_POST["password"] ?? null;
	$email = isset($_POST["email"]) ? parse($_POST["email"]) : null;
	$firstName = isset($_POST["first_name"]) ? parse($_POST["first_name"]) : null;
	$lastName = isset($_POST["last_name"]) ? parse($_POST["last_name"]) : null;
}

if (!is_string($username) || !is_string($password) || strlen($username) === 0 || strlen($password) === 0) {
	echo json_encode(["success" => false, "message" => "Username and password are required."]);
	exit;
}
if (strlen($username) < 3) {
	echo json_encode(["success" => false, "message" => "Username must be at least 3 characters."]);
	exit;
}
if (strlen($password) < 6) {
	echo json_encode(["success" => false, "message" => "Password must be at least 6 characters."]);
	exit;
}

try {
	$pdo = Database::connect("accounts");

	// Check if username already exists
	$stmt = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE `username` = ?");
	$stmt->execute([$username]);
	if ((int)$stmt->fetchColumn() > 0) {
		echo json_encode(["success" => false, "message" => "Username already exists."]);
		exit;
	}

	// Check if email already exists (if provided)
	if (is_string($email) && strlen($email) > 0) {
		$stmt = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE `email` = ?");
		$stmt->execute([$email]);
		if ((int)$stmt->fetchColumn() > 0) {
			echo json_encode(["success" => false, "message" => "Email already registered."]);
			exit;
		}
	}

	$id = Database::generateUUID();
	$publicProfileId = Database::generateId(10);
	$passwordHash = password_hash($password, PASSWORD_BCRYPT);
	$defaultAuthority = "DbSelect,DbInsert,ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic";

	// email is NOT NULL in the schema; use empty string if not provided
	if (!is_string($email) || strlen($email) === 0) {
		$email = "";
	}

	$stmt = $pdo->prepare("
		INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `public_profile_id`, `authority`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	");
	$stmt->execute([
		$id,
		$username,
		$email,
		$passwordHash,
		$firstName,
		$lastName,
		$publicProfileId,
		$defaultAuthority
	]);

	$user = [
		"id" => $id,
		"username" => $username,
		"authority" => $defaultAuthority
	];
	loginUser($user);

	echo json_encode([
		"success" => true,
		"message" => "Registration successful.",
		"user" => $user
	]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
