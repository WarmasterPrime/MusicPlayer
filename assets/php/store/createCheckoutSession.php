<?php
/**
 * Creates a Stripe Checkout Session for a given price.
 * Requires authentication. Creates or retrieves the Stripe customer for the user.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeCheckout.php";
require_once __DIR__ . "/../System/Payments/StripeCustomer.php";
require_once __DIR__ . "/../System/Database.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();
$input = json_decode(file_get_contents("php://input"), true);
$priceId = trim($input["price_id"] ?? "");
$mode = trim($input["mode"] ?? "subscription"); // "subscription" or "payment"

if (strlen($priceId) === 0) {
	echo json_encode(["success" => false, "message" => "Price ID is required."]);
	exit;
}

if ($mode !== "subscription" && $mode !== "payment") {
	$mode = "subscription";
}

try {
	// Get user email from accounts database
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("SELECT `email` FROM `users` WHERE `id` = ?");
	$stmt->execute([$user["id"]]);
	$email = $stmt->fetchColumn() ?: "";

	// Get or create Stripe customer
	$customerResult = StripeCustomer::getOrCreate($user["id"], $email, $user["username"] ?? "");
	if (isset($customerResult["error"])) {
		echo json_encode(["success" => false, "message" => $customerResult["error"]]);
		exit;
	}

	$stripeCustomerId = $customerResult["stripe_customer_id"];

	// Build success and cancel URLs
	$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
		. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
	$basePath = dirname(dirname(dirname($_SERVER["SCRIPT_NAME"])));
	$appUrl = rtrim($baseUrl . $basePath, "/");

	$successUrl = $appUrl . "/php/store/checkoutSuccess.php?session_id={CHECKOUT_SESSION_ID}";
	$cancelUrl = $appUrl . "/php/store/checkoutCancel.php";

	// Create checkout session
	$session = StripeCheckout::createSession(
		$stripeCustomerId,
		$priceId,
		$mode,
		$successUrl,
		$cancelUrl,
		["musicplayer_user_id" => $user["id"]]
	);

	if (isset($session["error"])) {
		echo json_encode(["success" => false, "message" => $session["error"]]);
		exit;
	}

	echo json_encode([
		"success" => true,
		"session_id" => $session["session_id"],
		"checkout_url" => $session["checkout_url"]
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating checkout session."]);
}
