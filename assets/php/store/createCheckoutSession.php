<?php
/**
 * Creates a PayPal checkout session (order or subscription) for a given price.
 * Requires authentication. Applies active tax rate to the total.
 *
 * For subscriptions: creates a PayPal subscription using the billing plan.
 *   (Tax is noted in the response but applied at transaction recording time,
 *    since PayPal billing plans have fixed pricing.)
 * For one-time payments: creates a PayPal order with tax included in the total.
 *
 * Returns an approval_url for redirect to PayPal.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/PayPalCheckout.php";
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
$couponCode = trim($input["coupon_code"] ?? "");

if (strlen($priceId) === 0) {
	echo json_encode(["success" => false, "message" => "Price ID is required."]);
	exit;
}

if ($mode !== "subscription" && $mode !== "payment") {
	$mode = "subscription";
}

try {
	// Look up the price in local DB
	$pdo = Database::connect("store");
	$stmt = $pdo->prepare("SELECT p.*, pr.`name` AS `product_name`, pr.`description` AS `product_description` FROM `prices` p JOIN `products` pr ON p.`product_id` = pr.`id` WHERE p.`id` = ? AND p.`active` = 1");
	$stmt->execute([$priceId]);
	$price = $stmt->fetch();

	if (!$price) {
		echo json_encode(["success" => false, "message" => "Price not found or inactive."]);
		exit;
	}

	// Load active tax rate
	$stmt = $pdo->query("SELECT * FROM `tax_rates` WHERE `active` = 1 ORDER BY `created_at` ASC LIMIT 1");
	$taxRate = $stmt->fetch();
	$taxPercentage = $taxRate ? floatval($taxRate["percentage"]) : 0;
	$subtotalCents = (int)$price["unit_amount"];

	// Apply coupon discount if provided
	$couponDiscount = 0;
	$couponInfo = null;
	if (strlen($couponCode) > 0) {
		$stmtCoupon = $pdo->prepare("SELECT * FROM `coupons` WHERE `name` = ? AND `active` = 1 LIMIT 1");
		$stmtCoupon->execute([$couponCode]);
		$coupon = $stmtCoupon->fetch();

		if ($coupon) {
			// Check max redemptions
			if ($coupon["max_redemptions"] === null || (int)$coupon["times_redeemed"] < (int)$coupon["max_redemptions"]) {
				if ($coupon["percent_off"] !== null) {
					$couponDiscount = (int)round($subtotalCents * floatval($coupon["percent_off"]) / 100);
				} elseif ($coupon["amount_off"] !== null) {
					$couponDiscount = min((int)$coupon["amount_off"], $subtotalCents);
				}
				$couponInfo = [
					"id" => $coupon["id"],
					"name" => $coupon["name"],
					"percent_off" => $coupon["percent_off"] !== null ? floatval($coupon["percent_off"]) : null,
					"amount_off" => $coupon["amount_off"] !== null ? (int)$coupon["amount_off"] : null,
					"discount" => $couponDiscount
				];

				// Increment redemption count
				$stmtRedeem = $pdo->prepare("UPDATE `coupons` SET `times_redeemed` = `times_redeemed` + 1 WHERE `id` = ?");
				$stmtRedeem->execute([$coupon["id"]]);
			}
		}
	}

	$discountedSubtotal = $subtotalCents - $couponDiscount;
	if ($discountedSubtotal < 0) $discountedSubtotal = 0;
	$taxCents = (int)round($discountedSubtotal * $taxPercentage / 100);
	$totalCents = $discountedSubtotal + $taxCents;

	// Get user email
	$pdoAccounts = Database::connect("accounts");
	$stmt = $pdoAccounts->prepare("SELECT `email` FROM `users` WHERE `id` = ?");
	$stmt->execute([$user["id"]]);
	$email = $stmt->fetchColumn() ?: "";

	// Build return/cancel URLs
	$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
		. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
	$basePath = dirname(dirname(dirname($_SERVER["SCRIPT_NAME"])));
	$appUrl = rtrim($baseUrl . $basePath, "/");

	if ($mode === "subscription" && !empty($price["paypal_plan_id"])) {
		// Create PayPal subscription
		// Note: PayPal billing plans have fixed pricing, so tax is recorded at
		// transaction time rather than embedded in the plan.
		$successUrl = $appUrl . "/php/store/checkoutSuccess.php?mode=subscription";
		$cancelUrl = $appUrl . "/php/store/checkoutCancel.php";

		$result = PayPalCheckout::createSubscription(
			$price["paypal_plan_id"],
			$successUrl,
			$cancelUrl,
			$email
		);

		if (isset($result["error"])) {
			echo json_encode(["success" => false, "message" => $result["error"]]);
			exit;
		}

		$response = [
			"success" => true,
			"mode" => "subscription",
			"subscription_id" => $result["subscription_id"],
			"approval_url" => $result["approval_url"],
			"subtotal" => $subtotalCents,
			"discount" => $couponDiscount,
			"tax" => $taxCents,
			"tax_percentage" => $taxPercentage,
			"total" => $totalCents
		];
		if ($couponInfo) $response["coupon"] = $couponInfo;
		echo json_encode($response);
	} else {
		// Create PayPal order (one-time payment) with tax included
		$successUrl = $appUrl . "/php/store/checkoutSuccess.php?mode=payment";
		$cancelUrl = $appUrl . "/php/store/checkoutCancel.php";

		$result = PayPalCheckout::createOrder(
			$totalCents,
			$price["currency"],
			$price["product_name"] ?? "MusicPlayer Purchase",
			$successUrl,
			$cancelUrl
		);

		if (isset($result["error"])) {
			echo json_encode(["success" => false, "message" => $result["error"]]);
			exit;
		}

		$response = [
			"success" => true,
			"mode" => "payment",
			"order_id" => $result["order_id"],
			"approval_url" => $result["approval_url"],
			"subtotal" => $subtotalCents,
			"discount" => $couponDiscount,
			"tax" => $taxCents,
			"tax_percentage" => $taxPercentage,
			"total" => $totalCents
		];
		if ($couponInfo) $response["coupon"] = $couponInfo;
		echo json_encode($response);
	}

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating checkout session."]);
}
