<?php
require_once __DIR__ . "/System/Database.php";
require_once __DIR__ . "/session.php";

header("Content-Type: application/json");

if (!isLoggedIn()) {
    echo json_encode(["success" => false, "message" => "Not logged in."]);
    exit;
}

$user = getCurrentUser();
$action = $_GET["action"] ?? "";

try {
    $pdo = Database::connect("accounts");

    switch ($action) {
        case "list":
            $stmt = $pdo->prepare("SELECT `id`, `name`, `is_active`, `updated_at` FROM `user_layouts` WHERE `user_id` = ? ORDER BY `updated_at` DESC");
            $stmt->execute([$user["id"]]);
            $layouts = $stmt->fetchAll();
            echo json_encode(["success" => true, "layouts" => $layouts]);
            break;

        case "get":
            $id = $_GET["id"] ?? "";
            $stmt = $pdo->prepare("SELECT `id`, `name`, `layout_data`, `is_active` FROM `user_layouts` WHERE `id` = ? AND `user_id` = ?");
            $stmt->execute([$id, $user["id"]]);
            $layout = $stmt->fetch();
            if ($layout) {
                echo json_encode(["success" => true, "layout" => $layout]);
            } else {
                echo json_encode(["success" => false, "message" => "Layout not found."]);
            }
            break;

        case "get_shared":
            // Capability-style access: anyone with a valid layout ID can view
            // the layout. Used by ?layout=<id> deep links so shared URLs
            // resolve for users who don't own the layout. Only returns the
            // fields needed for read-only rendering (no is_active flag).
            $id = $_GET["id"] ?? "";
            $stmt = $pdo->prepare("SELECT `id`, `name`, `layout_data` FROM `user_layouts` WHERE `id` = ?");
            $stmt->execute([$id]);
            $layout = $stmt->fetch();
            if ($layout) {
                echo json_encode(["success" => true, "layout" => $layout]);
            } else {
                echo json_encode(["success" => false, "message" => "Shared layout not found."]);
            }
            break;

        case "save":
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data["id"] ?? null;
            $name = $data["name"] ?? "Untitled Layout";
            $layoutData = json_encode($data["layout_data"]);

            if ($id) {
                $stmt = $pdo->prepare("UPDATE `user_layouts` SET `name` = ?, `layout_data` = ? WHERE `id` = ? AND `user_id` = ?");
                $stmt->execute([$name, $layoutData, $id, $user["id"]]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO `user_layouts` (`user_id`, `name`, `layout_data`) VALUES (?, ?, ?)");
                $stmt->execute([$user["id"], $name, $layoutData]);
                $id = $pdo->lastInsertId();
            }
            echo json_encode(["success" => true, "id" => $id]);
            break;

        case "delete":
            $id = $_GET["id"] ?? "";
            $stmt = $pdo->prepare("DELETE FROM `user_layouts` WHERE `id` = ? AND `user_id` = ?");
            $stmt->execute([$id, $user["id"]]);
            echo json_encode(["success" => true]);
            break;

        case "set_active":
            $id = $_GET["id"] ?? "";
            $active = (int)($_GET["active"] ?? 0);
            
            $pdo->beginTransaction();
            // Deactivate all first
            $stmt = $pdo->prepare("UPDATE `user_layouts` SET `is_active` = 0 WHERE `user_id` = ?");
            $stmt->execute([$user["id"]]);
            
            if ($active && $id) {
                $stmt = $pdo->prepare("UPDATE `user_layouts` SET `is_active` = 1 WHERE `id` = ? AND `user_id` = ?");
                $stmt->execute([$id, $user["id"]]);
            }
            $pdo->commit();
            echo json_encode(["success" => true]);
            break;

        default:
            echo json_encode(["success" => false, "message" => "Invalid action."]);
            break;
    }
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
