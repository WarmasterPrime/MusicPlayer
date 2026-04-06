<?php
/**
 * Initiates Google OAuth flow for account linking (user already logged in).
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Auth/GoogleOAuth.php";

if (!isLoggedIn()) {
	header("Content-Type: application/json");
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

// Generate CSRF state token
$state = GoogleOAuth::generateState();
$_SESSION["oauth_state"] = $state;
$_SESSION["oauth_action"] = "link";

// Redirect to Google
$authUrl = GoogleOAuth::getAuthUrl($state);
header("Location: " . $authUrl);
exit;
