<?php
require_once __DIR__ . "/System/SchemaSetup.php";

header("Content-Type: application/json");

try {
    $setup = new SchemaSetup();
    $results = $setup->run();
    echo json_encode(["success" => true, "results" => $results]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
