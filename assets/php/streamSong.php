<?php
require_once __DIR__ . "/System/Database.php";

$songId = $_GET["id"] ?? null;

if (!is_string($songId) || strlen($songId) === 0) {
	http_response_code(400);
	exit("Missing song id.");
}

$musicDir = "A:/wamp64/www/WebRoot/www/files/Music/";

try {
	$pdo = Database::connect("media");

	// Try song_files table first (for uploaded songs)
	$fileData = null;
	try {
		$stmt = $pdo->prepare("
			SELECT `file_blob`, `mime_type`, `file_size_bytes`
			FROM `song_files`
			WHERE `song_id` = ?
			LIMIT 1
		");
		$stmt->execute([$songId]);
		$fileData = $stmt->fetch();
	} catch (PDOException $e) {
		// Table may not exist; fall through to disk lookup
	}

	if ($fileData && $fileData["file_blob"] !== null) {
		// Stream from blob
		$mimeType = $fileData["mime_type"] ?? "audio/mpeg";
		$fileSize = $fileData["file_size_bytes"] ?? strlen($fileData["file_blob"]);
		streamData($fileData["file_blob"], $mimeType, $fileSize);
		exit;
	}

	// Fall back to disk: look up song metadata and find matching file
	$stmt = $pdo->prepare("SELECT `name`, `artist` FROM `songs` WHERE `id` = ? LIMIT 1");
	$stmt->execute([$songId]);
	$song = $stmt->fetch();

	if (!$song) {
		http_response_code(404);
		exit("Song not found.");
	}

	$filePath = findSongFile($musicDir, $song["name"], $song["artist"] ?? "");

	if ($filePath === null) {
		http_response_code(404);
		exit("Song file not found on disk.");
	}

	streamFile($filePath);

} catch (PDOException $e) {
	http_response_code(500);
	exit("Server error.");
}

/**
 * Finds a song file on disk by matching name and artist against filenames.
 * @param string $dir The music root directory.
 * @param string $name The song name from the database.
 * @param string $artist The artist name from the database.
 * @return string|null The full file path, or null if not found.
 */
function findSongFile(string $dir, string $name, string $artist): ?string {
	$extensions = ["mp3", "m4a", "mp4", "flac", "wav"];

	// Normalize search terms for comparison
	$nameLower = mb_strtolower(trim($name));
	$artistLower = mb_strtolower(trim($artist));

	// Remove common suffixes in DB names that aren't in filenames
	$nameClean = preg_replace('/\s*\(.*?\)\s*$/', '', $nameLower);

	$bestMatch = null;
	$bestScore = 0;

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
		RecursiveIteratorIterator::LEAVES_ONLY
	);

	foreach ($iterator as $file) {
		if (!$file->isFile()) continue;

		$ext = strtolower($file->getExtension());
		if (!in_array($ext, $extensions, true)) continue;

		$filename = $file->getBasename('.' . $ext);
		$filenameLower = mb_strtolower($filename);

		// Score based on how well the filename matches
		$score = 0;

		// Exact name match in filename
		if (strpos($filenameLower, $nameLower) !== false) {
			$score += 10;
		} elseif (strpos($filenameLower, $nameClean) !== false) {
			$score += 8;
		}

		// Artist match in filename
		if (strlen($artistLower) > 0 && strpos($filenameLower, $artistLower) !== false) {
			$score += 5;
		}

		// Artist match in path (folder name)
		if (strlen($artistLower) > 0) {
			$pathLower = mb_strtolower($file->getPathname());
			if (strpos($pathLower, $artistLower) !== false) {
				$score += 3;
			}
		}

		if ($score > $bestScore) {
			$bestScore = $score;
			$bestMatch = $file->getPathname();
		}
	}

	// Require at least a name match
	return $bestScore >= 8 ? $bestMatch : null;
}

/**
 * Streams a file from disk with Range support.
 * @param string $filePath The full path to the audio file.
 */
function streamFile(string $filePath): void {
	$fileSize = filesize($filePath);
	$finfo = finfo_open(FILEINFO_MIME_TYPE);
	$mimeType = finfo_file($finfo, $filePath);
	finfo_close($finfo);
	if (!$mimeType || $mimeType === "application/octet-stream") {
		$mimeType = "audio/mpeg";
	}

	$start = 0;
	$end = $fileSize - 1;
	$statusCode = 200;

	if (isset($_SERVER["HTTP_RANGE"])) {
		$statusCode = 206;
		$range = $_SERVER["HTTP_RANGE"];
		if (preg_match("/bytes=(\d*)-(\d*)/", $range, $matches)) {
			$start = $matches[1] !== "" ? (int)$matches[1] : 0;
			$end = $matches[2] !== "" ? (int)$matches[2] : $fileSize - 1;
		}
		if ($start > $end || $start >= $fileSize) {
			http_response_code(416);
			header("Content-Range: bytes */{$fileSize}");
			exit;
		}
	}

	$length = $end - $start + 1;
	$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
	$filename = "song." . ($ext ?: "mp3");

	http_response_code($statusCode);
	header("Content-Type: {$mimeType}");
	header("Content-Length: {$length}");
	header("Accept-Ranges: bytes");
	header("Content-Disposition: inline; filename=\"{$filename}\"");
	header("Cache-Control: public, max-age=86400");

	if ($statusCode === 206) {
		header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
	}

	$fp = fopen($filePath, "rb");
	if ($start > 0) fseek($fp, $start);
	$remaining = $length;
	$bufferSize = 8192;
	while ($remaining > 0 && !feof($fp)) {
		$read = min($bufferSize, $remaining);
		echo fread($fp, $read);
		$remaining -= $read;
		flush();
	}
	fclose($fp);
}

/**
 * Streams blob data from memory with Range support.
 * @param string $blob The binary audio data.
 * @param string $mimeType The MIME type.
 * @param int $fileSize The total size in bytes.
 */
function streamData(string $blob, string $mimeType, int $fileSize): void {
	$start = 0;
	$end = $fileSize - 1;
	$statusCode = 200;

	if (isset($_SERVER["HTTP_RANGE"])) {
		$statusCode = 206;
		$range = $_SERVER["HTTP_RANGE"];
		if (preg_match("/bytes=(\d*)-(\d*)/", $range, $matches)) {
			$start = $matches[1] !== "" ? (int)$matches[1] : 0;
			$end = $matches[2] !== "" ? (int)$matches[2] : $fileSize - 1;
		}
		if ($start > $end || $start >= $fileSize) {
			http_response_code(416);
			header("Content-Range: bytes */{$fileSize}");
			exit;
		}
	}

	$length = $end - $start + 1;
	$filename = "song." . (str_contains($mimeType, "mp4") ? "m4a" : "mp3");

	http_response_code($statusCode);
	header("Content-Type: {$mimeType}");
	header("Content-Length: {$length}");
	header("Accept-Ranges: bytes");
	header("Content-Disposition: inline; filename=\"{$filename}\"");
	header("Cache-Control: public, max-age=86400");

	if ($statusCode === 206) {
		header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
	}

	echo substr($blob, $start, $length);
}
