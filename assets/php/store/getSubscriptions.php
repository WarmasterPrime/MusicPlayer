<?php
/**
 * Returns the user's subscriptions from the local mirror table.
 * Requires authentication.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeSubscription.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$subscriptions = StripeSubscription::getAllForUser($user["id"]);

	echo json_encode(["success" => true, "subscriptions" => $subscriptions]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Failed to load subscriptions."]);
}
