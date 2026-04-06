<?php
/**
 * Provides PDO database connections by reading credentials from db.ini.
 */
class Database {

	private static ?array $config = null;

	/**
	 * Reads and caches the db.ini config.
	 * @return array
	 */
	private static function getConfig(): array {
		if (self::$config === null) {
			self::$config = parse_ini_file("A:/wamp64/www/ServerAssets/Assets/Server/Info/PHP/db.ini", true);
		}
		return self::$config;
	}

	/**
	 * Creates a PDO connection to the specified database.
	 * @param string $dbName The database name.
	 * @return PDO
	 */
	public static function connect(string $dbName): PDO {
		$config = self::getConfig();
		$server = $config["connection"]["server"];
		$port = $config["connection"]["port"];
		$username = $config["credentials"]["username"];
		$password = $config["credentials"]["password"];

		$dsn = "mysql:host={$server};port={$port};dbname={$dbName};charset=utf8mb4";
		return new PDO($dsn, $username, $password, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			PDO::ATTR_EMULATE_PREPARES => false,
		]);
	}

	/**
	 * Generates a random alphanumeric ID of the given length.
	 * @param int $length The ID length (default 8).
	 * @return string
	 */
	public static function generateId(int $length = 8): string {
		$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
		$id = "";
		for ($i = 0; $i < $length; $i++) {
			$id .= $chars[random_int(0, 63)];
		}
		return $id;
	}

	/**
	 * Generates a UUID v4 string.
	 * @return string
	 */
	public static function generateUUID(): string {
		$data = random_bytes(16);
		$data[6] = chr(ord($data[6]) & 0x0f | 0x40);
		$data[8] = chr(ord($data[8]) & 0x3f | 0x80);
		return vsprintf("%s%s-%s-%s-%s-%s%s%s", str_split(bin2hex($data), 4));
	}
}
