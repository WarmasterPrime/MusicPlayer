<?php
/**
 * cURL-based wrapper for the Stripe REST API.
 * No external libraries required — uses PHP cURL directly.
 *
 * Stripe API uses application/x-www-form-urlencoded for POST bodies.
 * All methods return decoded JSON as associative arrays.
 */

require_once __DIR__ . "/Stripe.php";

class StripeApi {

	private static ?string $secretKey = null;
	private static ?string $publicKey = null;
	private static string $env = "production";

	/**
	 * Initializes the API keys from stripe.ini.
	 * @param string $env "development" or "production"
	 */
	public static function init(string $env = "production"): void {
		$keys = Stripe::loadKeys();
		if (!isset($keys[$env])) {
			throw new Exception("Stripe environment '$env' not found in stripe.ini.");
		}
		self::$secretKey = $keys[$env]["private_key"];
		self::$publicKey = $keys[$env]["public_key"];
		self::$env = $env;
	}

	/**
	 * Returns the public (publishable) key for client-side use.
	 * @return string
	 */
	public static function getPublicKey(): string {
		if (self::$publicKey === null) self::init();
		return self::$publicKey;
	}

	/**
	 * Returns the secret key (for internal use only).
	 * @return string
	 */
	private static function getSecretKey(): string {
		if (self::$secretKey === null) self::init();
		return self::$secretKey;
	}

	/**
	 * Performs a GET request to the Stripe API.
	 * @param string $endpoint e.g. "products", "prices", "customers/cus_xxx"
	 * @param array $params Query parameters.
	 * @return array Decoded JSON response.
	 */
	public static function get(string $endpoint, array $params = []): array {
		$url = "https://api.stripe.com/v1/" . ltrim($endpoint, "/");
		if (!empty($params)) {
			$url .= "?" . http_build_query($params);
		}
		return self::request("GET", $url);
	}

	/**
	 * Performs a POST request to the Stripe API.
	 * @param string $endpoint e.g. "checkout/sessions", "customers"
	 * @param array $data Form data (will be encoded as x-www-form-urlencoded).
	 * @return array Decoded JSON response.
	 */
	public static function post(string $endpoint, array $data = []): array {
		$url = "https://api.stripe.com/v1/" . ltrim($endpoint, "/");
		return self::request("POST", $url, $data);
	}

	/**
	 * Performs a DELETE request to the Stripe API.
	 * @param string $endpoint e.g. "subscriptions/sub_xxx"
	 * @return array Decoded JSON response.
	 */
	public static function delete(string $endpoint): array {
		$url = "https://api.stripe.com/v1/" . ltrim($endpoint, "/");
		return self::request("DELETE", $url);
	}

	/**
	 * Core cURL request method.
	 * @param string $method GET, POST, or DELETE
	 * @param string $url Full URL.
	 * @param array $data POST data (ignored for GET/DELETE).
	 * @return array Decoded JSON with optional _error and _http_code fields.
	 */
	private static function request(string $method, string $url, array $data = []): array {
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			"Authorization: Bearer " . self::getSecretKey()
		]);
		curl_setopt($ch, CURLOPT_TIMEOUT, 30);

		// In development, WAMP may lack a CA cert bundle.
		// Disable SSL peer verification only for development.
		if (self::$env === "development") {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
			curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
		} else {
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
		}

		if ($method === "POST") {
			curl_setopt($ch, CURLOPT_POST, true);
			// Stripe requires form-encoded data, not JSON.
			// http_build_query handles nested arrays with bracket notation.
			curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
		} elseif ($method === "DELETE") {
			curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
		}

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
	 * Verifies a Stripe webhook signature.
	 * @param string $payload Raw request body.
	 * @param string $sigHeader The Stripe-Signature header value.
	 * @param string $webhookSecret The webhook endpoint secret.
	 * @param int $tolerance Tolerance in seconds (default 300 = 5 minutes).
	 * @return array|null Decoded event if valid, null if invalid.
	 */
	public static function verifyWebhookSignature(string $payload, string $sigHeader, string $webhookSecret, int $tolerance = 300): ?array {
		$parts = [];
		foreach (explode(",", $sigHeader) as $item) {
			$kv = explode("=", $item, 2);
			if (count($kv) === 2) {
				$parts[$kv[0]] = $kv[1];
			}
		}

		if (!isset($parts["t"]) || !isset($parts["v1"])) {
			return null;
		}

		$timestamp = (int)$parts["t"];
		$signature = $parts["v1"];

		// Check timestamp tolerance
		if (abs(time() - $timestamp) > $tolerance) {
			return null;
		}

		// Compute expected signature
		$signedPayload = $timestamp . "." . $payload;
		$expected = hash_hmac("sha256", $signedPayload, $webhookSecret);

		if (!hash_equals($expected, $signature)) {
			return null;
		}

		return json_decode($payload, true);
	}
}
