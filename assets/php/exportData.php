<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

if (!isLoggedIn()) {
	http_response_code(401);
	exit("Not logged in.");
}

$user = getCurrentUser();
$format = $_GET["format"] ?? "txt";

/**
 * Returns the set of columns that actually exist in `accounts.users` so we
 * can build a SELECT that tolerates older schemas. Older installs may
 * pre-date `dob`, `user_description`, `authority`, etc.
 */
function existingUserColumns(PDO $pdo): array {
	$cols = [];
	try {
		$stmt = $pdo->query("SHOW COLUMNS FROM `users`");
		foreach ($stmt->fetchAll() as $row) {
			$cols[] = $row["Field"];
		}
	} catch (Exception $e) {
		// Return empty — caller will fall back to bare `id` + `username`.
	}
	return $cols;
}

function fetchRowsSafely(PDO $pdo, string $sql, array $params): array {
	try {
		$stmt = $pdo->prepare($sql);
		$stmt->execute($params);
		return $stmt->fetchAll();
	} catch (Exception $e) {
		return [];
	}
}

try {
	$pdo = Database::connect("accounts");

	// Build a tolerant SELECT based on what columns actually exist so the
	// export works on partially-migrated schemas instead of 500'ing.
	$wanted = [
		"username", "email", "phone", "first_name", "last_name", "dob",
		"country", "state_region", "language", "user_description", "authority"
	];
	$have = existingUserColumns($pdo);
	$pick = array_values(array_intersect($wanted, $have));
	if (empty($pick)) {
		http_response_code(500);
		exit("User schema is missing required columns.");
	}
	$colList = "`" . implode("`, `", $pick) . "`";
	$stmt = $pdo->prepare("SELECT {$colList} FROM `users` WHERE `id` = ? LIMIT 1");
	$stmt->execute([$user["id"]]);
	$profile = $stmt->fetch();

	if (!$profile) {
		http_response_code(404);
		exit("User not found.");
	}

	$labelMap = [
		"username" => "Username",
		"email" => "Email",
		"phone" => "Phone",
		"first_name" => "First Name",
		"last_name" => "Last Name",
		"dob" => "Date of Birth",
		"country" => "Country",
		"state_region" => "Region",
		"language" => "Language",
		"user_description" => "Description",
		"authority" => "Authority Flags",
	];
	$account = [];
	foreach ($pick as $col) {
		$label = $labelMap[$col] ?? $col;
		$account[$label] = ($profile[$col] === null || $profile[$col] === "") ? "N/A" : $profile[$col];
	}

	$data = [
		"Account Information" => $account,
	];

	// Linked platforms (best-effort — skip on error)
	$platforms = fetchRowsSafely(
		$pdo,
		"SELECT `platform`, `platform_email` FROM `user_platforms` WHERE `user_id` = ?",
		[$user["id"]]
	);
	if ($platforms) {
		$data["Linked Accounts"] = [];
		foreach ($platforms as $p) {
			$data["Linked Accounts"][] = [
				"Platform" => $p["platform"] ?? "N/A",
				"Email" => $p["platform_email"] ?? "N/A"
			];
		}
	}

	// Saved layouts (best-effort — table may not exist on older installs)
	$layouts = fetchRowsSafely(
		$pdo,
		"SELECT `id`, `name`, `is_active`, `updated_at` FROM `user_layouts` WHERE `user_id` = ? ORDER BY `updated_at` DESC",
		[$user["id"]]
	);
	if ($layouts) {
		$data["Saved Layouts"] = [];
		foreach ($layouts as $l) {
			$data["Saved Layouts"][] = [
				"ID" => $l["id"] ?? "",
				"Name" => $l["name"] ?? "",
				"Active" => !empty($l["is_active"]) ? "Yes" : "No",
				"Last Updated" => $l["updated_at"] ?? ""
			];
		}
	}

	// User-owned lyrics (best-effort — lives in the musicplayer DB)
	try {
		$lyPdo = Database::connect("musicplayer");
		$lyrics = fetchRowsSafely(
			$lyPdo,
			"SELECT `id`, `song_id`, `language`, `updated_at` FROM `lyrics` WHERE `updated_by` = ? ORDER BY `updated_at` DESC LIMIT 500",
			[$user["id"]]
		);
		if ($lyrics) {
			$data["Lyrics Contributions"] = [];
			foreach ($lyrics as $l) {
				$data["Lyrics Contributions"][] = [
					"ID" => $l["id"] ?? "",
					"Song ID" => $l["song_id"] ?? "",
					"Language" => $l["language"] ?? "",
					"Last Updated" => $l["updated_at"] ?? ""
				];
			}
		}
	} catch (Exception $e) {
		// musicplayer DB may not be present — skip silently.
	}

	$uname = preg_replace("/[^A-Za-z0-9_\\-]/", "_", $profile["username"] ?? "user");
	$filename = "MusicPlayer_Data_" . $uname . "_" . date("Y-m-d");

	switch ($format) {
		case "json":
			header("Content-Type: application/json");
			header("Content-Disposition: attachment; filename=\"{$filename}.json\"");
			echo json_encode($data, JSON_PRETTY_PRINT);
			break;

		case "csv":
			header("Content-Type: text/csv");
			header("Content-Disposition: attachment; filename=\"{$filename}.csv\"");
			$output = fopen("php://output", "w");
			fputcsv($output, ["Category", "Field", "Value"]);
			foreach ($data as $category => $fields) {
				if (is_array($fields) && isset($fields[0])) {
					foreach ($fields as $item) {
						foreach ($item as $k => $v) {
							fputcsv($output, [$category, $k, (string)$v]);
						}
					}
				} else {
					foreach ($fields as $k => $v) {
						fputcsv($output, [$category, $k, (string)$v]);
					}
				}
			}
			fclose($output);
			break;

		case "txt":
		default:
			header("Content-Type: text/plain");
			header("Content-Disposition: attachment; filename=\"{$filename}.txt\"");
			echo "MusicPlayer - User Data Export\n";
			echo "==============================\n\n";
			foreach ($data as $category => $fields) {
				echo "[$category]\n";
				if (is_array($fields) && isset($fields[0])) {
					foreach ($fields as $index => $item) {
						echo "  Item #" . ($index + 1) . ":\n";
						foreach ($item as $k => $v) {
							echo "    $k: $v\n";
						}
					}
				} else {
					foreach ($fields as $k => $v) {
						echo "  $k: $v\n";
					}
				}
				echo "\n";
			}
			break;
	}

} catch (Throwable $e) {
	// Surface a safe but descriptive error to the client, and log details
	// server-side for the owner to diagnose.
	error_log("[exportData] " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
	http_response_code(500);
	header("Content-Type: text/plain");
	echo "Failed to export data: " . $e->getMessage();
}
