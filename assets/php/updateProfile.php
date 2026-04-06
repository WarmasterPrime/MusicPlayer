<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/System/FeatureGate.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

// Handle both JSON and multipart form data (for profile picture upload)
$contentType = $_SERVER["CONTENT_TYPE"] ?? "";
if (str_contains($contentType, "multipart/form-data")) {
	$input = $_POST;
	$hasProfilePic = isset($_FILES["profile_picture"]) && $_FILES["profile_picture"]["error"] === UPLOAD_ERR_OK;
	$hasBgPic = isset($_FILES["background"]) && $_FILES["background"]["error"] === UPLOAD_ERR_OK;
} else {
	$input = json_decode(file_get_contents("php://input"), true) ?? [];
	$hasProfilePic = false;
	$hasBgPic = false;
}

try {
	$pdo = Database::connect("accounts");

	// Ensure required columns exist
	$ensureCols = [
		"background" => "LONGBLOB NULL",
		"user_description" => "TEXT NULL",
		"dob" => "DATE NULL"
	];
	$existingCols = [];
	$colStmt = $pdo->query("SHOW COLUMNS FROM `users`");
	while ($col = $colStmt->fetch()) {
		$existingCols[] = $col["Field"];
	}
	foreach ($ensureCols as $colName => $colDef) {
		if (!in_array($colName, $existingCols, true)) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `$colName` $colDef");
		}
	}

	$fields = [];
	$values = [];

	// Map form field names to actual database column names
	$fieldMap = [
		"first_name" => "first_name",
		"last_name" => "last_name",
		"email" => "email",
		"phone" => "phone",
		"country" => "country",
		"region" => "state_region",
		"language" => "language",
		"description" => "user_description",
		"dob" => "dob"
	];
	$allowedFields = array_keys($fieldMap);

	foreach ($allowedFields as $field) {
		if (isset($input[$field])) {
			$val = trim($input[$field]);
			$dbCol = $fieldMap[$field];
			// Convert empty strings to NULL for date columns
			if ($field === "dob" && $val === "") {
				$val = null;
			}
			// Skip empty optional fields that would violate constraints
			if ($val === "" && in_array($field, ["email"], true)) {
				continue;
			}
			$fields[] = "`$dbCol` = ?";
			$values[] = $val;
		}
	}

	// Handle password update
	$newPassword = $input["new_password"] ?? "";
	$confirmPassword = $input["confirm_password"] ?? "";
	if (strlen($newPassword) > 0) {
		if ($newPassword !== $confirmPassword) {
			echo json_encode(["success" => false, "message" => "Passwords do not match."]);
			exit;
		}
		if (strlen($newPassword) < 6) {
			echo json_encode(["success" => false, "message" => "Password must be at least 6 characters."]);
			exit;
		}
		$fields[] = "`password_hash` = ?";
		$values[] = password_hash($newPassword, PASSWORD_BCRYPT);
	}

	// Handle profile picture
	if ($hasProfilePic) {
		$picFile = $_FILES["profile_picture"];
		$allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
		$finfo = finfo_open(FILEINFO_MIME_TYPE);
		$picMime = finfo_file($finfo, $picFile["tmp_name"]);
		finfo_close($finfo);

		if (!in_array($picMime, $allowedMimes, true)) {
			echo json_encode(["success" => false, "message" => "Invalid image type."]);
			exit;
		}

		$maxSize = 1 * 1024 * 1024 * 1024; // 1GB
		if ($picFile["size"] > $maxSize) {
			echo json_encode(["success" => false, "message" => "Image too large (max 1GB)."]);
			exit;
		}

		$fields[] = "`profile_picture` = ?";
		$values[] = file_get_contents($picFile["tmp_name"]);
	}
	
	if($hasBgPic) {
		$gate = FeatureGate::check($user["id"], "custom_backgrounds");
		if (!$gate["allowed"]) {
			echo json_encode(["success" => false, "message" => $gate["message"], "feature_gated" => true]);
			exit;
		}
		$bgFile = $_FILES["background"];
		$allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
		$finfo = finfo_open(FILEINFO_MIME_TYPE);
		$bgMime = finfo_file($finfo, $bgFile["tmp_name"]);
		finfo_close($finfo);

		if (!in_array($bgMime, $allowedMimes, true)) {
			echo json_encode(["success" => false, "message" => "Invalid background image type."]);
			exit;
		}

		$maxSize = 1 * 1024 * 1024 * 1024; // 1GB
		if ($bgFile["size"] > $maxSize) {
			echo json_encode(["success" => false, "message" => "Background image too large (max 1GB)."]);
			exit;
		}
		$fields[] = "`background` = ?";
		$values[] = file_get_contents($bgFile["tmp_name"]);
	}

	if (count($fields) === 0) {
		echo json_encode(["success" => false, "message" => "No fields to update."]);
		exit;
	}

	$values[] = $user["id"];
	$sql = "UPDATE `users` SET " . implode(", ", $fields) . " WHERE `id` = ?";
	$stmt = $pdo->prepare($sql);
	$stmt->execute($values);

	echo json_encode(["success" => true, "message" => "Profile updated."]);

} catch (PDOException $e) {
	echo json_encode(["success" => false, "message" => "Database error."]);
}
