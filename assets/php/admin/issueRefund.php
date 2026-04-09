<?php
/**
 * Issues a refund via PayPal API.
 * PayPal refunds are issued against a capture ID (not a payment intent).
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/Payments/PayPalApi.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

if (!hasAuthority("UserAdmin")) {
	echo json_encode(["success" => false, "message" => "Access denied."]);
	exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$captureId = $input["capture_id"] ?? $input["payment_intent"] ?? ""; // Accept both for backwards compat
$amount = $input["amount"] ?? null; // Optional: partial refund amount in cents

if (empty($captureId)) {
	echo json_encode(["success" => false, "message" => "Capture ID required."]);
	exit;
}

try {
	PayPalApi::init("development");

	// Build refund request
	$refundData = [];
	if ($amount !== null && intval($amount) > 0) {
		$amountStr = number_format(intval($amount) / 100, 2, ".", "");
		$refundData = [
			"amount" => [
				"value" => $amountStr,
				"currency_code" => "USD"
			]
		];
	}

	// POST /v2/payments/captures/{capture_id}/refund
	$result = PayPalApi::post("v2/payments/captures/" . $captureId . "/refund", $refundData);

	if (isset($result["_error"])) {
		$msg = $result["message"] ?? ($result["details"][0]["description"] ?? "Refund failed.");
		echo json_encode(["success" => false, "message" => $msg]);
		exit;
	}

	// Update transaction status in local DB
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("UPDATE `transactions` SET `status` = 'refunded' WHERE `paypal_capture_id` = ?");
	$stmt->execute([$captureId]);

	echo json_encode(["success" => true, "refund" => $result]);
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error processing refund."]);
}
