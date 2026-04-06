<?php
/**
 * Handles the Stripe Checkout success redirect.
 * Verifies the session, records the transaction, and redirects to the app.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeCheckout.php";
require_once __DIR__ . "/../System/Payments/StripeSubscription.php";
require_once __DIR__ . "/../System/Payments/StripeCustomer.php";
require_once __DIR__ . "/../System/Database.php";

$sessionId = $_GET["session_id"] ?? "";

// Determine the base URL for redirect
$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
	. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
$basePath = dirname(dirname(dirname(dirname($_SERVER["SCRIPT_NAME"]))));
$appUrl = rtrim($baseUrl . $basePath, "/");

if (strlen($sessionId) === 0 || !isLoggedIn()) {
	header("Location: " . $appUrl . "/index.html?checkout=error");
	exit;
}

try {
	$user = getCurrentUser();

	// Verify the checkout session
	$session = StripeCheckout::getSession($sessionId);
	if (isset($session["_error"])) {
		header("Location: " . $appUrl . "/index.html?checkout=error");
		exit;
	}

	$pdo = Database::connect("store");

	// Check if this checkout was already recorded
	$stmt = $pdo->prepare("SELECT COUNT(*) FROM `transactions` WHERE `stripe_checkout_id` = ?");
	$stmt->execute([$sessionId]);
	if ((int)$stmt->fetchColumn() > 0) {
		// Already processed
		header("Location: " . $appUrl . "/index.html?checkout=success");
		exit;
	}

	// Record the transaction
	$id = Database::generateId(255);
	$amountTotal = $session["amount_total"] ?? 0;
	$currency = $session["currency"] ?? "usd";
	$paymentIntent = $session["payment_intent"] ?? null;

	$stmt = $pdo->prepare("
		INSERT INTO `transactions` (`id`, `user_id`, `stripe_payment_intent`, `stripe_checkout_id`, `amount_cents`, `currency`, `description`, `status`)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
	");
	$stmt->execute([$id, $user["id"], $paymentIntent, $sessionId, $amountTotal, $currency, "Checkout completed"]);

	// If subscription, sync it
	$mode = $session["mode"] ?? "";
	if ($mode === "subscription") {
		$subId = $session["subscription"] ?? null;
		if (is_array($subId)) {
			// Expanded subscription object
			StripeSubscription::syncToLocal($subId, $user["id"]);
		} elseif (is_string($subId) && strlen($subId) > 0) {
			$sub = StripeSubscription::get($subId);
			if (!isset($sub["_error"])) {
				StripeSubscription::syncToLocal($sub, $user["id"]);
			}
		}
	}

	header("Location: " . $appUrl . "/index.html?checkout=success");

} catch (Exception $e) {
	header("Location: " . $appUrl . "/index.html?checkout=error");
}
