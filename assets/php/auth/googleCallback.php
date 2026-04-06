<?php
/**
 * Google OAuth callback handler.
 * Exchanges code for tokens, resolves account (link/create/login), redirects to app.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Auth/GoogleOAuth.php";
require_once __DIR__ . "/../System/Database.php";

// Determine app URL for redirects
$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
	. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
$basePath = dirname(dirname(dirname($_SERVER["SCRIPT_NAME"])));
$appUrl = rtrim($baseUrl . $basePath, "/");
$appUrl = "https://doft.ddns.net/Musicplayer";

// Verify state
$state = $_GET["state"] ?? "";
$expectedState = $_SESSION["oauth_state"] ?? "";
$action = $_SESSION["oauth_action"] ?? "login";

if (strlen($state) === 0 || $state !== $expectedState) {
	header("Location: " . $appUrl . "?auth=google&status=error&reason=invalid_state");
	exit;
}

// Clear used state
unset($_SESSION["oauth_state"]);
unset($_SESSION["oauth_action"]);

// Check for error from Google
if (isset($_GET["error"])) {
	header("Location: " . $appUrl . "?auth=google&status=error&reason=" . urlencode($_GET["error"]));
	exit;
}

// Exchange code for tokens
$code = $_GET["code"] ?? "";
if (strlen($code) === 0) {
	header("Location: " . $appUrl . "?auth=google&status=error&reason=no_code");
	exit;
}

try {
	$tokens = GoogleOAuth::exchangeCode($code);
	if (isset($tokens["error"])) {
		header("Location: " . $appUrl . "?auth=google&status=error&reason=token_exchange");
		exit;
	}

	$accessToken = $tokens["access_token"] ?? "";
	$refreshToken = $tokens["refresh_token"] ?? null;

	// Get user info from Google
	$googleUser = GoogleOAuth::getUserInfo($accessToken);
	if (isset($googleUser["error"])) {
		header("Location: " . $appUrl . "?auth=google&status=error&reason=userinfo");
		exit;
	}

	$googleId = $googleUser["id"] ?? "";
	$googleEmail = $googleUser["email"] ?? "";
	$googleName = $googleUser["name"] ?? "";
	$givenName = $googleUser["given_name"] ?? "";
	$familyName = $googleUser["family_name"] ?? "";

	if (strlen($googleId) === 0) {
		header("Location: " . $appUrl . "?auth=google&status=error&reason=no_google_id");
		exit;
	}

	// Account linking: link to currently logged-in user
	if ($action === "link" && isLoggedIn()) {
		$currentUser = getCurrentUser();
		$storePdo = Database::connect("store");

		// Check if this Google account is already linked to someone else
		$stmt = $storePdo->prepare("SELECT `user_id` FROM `link_platforms` WHERE `platform` = 'google' AND `platform_user_id` = ?");
		$stmt->execute([$googleId]);
		$existingLink = $stmt->fetch();

		if ($existingLink && $existingLink["user_id"] !== $currentUser["id"]) {
			header("Location: " . $appUrl . "?auth=google&status=error&reason=already_linked");
			exit;
		}

		// Create link
		if (!$existingLink) {
			$linkId = Database::generateId(255);
			$stmt = $storePdo->prepare("
				INSERT INTO `link_platforms` (`id`, `user_id`, `platform`, `platform_user_id`, `platform_email`, `access_token`, `refresh_token`)
				VALUES (?, ?, 'google', ?, ?, ?, ?)
			");
			$stmt->execute([$linkId, $currentUser["id"], $googleId, $googleEmail, $accessToken, $refreshToken]);
		}

		header("Location: " . $appUrl . "?linked=google");
		exit;
	}

	// Account resolution for login
	$storePdo = Database::connect("store");
	$accountsPdo = Database::connect("accounts");

	// 1. Check existing link in store.link_platforms
	$stmt = $storePdo->prepare("SELECT `user_id` FROM `link_platforms` WHERE `platform` = 'google' AND `platform_user_id` = ?");
	$stmt->execute([$googleId]);
	$link = $stmt->fetch();

	if ($link) {
		// User already linked — log them in
		$userId = $link["user_id"];
		$stmt = $accountsPdo->prepare("SELECT `id`, `username`, `authority` FROM `users` WHERE `id` = ?");
		$stmt->execute([$userId]);
		$user = $stmt->fetch();

		if ($user) {
			// Update tokens
			$stmt = $storePdo->prepare("UPDATE `link_platforms` SET `access_token` = ?, `refresh_token` = ? WHERE `platform` = 'google' AND `platform_user_id` = ?");
			$stmt->execute([$accessToken, $refreshToken, $googleId]);

			loginUser($user);
			header("Location: " . $appUrl . "?auth=google&status=success");
			exit;
		}
	}

	// 2. Check by email in accounts.users
	if (strlen($googleEmail) > 0) {
		$stmt = $accountsPdo->prepare("SELECT `id`, `username`, `authority` FROM `users` WHERE `email` = ?");
		$stmt->execute([$googleEmail]);
		$user = $stmt->fetch();

		if ($user) {
			// Link and login
			$linkId = Database::generateId(255);
			$stmt = $storePdo->prepare("
				INSERT INTO `link_platforms` (`id`, `user_id`, `platform`, `platform_user_id`, `platform_email`, `access_token`, `refresh_token`)
				VALUES (?, ?, 'google', ?, ?, ?, ?)
			");
			$stmt->execute([$linkId, $user["id"], $googleId, $googleEmail, $accessToken, $refreshToken]);

			loginUser($user);
			header("Location: " . $appUrl . "?auth=google&status=success");
			exit;
		}
	}

	// 3. Auto-register new user
	$userId = Database::generateUUID();
	$publicProfileId = Database::generateId(10);

	// Generate username from Google name or email
	$username = "";
	if (strlen($givenName) > 0) {
		$username = strtolower(preg_replace("/[^a-zA-Z0-9]/", "", $givenName));
	}
	if (strlen($username) < 3 && strlen($googleEmail) > 0) {
		$username = strtolower(explode("@", $googleEmail)[0]);
		$username = preg_replace("/[^a-zA-Z0-9]/", "", $username);
	}
	if (strlen($username) < 3) {
		$username = "user" . substr(md5($googleId), 0, 6);
	}

	// Ensure username uniqueness
	$originalUsername = $username;
	$suffix = 1;
	while (true) {
		$stmt = $accountsPdo->prepare("SELECT COUNT(*) FROM `users` WHERE `username` = ?");
		$stmt->execute([$username]);
		if ((int)$stmt->fetchColumn() === 0) break;
		$username = $originalUsername . $suffix;
		$suffix++;
	}

	// Random password hash (user authenticates via Google only)
	$passwordHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT);
	$defaultAuthority = "DbSelect,DbInsert,ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic";

	$stmt = $accountsPdo->prepare("
		INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `authority`, `first_name`, `last_name`, `public_profile_id`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	");
	$stmt->execute([$userId, $username, $googleEmail, $passwordHash, $defaultAuthority, $givenName, $familyName, $publicProfileId]);

	// Create platform link
	$linkId = Database::generateId(255);
	$stmt = $storePdo->prepare("
		INSERT INTO `link_platforms` (`id`, `user_id`, `platform`, `platform_user_id`, `platform_email`, `access_token`, `refresh_token`)
		VALUES (?, ?, 'google', ?, ?, ?, ?)
	");
	$stmt->execute([$linkId, $userId, $googleId, $googleEmail, $accessToken, $refreshToken]);

	// Log in the new user
	$newUser = [
		"id" => $userId,
		"username" => $username,
		"authority" => $defaultAuthority
	];
	loginUser($newUser);

	header("Location: " . $appUrl . "?auth=google&status=success");

} catch (Exception $e) {
	header("Location: " . $appUrl . "?auth=google&status=error&reason=exception");
}
