<?php
/**
 * Google OAuth 2.0 helper — all via cURL, no external libraries.
 */

class GoogleOAuth {

	private static ?array $config = null;
	private static string $configPath = "A:/Server/keys/google.ini";

	/**
	 * Loads and caches the Google OAuth config.
	 * @return array
	 */
	private static function getConfig(): array {
		if (self::$config === null) {
			if (!file_exists(self::$configPath)) {
				throw new Exception("Google OAuth config file not found: " . self::$configPath);
			}
			self::$config = parse_ini_file(self::$configPath, true);
		}
		return self::$config["oauth"] ?? [];
	}

	/**
	 * Builds the Google authorization URL.
	 * @param string $state A random state token for CSRF protection.
	 * @return string The authorization URL to redirect the user to.
	 */
	public static function getAuthUrl(string $state): string {
		$config = self::getConfig();
		$params = http_build_query([
			"client_id" => $config["client_id"] ?? "",
			"redirect_uri" => $config["redirect_uri"] ?? "",
			"response_type" => "code",
			"scope" => "email profile",
			"access_type" => "offline",
			"state" => $state,
			"prompt" => "consent"
		]);
		return "https://accounts.google.com/o/oauth2/v2/auth?" . $params;
	}

	/**
	 * Exchanges an authorization code for tokens.
	 * @param string $code The authorization code from Google's callback.
	 * @return array { access_token, refresh_token, id_token, expires_in, ... } or { error }
	 */
	public static function exchangeCode(string $code): array {
		$config = self::getConfig();
		$data = [
			"code" => $code,
			"client_id" => $config["client_id"] ?? "",
			"client_secret" => $config["client_secret"] ?? "",
			"redirect_uri" => $config["redirect_uri"] ?? "",
			"grant_type" => "authorization_code"
		];

		$ch = curl_init("https://oauth2.googleapis.com/token");
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Development
		curl_setopt($ch, CURLOPT_TIMEOUT, 15);
		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		$decoded = json_decode($response, true) ?? [];
		if ($httpCode >= 400 || isset($decoded["error"])) {
			return ["error" => $decoded["error_description"] ?? $decoded["error"] ?? "Token exchange failed."];
		}

		return $decoded;
	}

	/**
	 * Fetches the user's profile info from Google.
	 * @param string $accessToken
	 * @return array { id, email, verified_email, name, given_name, family_name, picture } or { error }
	 */
	public static function getUserInfo(string $accessToken): array {
		$ch = curl_init("https://www.googleapis.com/oauth2/v2/userinfo");
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			"Authorization: Bearer " . $accessToken
		]);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Development
		curl_setopt($ch, CURLOPT_TIMEOUT, 15);
		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		$decoded = json_decode($response, true) ?? [];
		if ($httpCode >= 400 || isset($decoded["error"])) {
			return ["error" => $decoded["error"]["message"] ?? "Failed to fetch user info."];
		}

		return $decoded;
	}

	/**
	 * Generates a random state token for CSRF protection.
	 * @return string
	 */
	public static function generateState(): string {
		return bin2hex(random_bytes(16));
	}
}
