<?php
/**
 * PayPal webhook endpoint.
 * Receives events from PayPal, verifies the signature, and processes them.
 *
 * The webhook ID should be stored in paypal.ini as webhook_id.
 */

require_once __DIR__ . "/../System/Payments/PayPalApi.php";
require_once __DIR__ . "/../System/Payments/PayPalWebhook.php";
require_once __DIR__ . "/../System/Payments/PayPal.php";

header("Content-Type: application/json");

// Read raw payload
$payload = file_get_contents("php://input");

if (strlen($payload) === 0) {
	http_response_code(400);
	echo json_encode(["error" => "Missing payload."]);
	exit;
}

// Collect all PayPal webhook headers
$headers = [];
foreach ($_SERVER as $key => $value) {
	if (strpos($key, "HTTP_PAYPAL_") === 0) {
		// Convert HTTP_PAYPAL_AUTH_ALGO to PAYPAL-AUTH-ALGO
		$headerName = str_replace("_", "-", substr($key, 5));
		$headers[$headerName] = $value;
	}
}

// Load webhook ID from config
$keys = PayPal::loadKeys();
$webhookId = $keys["development"]["webhook_id"] ?? $keys["webhook"]["id"] ?? "";

if (strlen($webhookId) > 0 && !empty($headers)) {
	// Verify signature
	PayPalApi::init("development");
	$valid = PayPalWebhook::verify($headers, $payload, $webhookId);
	if (!$valid) {
		http_response_code(400);
		echo json_encode(["error" => "Invalid signature."]);
		exit;
	}
} else {
	// Development mode: skip verification if no webhook ID configured
}

$event = json_decode($payload, true);
if ($event === null) {
	http_response_code(400);
	echo json_encode(["error" => "Invalid JSON payload."]);
	exit;
}

// Process the event
try {
	PayPalApi::init("development");
	$result = PayPalWebhook::process($event);
	http_response_code(200);
	echo json_encode($result);
} catch (Exception $e) {
	http_response_code(500);
	echo json_encode(["error" => "Webhook processing error."]);
}
