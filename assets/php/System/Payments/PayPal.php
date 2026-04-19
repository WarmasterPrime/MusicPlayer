<?php
/**
 * PayPal configuration loader.
 * Reads API credentials from paypal.ini (sandbox/production).
 *
 * Active environment: edit `DEFAULT_ENV` below to swap all PayPal API calls
 * between "development" (sandbox) and "production" (live) at once. All call
 * sites should use `PayPal::defaultEnv()` rather than hard-coding the env.
 */

class PayPal {

	/** Default active environment. Change to "development" for sandbox testing. */
	const DEFAULT_ENV = "production";

	private static $apiKeyPath = "A:/Server/keys/paypal.ini";
	private $clientId = null;
	private $clientSecret = null;


	public function __construct() {
		$tmp = PayPal::loadKeys()[self::DEFAULT_ENV];
		$this->clientId = $tmp["public_key"];
		$this->clientSecret = $tmp["private_key"];
	}

	/**
	 * Returns the currently configured default environment.
	 * @return string "production" or "development"
	 */
	public static function defaultEnv(): string {
		return self::DEFAULT_ENV;
	}

	/**
	 * Parses the paypal.ini file and returns all environment sections.
	 * @return array Associative array keyed by environment name.
	 * @throws Exception If the ini file is missing.
	 */
	public static function loadKeys(): array {
		if (!file_exists(self::$apiKeyPath)) {
			throw new Exception("PayPal API key file not found.");
		}
		$ini = parse_ini_file(self::$apiKeyPath, true, INI_SCANNER_RAW);
		if ($ini === false) {
			throw new Exception("Failed to parse PayPal API key file.");
		}
		return $ini;
	}

}

?>
