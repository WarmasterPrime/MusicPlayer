<?php
/**
 * Database schema setup and migration for the MusicPlayer application.
 * Alters existing tables and creates new ones to match the required schema.
 *
 * Databases: media, musicplayer, accounts
 */

class SchemaSetup {

	private PDO $pdo;
	private string $server;
	private int $port;
	private string $username;
	private string $password;

	/**
	 * Creates a new SchemaSetup instance by reading credentials from db.ini.
	 */
	public function __construct() {
		$iniPath = "A:/wamp64/www/ServerAssets/Assets/Server/Info/PHP/db.ini";
		$config = parse_ini_file($iniPath, true);
		$this->server = $config["connection"]["server"];
		$this->port = (int)$config["connection"]["port"];
		$this->username = $config["credentials"]["username"];
		$this->password = $config["credentials"]["password"];
	}

	/**
	 * Connects to a specific database.
	 * @param string $dbName The database name.
	 * @return PDO
	 */
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

	/**
	 * Checks if a column exists on a table.
	 */
	private function columnExists(PDO $pdo, string $table, string $column): bool {
		$dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
		$stmt = $pdo->prepare(
			"SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?"
		);
		$stmt->execute([$dbName, $table, $column]);
		return (int)$stmt->fetchColumn() > 0;
	}

	/**
	 * Checks if a table exists in the current database.
	 */
	private function tableExists(PDO $pdo, string $table): bool {
		$dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
		$stmt = $pdo->prepare(
			"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?"
		);
		$stmt->execute([$dbName, $table]);
		return (int)$stmt->fetchColumn() > 0;
	}

	/**
	 * Runs all schema migrations.
	 * @return array Results of each migration step.
	 */
	public function run(): array {
		$results = [];

		$results[] = $this->migrateMediaSongs();
		$results[] = $this->createSongFiles();
		$results[] = $this->migrateMediaPlaylists();
		$results[] = $this->migrateMediaPlaylistSongs();
		$results[] = $this->createPlaylistPermissions();
		$results[] = $this->migrateMusicplayerLyrics();
		$results[] = $this->migrateAccountsUsers();
		$results[] = $this->createUserLayouts();
		$results[] = $this->createFeatureFlags();
		return $results;
	}

	/**
	 * CREATE accounts.feature_flags if it does not exist.
	 */
	private function createFeatureFlags(): array {
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
			$result["actions"][] = "Created feature_flags table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * CREATE accounts.user_layouts if it does not exist.
	 */
	private function createUserLayouts(): array {
		$result = ["table" => "accounts.user_layouts", "actions" => []];
		$pdo = $this->connect("accounts");

		if (!$this->tableExists($pdo, "user_layouts")) {
			$pdo->exec("
				CREATE TABLE `user_layouts` (
					`id` CHAR(36) NOT NULL,
					`user_id` CHAR(36) NOT NULL,
					`name` VARCHAR(100) NOT NULL,
					`layout_data` LONGTEXT NOT NULL,
					`is_active` TINYINT(1) NOT NULL DEFAULT 0,
					`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					KEY `idx_ul_user_id` (`user_id`),
					CONSTRAINT `fk_ul_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created user_layouts table";

			// Auto-UUID trigger
			$pdo->exec("
				CREATE TRIGGER `bi_user_layouts` BEFORE INSERT ON `user_layouts`
				FOR EACH ROW
				BEGIN
					IF NEW.id IS NULL OR NEW.id = '' THEN
						SET NEW.id = UUID();
					END IF;
				END
			");
			$result["actions"][] = "Created bi_user_layouts trigger";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * ALTER media.songs: add keywords, uploaded_by, updated_at if missing.
	 */
	private function migrateMediaSongs(): array {
		$result = ["table" => "media.songs", "actions" => []];
		$pdo = $this->connect("media");

		if (!$this->columnExists($pdo, "songs", "keywords")) {
			$pdo->exec("ALTER TABLE `songs` ADD COLUMN `keywords` TEXT NULL AFTER `publisher`");
			$result["actions"][] = "Added column: keywords";
		}

		if (!$this->columnExists($pdo, "songs", "uploaded_by")) {
			$pdo->exec("ALTER TABLE `songs` ADD COLUMN `uploaded_by` CHAR(36) NULL AFTER `keywords`");
			$result["actions"][] = "Added column: uploaded_by";
		}

		if (!$this->columnExists($pdo, "songs", "updated_at")) {
			$pdo->exec("ALTER TABLE `songs` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
			$result["actions"][] = "Added column: updated_at";
		}

		// Convert charset (disable FK checks on this connection)
		$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
		$pdo->exec("ALTER TABLE `songs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
		$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
		$result["actions"][] = "Ensured utf8mb4 charset";

		if (empty($result["actions"])) {
			$result["actions"][] = "No changes needed";
		}
		return $result;
	}

	/**
	 * CREATE media.song_files if it does not exist.
	 */
	private function createSongFiles(): array {
		$result = ["table" => "media.song_files", "actions" => []];
		$pdo = $this->connect("media");

		if (!$this->tableExists($pdo, "song_files")) {
			$pdo->exec("
				CREATE TABLE `song_files` (
					`id` CHAR(36) NOT NULL,
					`song_id` CHAR(36) NOT NULL,
					`file_blob` LONGBLOB NOT NULL,
					`mime_type` VARCHAR(50) NOT NULL DEFAULT 'audio/mpeg',
					`file_size_bytes` INT UNSIGNED NOT NULL DEFAULT 0,
					`original_filename` VARCHAR(255) DEFAULT NULL,
					`file_ext` VARCHAR(10) DEFAULT NULL,
					`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (`id`),
					KEY `idx_sf_song_id` (`song_id`),
					CONSTRAINT `fk_sf_song` FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON DELETE CASCADE
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created song_files table";

			// Auto-UUID trigger
			$pdo->exec("
				CREATE TRIGGER `bi_song_files` BEFORE INSERT ON `song_files`
				FOR EACH ROW
				BEGIN
					IF NEW.id IS NULL OR NEW.id = '' THEN
						SET NEW.id = UUID();
					END IF;
				END
			");
			$result["actions"][] = "Created bi_song_files trigger";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * ALTER media.playlists: add description, updated_at, convert charset.
	 */
	private function migrateMediaPlaylists(): array {
		$result = ["table" => "media.playlists", "actions" => []];
		$pdo = $this->connect("media");

		if (!$this->columnExists($pdo, "playlists", "description")) {
			$pdo->exec("ALTER TABLE `playlists` ADD COLUMN `description` TEXT NULL AFTER `title`");
			$result["actions"][] = "Added column: description";
		}

		if (!$this->columnExists($pdo, "playlists", "updated_at")) {
			$pdo->exec("ALTER TABLE `playlists` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
			$result["actions"][] = "Added column: updated_at";
		}

		$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
		$pdo->exec("ALTER TABLE `playlists` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
		$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
		$result["actions"][] = "Ensured utf8mb4 charset";

		if (empty($result["actions"])) {
			$result["actions"][] = "No changes needed";
		}
		return $result;
	}

	/**
	 * ALTER media.playlist_songs: convert charset.
	 */
	private function migrateMediaPlaylistSongs(): array {
		$result = ["table" => "media.playlist_songs", "actions" => []];
		$pdo = $this->connect("media");

		$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
		$pdo->exec("ALTER TABLE `playlist_songs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
		$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
		$result["actions"][] = "Ensured utf8mb4 charset";

		return $result;
	}

	/**
	 * CREATE media.playlist_permissions if it does not exist.
	 */
	private function createPlaylistPermissions(): array {
		$result = ["table" => "media.playlist_permissions", "actions" => []];
		$pdo = $this->connect("media");

		if (!$this->tableExists($pdo, "playlist_permissions")) {
			$pdo->exec("
				CREATE TABLE `playlist_permissions` (
					`id` CHAR(36) NOT NULL,
					`playlist_id` CHAR(36) NOT NULL,
					`permission_name` VARCHAR(50) NOT NULL,
					`private` TINYINT(1) NOT NULL DEFAULT 0,
					`unlisted` TINYINT(1) NOT NULL DEFAULT 0,
					`public` TINYINT(1) NOT NULL DEFAULT 0,
					PRIMARY KEY (`id`),
					UNIQUE KEY `uq_playlist_perm` (`playlist_id`, `permission_name`),
					CONSTRAINT `fk_pp_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
			");
			$result["actions"][] = "Created table";
		} else {
			$result["actions"][] = "Table already exists";
		}

		return $result;
	}

	/**
	 * Migrate musicplayer.lyrics: backup, recreate with new schema, attempt data migration.
	 */
	private function migrateMusicplayerLyrics(): array {
		$result = ["table" => "musicplayer.lyrics", "actions" => []];
		$pdo = $this->connect("musicplayer");

		// Check if already migrated (has song_id column)
		if ($this->columnExists($pdo, "lyrics", "song_id")) {
			$result["actions"][] = "Already migrated (song_id column exists)";
			return $result;
		}

		// Backup existing data
		$existingData = $pdo->query("SELECT * FROM `lyrics`")->fetchAll();
		$result["actions"][] = "Backed up " . count($existingData) . " rows";

		// Create backup table
		$pdo->exec("CREATE TABLE IF NOT EXISTS `lyrics_backup` AS SELECT * FROM `lyrics`");
		$result["actions"][] = "Created lyrics_backup table";

		// Drop and recreate
		$pdo->exec("DROP TABLE `lyrics`");
		$pdo->exec("
			CREATE TABLE `lyrics` (
				`id` CHAR(36) NOT NULL,
				`song_id` CHAR(36) NOT NULL,
				`lyrics_json` LONGTEXT NULL,
				`language` VARCHAR(10) NULL DEFAULT 'en',
				`updated_by` CHAR(36) NULL,
				`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				`updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY (`id`),
				KEY `idx_lyrics_song` (`song_id`)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
		");
		$result["actions"][] = "Recreated lyrics table with new schema";

		// Attempt to migrate data by matching songName+artist to media.songs
		$mediaPdo = $this->connect("media");
		$migrated = 0;
		foreach ($existingData as $row) {
			$songName = $row["songName"] ?? "";
			$artist = $row["artist"] ?? "";
			$lyricsText = $row["lyrics"] ?? "";

			if (empty($lyricsText)) continue;

			// Try to find matching song in media.songs
			$stmt = $mediaPdo->prepare("SELECT `id` FROM `songs` WHERE `name` LIKE ? AND `artist` LIKE ? LIMIT 1");
			$stmt->execute(["%{$songName}%", "%{$artist}%"]);
			$song = $stmt->fetch();

			if ($song) {
				$id = $this->generateUUID();
				$insertStmt = $pdo->prepare("INSERT INTO `lyrics` (`id`, `song_id`, `lyrics_json`) VALUES (?, ?, ?)");
				$insertStmt->execute([$id, $song["id"], $lyricsText]);
				$migrated++;
			}
		}
		$result["actions"][] = "Migrated {$migrated} of " . count($existingData) . " rows (matched by songName+artist)";

		return $result;
	}

	/**
	 * ALTER accounts.users: add authority SET, language, profile_picture LONGBLOB.
	 */
	private function migrateAccountsUsers(): array {
		$result = ["table" => "accounts.users", "actions" => []];
		$pdo = $this->connect("accounts");

		if (!$this->columnExists($pdo, "users", "authority")) {
			$pdo->exec("
				ALTER TABLE `users` ADD COLUMN `authority` SET(
					'None',
					'DbSelect',
					'DbInsert',
					'DbAlter',
					'ClientViewPublic',
					'ClientViewUnlisted',
					'ClientViewPrivate',
					'ClientViewOwn',
					'ClientModifyPublic',
					'ClientModifyUnlisted',
					'ClientModifyPrivate',
					'ClientModifyOwn',
					'ServerViewPublic',
					'ServerViewUnlisted',
					'ServerViewPrivate'
				) NOT NULL DEFAULT 'ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic'
			");
			$result["actions"][] = "Added column: authority (SET with 15 flags)";
		}

		if (!$this->columnExists($pdo, "users", "language")) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `language` VARCHAR(10) NULL DEFAULT 'en' AFTER `state_region`");
			$result["actions"][] = "Added column: language";
		}

		if (!$this->columnExists($pdo, "users", "profile_picture")) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `profile_picture` LONGBLOB NULL AFTER `profile_picture_url`");
			$result["actions"][] = "Added column: profile_picture (LONGBLOB)";
		}

		if (!$this->columnExists($pdo, "users", "background")) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `background` LONGBLOB NULL AFTER `profile_picture`");
			$result["actions"][] = "Added column: background (LONGBLOB)";
		}

		if (!$this->columnExists($pdo, "users", "user_description")) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `user_description` TEXT NULL AFTER `language`");
			$result["actions"][] = "Added column: user_description (TEXT)";
		}

		if (!$this->columnExists($pdo, "users", "dob")) {
			$pdo->exec("ALTER TABLE `users` ADD COLUMN `dob` DATE NULL AFTER `last_name`");
			$result["actions"][] = "Added column: dob (DATE)";
		}

		$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
		$pdo->exec("ALTER TABLE `users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
		$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
		$result["actions"][] = "Ensured utf8mb4 charset";

		if (empty($result["actions"])) {
			$result["actions"][] = "No changes needed";
		}
		return $result;
	}

	/**
	 * Generates a UUID v4 string.
	 * @return string
	 */
	private function generateUUID(): string {
		$data = random_bytes(16);
		$data[6] = chr(ord($data[6]) & 0x0f | 0x40);
		$data[8] = chr(ord($data[8]) & 0x3f | 0x80);
		return vsprintf("%s%s-%s-%s-%s-%s%s%s", str_split(bin2hex($data), 4));
	}
}
