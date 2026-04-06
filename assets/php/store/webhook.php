<?php
/**
 * Stripe webhook endpoint.
 * Receives events from Stripe, verifies the signature, and processes them.
 *
 * The webhook signing secret should be stored in stripe.ini as webhook_secret.
 */

require_once __DIR__ . "/../System/Payments/StripeApi.php";
require_once __DIR__ . "/../System/Payments/StripeWebhook.php";
require_once __DIR__ . "/../System/Payments/Stripe.php";

header("Content-Type: application/json");

// Read raw payload
$payload = file_get_contents("php://input");
$sigHeader = $_SERVER["HTTP_STRIPE_SIGNATURE"] ?? "";

if (strlen($payload) === 0 || strlen($sigHeader) === 0) {
	http_response_code(400);
	echo json_encode(["error" => "Missing payload or signature."]);
	exit;
}

// Load webhook secret
$keys = Stripe::loadKeys();
$webhookSecret = $keys["webhook"]["secret"] ?? $keys["development"]["webhook_secret"] ?? "";

if (strlen($webhookSecret) === 0) {
	// If no webhook secret configured, skip verification (development only)
	$event = json_decode($payload, true);
} else {
	// Verify signature
	$event = StripeApi::verifyWebhookSignature($payload, $sigHeader, $webhookSecret);
}

if ($event === null) {
	http_response_code(400);
	echo json_encode(["error" => "Invalid signature."]);
	exit;
}

// Process the event
try {
	$result = StripeWebhook::process($event);
	http_response_code(200);
	echo json_encode($result);
} catch (Exception $e) {
	http_response_code(500);
	echo json_encode(["error" => "Webhook processing error."]);
}
