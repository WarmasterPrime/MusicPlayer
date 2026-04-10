<?php
/**
 * Session management helpers.
 */

if (session_status() === PHP_SESSION_NONE) {
	// Use an app-specific session save path to avoid permission conflicts
	// between WAMP Apache and PHP CLI server.
	$appSessionPath = realpath(__DIR__ . "/../..") . DIRECTORY_SEPARATOR . "sessions";
	if (!is_dir($appSessionPath)) {
		@mkdir($appSessionPath, 0777, true);
	}
	if (is_dir($appSessionPath) && is_writable($appSessionPath)) {
		session_save_path($appSessionPath);
	}

	session_set_cookie_params([
		"lifetime" => 86400 * 7, // 7 days
		"path" => "/",
		"httponly" => true,
		"samesite" => "Lax"
	]);

	session_start();
}

/**
 * Checks if a user is currently logged in.
 * @return bool
 */
function isLoggedIn(): bool {
	return isset($_SESSION["user_id"]) && is_string($_SESSION["user_id"]);
}

/**
 * Gets the current user's session data.
 * @return array|null
 */
function getCurrentUser(): ?array {
	if (!isLoggedIn()) return null;
	return [
		"id" => $_SESSION["user_id"],
		"username" => $_SESSION["username"] ?? "",
		"authority" => $_SESSION["authority"] ?? ""
	];
}

/**
 * Checks if the current user has a specific authority flag.
 * @param string $flag The authority flag to check (e.g. "StoreAdmin", "UserAdmin").
 * @return bool
 */
function hasAuthority(string $flag): bool {
	$user = getCurrentUser();
	if (!$user || empty($user["authority"])) return false;
	$flags = explode(",", $user["authority"]);
	return in_array($flag, $flags);
}

/**
 * Logs in a user by storing their data in the session.
 * @param array $user The user record from the database.
 */
function loginUser(array $user): void {
	$_SESSION["user_id"] = $user["id"];
	$_SESSION["username"] = $user["username"];
	$_SESSION["authority"] = $user["authority"] ?? "ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic";
}

/**
 * Logs out the current user by destroying the session.
 */
function logoutUser(): void {
	$_SESSION = [];
	if (ini_get("session.use_cookies")) {
		$params = session_get_cookie_params();
		setcookie(session_name(), "", time() - 42000,
			$params["path"], $params["domain"],
			$params["secure"], $params["httponly"]
		);
	}
	session_destroy();
}
