<?php
/**
 * Creates a Stripe Customer Portal session for self-service billing management.
 * Requires authentication.
 */

require_once __DIR__ . "/../session.php";
require_once __DIR__ . "/../System/Payments/StripeApi.php";
require_once __DIR__ . "/../System/Payments/StripeCustomer.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
	echo json_encode(["success" => false, "message" => "Not logged in."]);
	exit;
}

$user = getCurrentUser();

try {
	$customerId = StripeCustomer::getCustomerId($user["id"]);
	if (!$customerId) {
		echo json_encode(["success" => false, "message" => "No billing account found."]);
		exit;
	}

	// Build return URL
	$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
		. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
	$basePath = dirname(dirname(dirname(dirname($_SERVER["SCRIPT_NAME"]))));
	$returnUrl = rtrim($baseUrl . $basePath, "/") . "/index.html";

	$result = StripeApi::post("billing_portal/sessions", [
		"customer" => $customerId,
		"return_url" => $returnUrl
	]);

	if (isset($result["_error"])) {
		$msg = $result["error"]["message"] ?? "Failed to create portal session.";
		echo json_encode(["success" => false, "message" => $msg]);
		exit;
	}

	echo json_encode([
		"success" => true,
		"portal_url" => $result["url"] ?? ""
	]);

} catch (Exception $e) {
	echo json_encode(["success" => false, "message" => "Error creating portal session."]);
}
