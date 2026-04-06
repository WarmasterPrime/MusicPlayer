<?php

class Stripe {
	
	private static $apiKeyPath = "A:/Server/keys/stripe.ini";
	private $privateApiKey = null;
	private $publicApiKey = null;
	
	
	public function __construct() {
		$tmp = Stripe::loadKeys()["production"];
		$this->privateApiKey = $tmp["private_key"];
		$this->publicApiKey = $tmp["public_key"];
	}
	
	public static function loadKeys() {
		if (!file_exists(self::$apiKeyPath)) {
			throw new Exception("Stripe API key file not found.");
		}
		$ini = parse_ini_file(self::$apiKeyPath, true, INI_SCANNER_NORMAL);
		//if (!$ini || !isset($ini["private_key"]) || !isset($ini["public_key"])) {
		//	throw new Exception("Invalid Stripe API key file format.");
		//}
		return $ini;
	}
	
}

//var_dump(Stripe::loadKeys());

?>