<?php
/**
 * Returns a link to manage the user's PayPal subscription.
 * PayPal doesn't have a customer portal like Stripe, so this returns
 * a direct link to manage subscriptions on PayPal.
 * Requires authentication.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/PayPalSubscription.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$activeSub = PayPalSubscription::getActiveForUser($user["id"]);

	if (!$activeSub) {
		echo json_encode(["success" => false, "message" => "No active subscription found."]);
		exit;
	}

	// PayPal sandbox subscription management URL
	$paypalSubId = $activeSub["paypal_subscription_id"];
	$portalUrl = "https://www.sandbox.paypal.com/myaccount/autopay/connect/" . $paypalSubId;

	echo json_encode([
		"success" => true,
		"portal_url" => $portalUrl
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating portal session."]);
}
