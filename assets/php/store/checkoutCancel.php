<?php
/**
 * Handles the PayPal checkout cancel redirect.
 * Simply redirects back to the app with cancel status.
 */

$baseUrl = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] === "on" ? "https" : "http")
	. "://" . ($_SERVER["HTTP_HOST"] ?? "localhost");
$scriptDir = str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"]));
$basePath = dirname(dirname(dirname($scriptDir)));
if ($basePath === "/" || $basePath === "\\" || $basePath === ".") $basePath = "";
$appUrl = rtrim($baseUrl . $basePath, "/");

header("Location: " . $appUrl . "/index.html?checkout=cancel");
exit;
