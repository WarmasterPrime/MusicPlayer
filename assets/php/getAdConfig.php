<?php
/**
 * Returns ad configuration for the client.
 * Subscribers with the no_ads feature get ads disabled.
 * Non-logged-in users always see ads.
 */

require_once __DIR__ . "/session.php";
require_once __DIR__ . "/System/FeatureGate.php";

header("Content-Type: application/json");

$iniPath = "A:/Server/keys/monetag.ini";
$config = file_exists($iniPath) ? parse_ini_file($iniPath, true) : [];
$env = "development";
$section = $config[$env] ?? $config["production"] ?? [];

$zoneId = $section["zone_id"] ?? "";

$showAds = true;

if (isLoggedIn()) {
	$user = getCurrentUser();
	if ($user && isset($user["id"])) {
		$result = FeatureGate::check($user["id"], "no_ads");
		if ($result["allowed"]) {
			$showAds = false;
		}
	}
}

echo json_encode([
	"success" => true,
	"show_ads" => $showAds,
	"provider" => "monetag",
	"zone_id" => $showAds ? $zoneId : ""
]);
