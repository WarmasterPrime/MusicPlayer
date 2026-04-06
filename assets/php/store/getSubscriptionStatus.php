<?php
/**
 * Returns the user's subscription tier and feature entitlements.
 * This is the primary endpoint for feature gating on the client.
 * Requires authentication.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/FeatureGate.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$tier = FeatureGate::getUserTier($user["id"]);
	$features = FeatureGate::getAllFeatures($user["id"]);

	echo json_encode([
		"success" => true,
		"tier" => $tier,
		"features" => $features
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error checking subscription status."]);
}
