<?php
/**
 * Schema setup for Store, OAuth, Fonts, and Feature Gating tables.
 * Creates the `store` database and new tables in `media` and `accounts`.
 * Follows the same pattern as SchemaSetup.php.
 */

require_once __DIR__ . "/Database.php";

class StoreSchemaSetup {

	private string $server;
	private int $port;
	private string $username;
	private string $password;

	public function __construct() {
		$iniPath = "A:/wamp64/www/ServerAssets/Assets/Server/Info/PHP/db.ini";
		$config = parse_ini_file($iniPath, true);
		$this->server = $config["connection"]["server"];
		$this->port = (int)$config["connection"]["port"];
		$this->username = $config["credentials"]["username"];
		$this->password = $config["credentials"]["password"];
	}

	private function connect(string $dbName = ""): PDO {
		$dsn = "mysql:host={$this->server};port={$this->port}";
		if ($dbName !== "") {
			$dsn .= ";dbname={$dbName}";
		}
		$dsn .= ";charset=utf8mb4";
		return new PDO($dsn, $this->username, $this->password, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			PDO::ATTR_EMULATE_PREPARES => false,
		]);
	}

	private function tableExists(PDO $pdo, string $table): bool {
		$dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
		$stmt = $pdo->prepare(
			"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?"
		);
		$stmt->execute([$dbName, $table]);
		return (int)$stmt->fetchColumn() > 0;
	}

	private function columnExists(PDO $pdo, string $table, string $column): bool {
		$dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
		$stmt = $pdo->prepare(
			"SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?"
		);
		$stmt->execute([$dbName, $table, $column]);
		return (int)$stmt->fetchColumn() > 0;
	}

	/**
	 * Runs all store-related schema migrations.
	 * @return array Results of each migration step.
	 */
	public function run(): array {
		$results = [];
		$results[] = $this->createStoreDatabase();
		$results[] = $this->createStoreAccounts();
		$results[] = $this->createStoreLinkPlatforms();
		$results[] = $this->createStoreSubscriptions();
		$results[] = $this->createStoreTransactions();
		$results[] = $this->createMediaFonts();
		$results[] = $this->createAccountsFontOptions();
		$results[] = $this->createAccountsFeatureFlags();
		$results[] = $this->extendAuthority();
		return $results;
	}

	/**
	 * Creates the `store` database if it does not exist.
	 */
	private function createStoreDatabase(): array {
		$result = ["table" => "store (database)", "actions" => []];
		$pdo = $this->connect();
		$pdo->exec("CREATE DATABASE IF NOT EXISTS `store` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
		$result["actions"][] = "Ensured store database exists";
		return $result;
	}

	/**
	 * Creates store.accounts — links MusicPlayer users to Stripe customers.
	 */
	private function createStoreAccounts(): array {
		$result = ["table" => "store.accounts", "actions" => []];
		$pdo = $this->connect("store");

		if (!$this->tableExists($pdo, "accounts")) {
			$pdo->exec("
				CREATE TABLE `accounts` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`stripe_customer_id` VARCHAR(255) NOT NULL,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					`updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_store_user` (`user_id`),
					UNIQUE KEY `uq_store_stripe` (`stripe_customer_id`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates store.link_platforms — external OAuth provider links.
	 */
	private function createStoreLinkPlatforms(): array {
		$result = ["table" => "store.link_platforms", "actions" => []];
		$pdo = $this->connect("store");

		if (!$this->tableExists($pdo, "link_platforms")) {
			$pdo->exec("
				CREATE TABLE `link_platforms` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`platform` VARCHAR(50) NOT NULL,
					`platform_user_id` VARCHAR(255) NOT NULL,
					`platform_email` VARCHAR(255) DEFAULT NULL,
					`access_token` TEXT DEFAULT NULL,
					`refresh_token` TEXT DEFAULT NULL,
					`token_expires_at` TIMESTAMP NULL DEFAULT NULL,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_user_platform` (`user_id`, `platform`),
					UNIQUE KEY `uq_platform_uid` (`platform`, `platform_user_id`),
					KEY `idx_platform_email` (`platform`, `platform_email`(191))
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates store.subscriptions — local mirror of Stripe subscriptions.
	 */
	private function createStoreSubscriptions(): array {
		$result = ["table" => "store.subscriptions", "actions" => []];
		$pdo = $this->connect("store");

		if (!$this->tableExists($pdo, "subscriptions")) {
			$pdo->exec("
				CREATE TABLE `subscriptions` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`stripe_subscription_id` VARCHAR(255) NOT NULL,
					`stripe_price_id` VARCHAR(255) NOT NULL,
					`status` VARCHAR(50) NOT NULL DEFAULT 'active',
					`current_period_start` TIMESTAMP NULL DEFAULT NULL,
					`current_period_end` TIMESTAMP NULL DEFAULT NULL,
					`cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					`updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_stripe_sub` (`stripe_subscription_id`),
					KEY `idx_user_status` (`user_id`, `status`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates store.transactions — payment records.
	 */
	private function createStoreTransactions(): array {
		$result = ["table" => "store.transactions", "actions" => []];
		$pdo = $this->connect("store");

		if (!$this->tableExists($pdo, "transactions")) {
			$pdo->exec("
				CREATE TABLE `transactions` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`stripe_payment_intent` VARCHAR(255) DEFAULT NULL,
					`stripe_checkout_id` VARCHAR(255) DEFAULT NULL,
					`amount_cents` INT UNSIGNED NOT NULL DEFAULT 0,
					`currency` VARCHAR(10) NOT NULL DEFAULT 'usd',
					`description` VARCHAR(500) DEFAULT NULL,
					`status` VARCHAR(50) NOT NULL DEFAULT 'pending',
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					KEY `idx_user_created` (`user_id`, `created_at`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates media.fonts — custom uploaded font files.
	 */
	private function createMediaFonts(): array {
		$result = ["table" => "media.fonts", "actions" => []];
		$pdo = $this->connect("media");

		if (!$this->tableExists($pdo, "fonts")) {
			$pdo->exec("
				CREATE TABLE `fonts` (
					`id` CHAR(255) NOT NULL,
					`name` VARCHAR(255) NOT NULL,
					`file_blob` LONGBLOB NOT NULL,
					`mime_type` VARCHAR(100) NOT NULL DEFAULT 'font/ttf',
					`uploaded_by` CHAR(36) NOT NULL,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					KEY `idx_font_uploader` (`uploaded_by`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates accounts.font_options — per-user font preferences.
	 */
	private function createAccountsFontOptions(): array {
		$result = ["table" => "accounts.font_options", "actions" => []];
		$pdo = $this->connect("accounts");

		if (!$this->tableExists($pdo, "font_options")) {
			$pdo->exec("
				CREATE TABLE `font_options` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`font_id` CHAR(255) DEFAULT NULL,
					`option_key` VARCHAR(100) NOT NULL,
					`option_value` VARCHAR(500) DEFAULT NULL,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_user_key` (`user_id`, `option_key`),
					KEY `idx_font_opt_user` (`user_id`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Creates accounts.feature_flags — admin-granted feature overrides.
	 */
	private function createAccountsFeatureFlags(): array {
		$result = ["table" => "accounts.feature_flags", "actions" => []];
		$pdo = $this->connect("accounts");

		if (!$this->tableExists($pdo, "feature_flags")) {
			$pdo->exec("
				CREATE TABLE `feature_flags` (
					`id` CHAR(255) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`feature_key` VARCHAR(100) NOT NULL,
					`granted` TINYINT(1) NOT NULL DEFAULT 1,
					`granted_by` CHAR(36) DEFAULT NULL,
					`expires_at` TIMESTAMP NULL DEFAULT NULL,
					`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_user_feature` (`user_id`, `feature_key`),
					KEY `idx_ff_user` (`user_id`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Extends the authority SET column on accounts.users with StoreAdmin and UserAdmin flags.
	 */
	private function extendAuthority(): array {
		$result = ["table" => "accounts.users (authority)", "actions" => []];
		$pdo = $this->connect("accounts");

		// Check current SET definition
		$stmt = $pdo->prepare(
			"SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'accounts' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'authority'"
		);
		$stmt->execute();
		$colType = $stmt->fetchColumn();

		if ($colType && strpos($colType, "StoreAdmin") === false) {
			$pdo->exec("
				ALTER TABLE `users` MODIFY COLUMN `authority` SET(
					'None',
					'DbSelect','DbInsert','DbAlter',
					'ClientViewPublic','ClientViewUnlisted','ClientViewPrivate','ClientViewOwn',
					'ClientModifyPublic','ClientModifyUnlisted','ClientModifyPrivate','ClientModifyOwn',
					'ServerViewPublic','ServerViewUnlisted','ServerViewPrivate',
					'StoreAdmin','UserAdmin'
				) NOT NULL DEFAULT 'ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic'
			");
			$result["actions"][] = "Added StoreAdmin and UserAdmin to authority SET";
		} else {
			$result["actions"][] = "Authority flags already include StoreAdmin";
		}

		return $result;
	}
}
