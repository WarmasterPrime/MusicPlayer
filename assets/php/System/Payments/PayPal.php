<?php
/**
 * PayPal configuration loader.
 * Reads API credentials from paypal.ini (sandbox/production).
 */

class PayPal {

	private static $apiKeyPath = "A:/Server/keys/paypal.ini";
	private $clientId = null;
	private $clientSecret = null;


	public function __construct() {
		$tmp = PayPal::loadKeys()["development"];
		$this->clientId = $tmp["public_key"];
		$this->clientSecret = $tmp["private_key"];
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
