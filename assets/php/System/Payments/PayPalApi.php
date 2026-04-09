<?php
/**
 * cURL-based wrapper for the PayPal REST API.
 * No external libraries required — uses PHP cURL directly.
 *
 * PayPal API uses JSON for POST/PATCH bodies and OAuth2 Bearer tokens.
 * All methods return decoded JSON as associative arrays.
 */

require_once __DIR__ . "/PayPal.php";

class PayPalApi {

	private static ?string $clientId = null;
	private static ?string $clientSecret = null;
	private static string $env = "development";
	private static string $baseUrl = "https://api-m.sandbox.paypal.com";

	/** @var string|null Cached OAuth2 access token. */
	private static ?string $accessToken = null;

	/** @var int Token expiry timestamp (Unix). */
	private static int $tokenExpiry = 0;

	/**
	 * Initializes the API keys from paypal.ini.
	 * @param string $env "development" or "production"
	 */
	public static function init(string $env = "development"): void {
		$keys = PayPal::loadKeys();
		if (!isset($keys[$env])) {
			throw new Exception("PayPal environment '$env' not found in paypal.ini.");
		}
		self::$clientId = $keys[$env]["public_key"];
		self::$clientSecret = $keys[$env]["private_key"];
		self::$env = $env;

		// Set base URL based on environment
		if ($env === "production") {
			self::$baseUrl = "https://api-m.paypal.com";
		} else {
			self::$baseUrl = "https://api-m.sandbox.paypal.com";
		}

		// Reset cached token when reinitializing
		self::$accessToken = null;
		self::$tokenExpiry = 0;
	}

	/**
	 * Returns the client ID (public key) for client-side use.
	 * @return string
	 */
	public static function getClientId(): string {
		if (self::$clientId === null) self::init();
		return self::$clientId;
	}

	/**
	 * Returns the client secret (for internal use only).
	 * @return string
	 */
	private static function getClientSecret(): string {
		if (self::$clientSecret === null) self::init();
		return self::$clientSecret;
	}

	/**
	 * Obtains an OAuth2 access token from PayPal.
	 * Caches the token and reuses it until it expires (with 60s buffer).
	 *
	 * POST /v1/oauth2/token with Basic auth (client_id:client_secret).
	 *
	 * @return string The Bearer access token.
	 * @throws Exception If token retrieval fails.
	 */
	public static function getAccessToken(): string {
		// Return cached token if still valid (60s buffer before expiry)
		if (self::$accessToken !== null && time() < (self::$tokenExpiry - 60)) {
			return self::$accessToken;
		}

		if (self::$clientId === null) self::init();

		$url = self::$baseUrl . "/v1/oauth2/token";

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, "grant_type=client_credentials");
		curl_setopt($ch, CURLOPT_USERPWD, self::$clientId . ":" . self::$clientSecret);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			"Accept: application/json",
			"Accept-Language: en_US",
			"Content-Type: application/x-www-form-urlencoded"
		]);
		curl_setopt($ch, CURLOPT_TIMEOUT, 30);

		// Disable SSL verification for development (WAMP lacks CA bundle)
		if (self::$env === "development") {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
			curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
		} else {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
		}

		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		$curlError = curl_error($ch);
		curl_close($ch);

		if ($response === false) {
			throw new Exception("PayPal OAuth2 token request failed: " . $curlError);
		}

		$decoded = json_decode($response, true);
		if ($decoded === null || $httpCode >= 400) {
			$msg = $decoded["error_description"] ?? $decoded["error"] ?? "Unknown error";
			throw new Exception("PayPal OAuth2 token request failed (HTTP $httpCode): $msg");
		}

		if (!isset($decoded["access_token"])) {
			throw new Exception("PayPal OAuth2 response missing access_token.");
		}

		self::$accessToken = $decoded["access_token"];
		self::$tokenExpiry = time() + (int)($decoded["expires_in"] ?? 3600);

		return self::$accessToken;
	}

	/**
	 * Performs a GET request to the PayPal API.
	 * @param string $endpoint e.g. "v2/checkout/orders/ORDER_ID"
	 * @param array $params Query parameters.
	 * @return array Decoded JSON response.
	 */
	public static function get(string $endpoint, array $params = []): array {
		$url = self::$baseUrl . "/" . ltrim($endpoint, "/");
		if (!empty($params)) {
			$url .= "?" . http_build_query($params);
		}
		return self::request("GET", $url);
	}

	/**
	 * Performs a POST request to the PayPal API.
	 * @param string $endpoint e.g. "v2/checkout/orders"
	 * @param array $data JSON body data.
	 * @return array Decoded JSON response.
	 */
	public static function post(string $endpoint, array $data = []): array {
		$url = self::$baseUrl . "/" . ltrim($endpoint, "/");
		return self::request("POST", $url, $data);
	}

	/**
	 * Performs a PATCH request to the PayPal API.
	 * PayPal uses PATCH (not POST) for resource updates.
	 * @param string $endpoint e.g. "v1/catalogs/products/PROD_ID"
	 * @param array $data JSON patch operations array.
	 * @return array Decoded JSON response.
	 */
	public static function patch(string $endpoint, array $data = []): array {
		$url = self::$baseUrl . "/" . ltrim($endpoint, "/");
		return self::request("PATCH", $url, $data);
	}

	/**
	 * Performs a DELETE request to the PayPal API.
	 * @param string $endpoint e.g. "v1/billing/plans/PLAN_ID"
	 * @return array Decoded JSON response.
	 */
	public static function delete(string $endpoint): array {
		$url = self::$baseUrl . "/" . ltrim($endpoint, "/");
		return self::request("DELETE", $url);
	}

	/**
	 * Core cURL request method.
	 * Sets Content-Type: application/json for POST/PATCH.
	 * Uses Bearer token authentication.
	 *
	 * @param string $method GET, POST, PATCH, or DELETE.
	 * @param string $url Full URL.
	 * @param array $data Request body data (ignored for GET/DELETE).
	 * @return array Decoded JSON with optional _error and _http_code fields.
	 */
	private static function request(string $method, string $url, array $data = []): array {
		$token = self::getAccessToken();

		$headers = [
			"Authorization: Bearer " . $token,
			"Accept: application/json"
		];

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_TIMEOUT, 30);

		// Disable SSL verification for development (WAMP lacks CA bundle)
		if (self::$env === "development") {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
			curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
		} else {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
		}

		if ($method === "POST") {
			curl_setopt($ch, CURLOPT_POST, true);
			$headers[] = "Content-Type: application/json";
			$body = !empty($data) ? json_encode($data) : "{}";
			curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
		} elseif ($method === "PATCH") {
			curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
			$headers[] = "Content-Type: application/json";
			$body = !empty($data) ? json_encode($data) : "{}";
			curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
		} elseif ($method === "DELETE") {
			curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
		}

		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		$curlError = curl_error($ch);
		curl_close($ch);

		if ($response === false) {
			return [
				"_error" => true,
				"_http_code" => 0,
				"_curl_error" => $curlError
			];
		}

		// Some PayPal endpoints return 204 No Content (e.g. cancel subscription)
		if ($httpCode === 204 || strlen(trim($response)) === 0) {
			return ["_http_code" => $httpCode];
		}

		$decoded = json_decode($response, true);
		if ($decoded === null) {
			return [
				"_error" => true,
				"_http_code" => $httpCode,
				"_raw_response" => substr($response, 0, 500)
			];
		}

		if ($httpCode >= 400) {
			$decoded["_error"] = true;
			$decoded["_http_code"] = $httpCode;
		}

		return $decoded;
	}

	/**
	 * Verifies a PayPal webhook signature by calling PayPal's verification endpoint.
	 * Unlike Stripe (which uses local HMAC), PayPal verifies signatures server-side.
	 *
	 * POST /v1/notifications/verify-webhook-signature
	 *
	 * @param array $headers The incoming HTTP request headers.
	 * @param string $body The raw webhook request body.
	 * @param string $webhookId The PayPal webhook ID (from developer dashboard).
	 * @return bool True if the signature is valid.
	 */
	public static function verifyWebhookSignature(array $headers, string $body, string $webhookId): bool {
		$event = json_decode($body, true);
		if ($event === null) {
			return false;
		}

		$verifyData = [
			"auth_algo" => $headers["PAYPAL-AUTH-ALGO"] ?? ($headers["paypal-auth-algo"] ?? ""),
			"cert_url" => $headers["PAYPAL-CERT-URL"] ?? ($headers["paypal-cert-url"] ?? ""),
			"transmission_id" => $headers["PAYPAL-TRANSMISSION-ID"] ?? ($headers["paypal-transmission-id"] ?? ""),
			"transmission_sig" => $headers["PAYPAL-TRANSMISSION-SIG"] ?? ($headers["paypal-transmission-sig"] ?? ""),
			"transmission_time" => $headers["PAYPAL-TRANSMISSION-TIME"] ?? ($headers["paypal-transmission-time"] ?? ""),
			"webhook_id" => $webhookId,
			"webhook_event" => $event
		];

		$result = self::post("v1/notifications/verify-webhook-signature", $verifyData);

		if (isset($result["_error"])) {
			return false;
		}

		return ($result["verification_status"] ?? "") === "SUCCESS";
	}
}
