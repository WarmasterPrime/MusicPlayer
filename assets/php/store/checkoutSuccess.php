<?php
/**
 * Handles the PayPal checkout success redirect.
 * For orders: captures the payment.
 * For subscriptions: verifies and syncs the subscription.
 * Then redirects to the app.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/PayPalCheckout.php";
require_once __DIR__ . "/../System/Payments/PayPalSubscription.php";
require_once __DIR__ . "/../System/Database.php";

// Determine the base URL for redirect
$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
	. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
// Navigate up from assets/php/store/ to the app root
$scriptDir = str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"]));
$basePath = dirname(dirname(dirname($scriptDir)));
if ($basePath === "/" || $basePath === "\\" || $basePath === ".") $basePath = "";
$appUrl = rtrim($baseUrl . $basePath, "/");

$mode = $_GET["mode"] ?? "";

if (!isLoggedIn()) {
	header("Location: " . $appUrl . "/index.html?checkout=error");
	exit;
}

try {
	$user = getCurrentUser();
	$pdo = Database::connect("store");

	if ($mode === "subscription") {
		// PayPal redirects with subscription_id and ba_token in the URL
		$subscriptionId = $_GET["subscription_id"] ?? "";

		if (strlen($subscriptionId) === 0) {
			header("Location: " . $appUrl . "/index.html?checkout=error");
			exit;
		}

		// Check if already processed
		$stmt = $pdo->prepare("SELECT COUNT(*) FROM `subscriptions` WHERE `paypal_subscription_id` = ?");
		$stmt->execute([$subscriptionId]);
		if ((int)$stmt->fetchColumn() > 0) {
			header("Location: " . $appUrl . "/index.html?checkout=success");
			exit;
		}

		// Fetch subscription details from PayPal
		$sub = PayPalSubscription::get($subscriptionId);
		if (isset($sub["_error"])) {
			error_log("PayPal subscription fetch failed: " . json_encode($sub));
			header("Location: " . $appUrl . "/index.html?checkout=error");
			exit;
		}

		// Sync subscription to local DB
		PayPalSubscription::syncToLocal($sub, $user["id"]);

		// Save payer ID to store.accounts if present
		$payerId = $sub["subscriber"]["payer_id"] ?? "";
		if (strlen($payerId) > 0) {
			$stmt = $pdo->prepare("SELECT COUNT(*) FROM `accounts` WHERE `user_id` = ?");
			$stmt->execute([$user["id"]]);
			if ((int)$stmt->fetchColumn() === 0) {
				$id = Database::generateId(255);
				$stmt = $pdo->prepare("INSERT INTO `accounts` (`id`, `user_id`, `paypal_payer_id`) VALUES (?, ?, ?)");
				$stmt->execute([$id, $user["id"], $payerId]);
			} else {
				$stmt = $pdo->prepare("UPDATE `accounts` SET `paypal_payer_id` = ? WHERE `user_id` = ?");
				$stmt->execute([$payerId, $user["id"]]);
			}
		}

		// Record transaction with tax
		$amountValue = $sub["billing_info"]["last_payment"]["amount"]["value"] ?? "0.00";
		$currency = $sub["billing_info"]["last_payment"]["amount"]["currency_code"] ?? "USD";
		$totalCents = (int)round((float)$amountValue * 100);

		// Calculate tax portion from active tax rate
		$stmtTax = $pdo->query("SELECT `percentage` FROM `tax_rates` WHERE `active` = 1 ORDER BY `created_at` ASC LIMIT 1");
		$taxRow = $stmtTax->fetch();
		$taxPct = $taxRow ? floatval($taxRow["percentage"]) : 0;
		// Back-calculate: total = subtotal + tax, so subtotal = total / (1 + pct/100)
		$subtotalCents = $taxPct > 0 ? (int)round($totalCents / (1 + $taxPct / 100)) : $totalCents;
		$taxCents = $totalCents - $subtotalCents;

		$txId = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `paypal_capture_id`, `amount_cents`, `tax_amount`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
		");
		$stmt->execute([$txId, $user["id"], $subscriptionId, $totalCents, $taxCents, strtolower($currency), "Subscription activated"]);

		header("Location: " . $appUrl . "/index.html?checkout=success");

	} else {
		// One-time payment: PayPal redirects with token (order ID) in the URL
		$token = $_GET["token"] ?? "";

		if (strlen($token) === 0) {
			header("Location: " . $appUrl . "/index.html?checkout=error");
			exit;
		}

		// Check if already processed
		$stmt = $pdo->prepare("SELECT COUNT(*) FROM `transactions` WHERE `paypal_order_id` = ?");
		$stmt->execute([$token]);
		if ((int)$stmt->fetchColumn() > 0) {
			header("Location: " . $appUrl . "/index.html?checkout=success");
			exit;
		}

		// Capture the order
		$capture = PayPalCheckout::captureOrder($token);
		if (isset($capture["error"])) {
			error_log("PayPal order capture failed: " . json_encode($capture));
			header("Location: " . $appUrl . "/index.html?checkout=error");
			exit;
		}

		// Extract payment details
		$captureData = $capture["purchase_units"][0]["payments"]["captures"][0] ?? [];
		$captureId = $captureData["id"] ?? "";
		$amountValue = $captureData["amount"]["value"] ?? "0.00";
		$currency = $captureData["amount"]["currency_code"] ?? "USD";
		$amountCents = (int)round((float)$amountValue * 100);

		// Save payer ID
		$payerId = $capture["payer"]["payer_id"] ?? "";
		if (strlen($payerId) > 0) {
			$stmt = $pdo->prepare("SELECT COUNT(*) FROM `accounts` WHERE `user_id` = ?");
			$stmt->execute([$user["id"]]);
			if ((int)$stmt->fetchColumn() === 0) {
				$accId = Database::generateId(255);
				$stmt = $pdo->prepare("INSERT INTO `accounts` (`id`, `user_id`, `paypal_payer_id`) VALUES (?, ?, ?)");
				$stmt->execute([$accId, $user["id"], $payerId]);
			} else {
				$stmt = $pdo->prepare("UPDATE `accounts` SET `paypal_payer_id` = ? WHERE `user_id` = ?");
				$stmt->execute([$payerId, $user["id"]]);
			}
		}

		// Record transaction with tax
		$stmtTax = $pdo->query("SELECT `percentage` FROM `tax_rates` WHERE `active` = 1 ORDER BY `created_at` ASC LIMIT 1");
		$taxRow = $stmtTax->fetch();
		$taxPct = $taxRow ? floatval($taxRow["percentage"]) : 0;
		$subtotalCents = $taxPct > 0 ? (int)round($amountCents / (1 + $taxPct / 100)) : $amountCents;
		$taxCents = $amountCents - $subtotalCents;

		$txId = Database::generateId(255);
		$stmt = $pdo->prepare("
			INSERT INTO `transactions` (`id`, `user_id`, `paypal_capture_id`, `paypal_order_id`, `amount_cents`, `tax_amount`, `currency`, `description`, `status`)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
		");
		$stmt->execute([$txId, $user["id"], $captureId, $token, $amountCents, $taxCents, strtolower($currency), "One-time payment"]);

		header("Location: " . $appUrl . "/index.html?checkout=success");
	}

} catch (Exception $e) {
	error_log("PayPal checkout error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
	header("Location: " . $appUrl . "/index.html?checkout=error");
}
