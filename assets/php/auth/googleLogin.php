<?php
/**
 * Initiates Google OAuth login flow.
 * Generates state token, stores in session, redirects to Google.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Auth/GoogleOAuth.php";

// Generate CSRF state token
$state = GoogleOAuth::generateState();
$_SESSION["oauth_state"] = $state;
$_SESSION["oauth_action"] = "login";

// Redirect to Google
$authUrl = GoogleOAuth::getAuthUrl($state);
header("Location: " . $authUrl);
exit;
