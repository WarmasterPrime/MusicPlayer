<?php
/**
 * Issues a refund via Stripe API.
 * Requires UserAdmin authority.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Database.php";
require_once __DIR__ . "/../System/Payments/StripeApi.php";

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
$paymentIntent = $input["payment_intent"] ?? "";
$amount = $input["amount"] ?? null; // Optional: partial refund amount in cents

if (empty($paymentIntent)) {
	echo json_encode(["success" => false, "message" => "Payment intent ID required."]);
	exit;
}

try {
	StripeApi::init("development");

	$data = ["payment_intent" => $paymentIntent];
	if ($amount !== null && intval($amount) > 0) {
		$data["amount"] = intval($amount);
	}

	$result = StripeApi::post("refunds", $data);

	if (isset($result["id"])) {
		// Update transaction status
		$pdo = Database::connect("store");
		$stmt = $pdo->prepare("UPDATE `transactions` SET `status` = 'refunded' WHERE `stripe_payment_intent` = ?");
		$stmt->execute([$paymentIntent]);

		echo json_encode(["success" => true, "refund" => $result]);
	} else {
		echo json_encode(["success" => false, "message" => $result["_error"] ?? "Refund failed."]);
	}
} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error processing refund."]);
}
