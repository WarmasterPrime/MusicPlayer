<?php
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

logoutUser();

echo json_encode([
	"success" => true,
	"message" => "Logged out."
]);
