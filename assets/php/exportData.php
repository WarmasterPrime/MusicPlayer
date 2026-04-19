<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/Database.php";

if (!isLoggedIn()) {
	http_response_code(401);
	exit("Not logged in.");
}

$user = getCurrentUser();
$format = $_GET["format"] ?? "txt";

try {
	$pdo = Database::connect("accounts");
	$stmt = $pdo->prepare("
		SELECT `username`, `email`, `phone`, `first_name`, `last_name`, `dob`,
		       `country`, `state_region`, `language`, `user_description`, `authority`
		FROM `users`
		WHERE `id` = ?
		LIMIT 1
	");
	$stmt->execute([$user["id"]]);
	$profile = $stmt->fetch();

	if (!$profile) {
		http_response_code(404);
		exit("User not found.");
	}

	// Prepare data for export
	$data = [
		"Account Information" => [
			"Username" => $profile["username"],
			"Email" => $profile["email"] ?? "N/A",
			"Phone" => $profile["phone"] ?? "N/A",
			"First Name" => $profile["first_name"] ?? "N/A",
			"Last Name" => $profile["last_name"] ?? "N/A",
			"Date of Birth" => $profile["dob"] ?? "N/A",
			"Country" => $profile["country"] ?? "N/A",
			"Region" => $profile["state_region"] ?? "N/A",
			"Language" => $profile["language"] ?? "en",
			"Description" => $profile["user_description"] ?? "N/A",
			"Authority Flags" => $profile["authority"] ?? "N/A"
		]
	];

	// Fetch linked platforms
	$stmt = $pdo->prepare("SELECT `platform`, `platform_email` FROM `user_platforms` WHERE `user_id` = ?");
	$stmt->execute([$user["id"]]);
	$platforms = $stmt->fetchAll();
	if ($platforms) {
		$data["Linked Accounts"] = [];
		foreach ($platforms as $p) {
			$data["Linked Accounts"][] = [
				"Platform" => $p["platform"],
				"Email" => $p["platform_email"] ?? "N/A"
			];
		}
	}

	$filename = "MusicPlayer_Data_" . $profile["username"] . "_" . date("Y-m-d");

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
			// Flatten data for CSV
			fputcsv($output, ["Category", "Field", "Value"]);
			foreach ($data as $category => $fields) {
				if (is_array($fields) && isset($fields[0])) { // List of objects (e.g. Linked Accounts)
					foreach ($fields as $item) {
						foreach ($item as $k => $v) {
							fputcsv($output, [$category, $k, $v]);
						}
					}
				} else {
					foreach ($fields as $k => $v) {
						fputcsv($output, [$category, $k, $v]);
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
			echo "=============================\n\n";
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

} catch (PDOException $e) {
	http_response_code(500);
	exit("Database error.");
}
