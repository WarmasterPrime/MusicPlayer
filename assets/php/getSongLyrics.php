<?php
require_once __DIR__ . "/System/Database.php";

header("Content-Type: application/json");

$songName = null;
$artist = null;

$input = json_decode(file_get_contents("php://input"), true);
if (isset($input["songName"])) {
	$songName = $input["songName"];
	$artist = $input["artist"] ?? "";
} elseif (isset($_POST["songName"])) {
	$songName = $_POST["songName"];
	$artist = $_POST["artist"] ?? "";
}

if (!is_string($songName) || strlen(trim($songName)) === 0) {
	echo json_encode(null);
	exit;
}

try {
	// Find the song_id by matching name and artist in media.songs
	$mediaPdo = Database::connect("media");
	$stmt = $mediaPdo->prepare("SELECT `id` FROM `songs` WHERE `name` = ? AND `artist` = ? LIMIT 1");
	$stmt->execute([trim($songName), trim($artist)]);
	$song = $stmt->fetch();

	if (!$song) {
		// Try matching name only
		$stmt = $mediaPdo->prepare("SELECT `id` FROM `songs` WHERE `name` = ? LIMIT 1");
		$stmt->execute([trim($songName)]);
		$song = $stmt->fetch();
	}

	if (!$song) {
		echo json_encode(null);
		exit;
	}

	// Fetch lyrics from musicplayer.lyrics
	$lyricsPdo = Database::connect("musicplayer");
	$stmt = $lyricsPdo->prepare("SELECT `lyrics_json` FROM `lyrics` WHERE `song_id` = ? LIMIT 1");
	$stmt->execute([$song["id"]]);
	$lyrics = $stmt->fetch();

	if ($lyrics && $lyrics["lyrics_json"]) {
		$data = json_decode($lyrics["lyrics_json"], true);
		if (is_array($data)) {
			// Check if already in {timestamp: text} format (keys are timestamps, values are strings)
			$firstKey = array_key_first($data);
			$firstVal = $firstKey !== null ? $data[$firstKey] : null;
			if ($firstVal !== null && is_string($firstVal)) {
				// Already {timestamp: text} — re-key as strings for JSON object output
				$out = new \stdClass();
				foreach ($data as $k => $v) {
					$out->{(string)$k} = $v;
				}
				echo json_encode($out);
			} else {
				// Convert from [{timestamp, text}] array format
				$result = new \stdClass();
				foreach ($data as $entry) {
					if (isset($entry["timestamp"]) && isset($entry["text"])) {
						$result->{(string)$entry["timestamp"]} = $entry["text"];
					}
				}
				echo json_encode($result);
			}
		} else {
			echo json_encode(null);
		}
	} else {
		echo json_encode(null);
	}
} catch (PDOException $e) {
	echo json_encode(null);
}
