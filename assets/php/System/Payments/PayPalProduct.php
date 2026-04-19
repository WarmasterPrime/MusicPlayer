<?php
/**
 * Manages products and billing plans in the local database and optionally syncs to PayPal.
 * Products and prices are stored locally in store.products and store.prices tables.
 * PayPal Catalog Products and Billing Plans are created when syncing.
 */

require_once __DIR__ . "/PayPal.php";
require_once __DIR__ . "/PayPalApi.php";
require_once __DIR__ . "/../Database.php";

class PayPalProduct {

	/**
	 * Creates a product in the local database.
	 * Optionally syncs to PayPal Catalog Products API.
	 *
	 * @param string $name Product name.
	 * @param string $description Product description.
	 * @param string|null $metadata JSON metadata string.
	 * @param bool $syncToPayPal Whether to create in PayPal too.
	 * @param string|null $featureFlags Comma-separated FeatureGate keys.
	 * @return array Product record or { error }
	 */
	public static function create(string $name, string $description = "", ?string $metadata = null, bool $syncToPayPal = true, ?string $featureFlags = null): array {
		$pdo = Database::connect("store");
		$id = Database::generateId(255);
		$paypalProductId = null;

		if ($syncToPayPal) {
			PayPalApi::init(PayPal::defaultEnv());
			$ppResult = PayPalApi::post("v1/catalogs/products", [
				"name" => $name,
				"description" => $description,
				"type" => "SERVICE",
				"category" => "SOFTWARE"
			]);

			if (isset($ppResult["_error"])) {
				$msg = $ppResult["message"] ?? ($ppResult["details"][0]["description"] ?? "Failed to create PayPal product.");
				return ["error" => $msg];
			}

			$paypalProductId = $ppResult["id"] ?? null;
		}

		$stmt = $pdo->prepare("
			INSERT INTO `products` (`id`, `paypal_product_id`, `name`, `description`, `active`, `metadata`, `feature_flags`)
			VALUES (?, ?, ?, ?, 1, ?, ?)
		");
		$stmt->execute([$id, $paypalProductId, $name, $description, $metadata, $featureFlags]);

		return [
			"id" => $id,
			"paypal_product_id" => $paypalProductId,
			"name" => $name,
			"description" => $description,
			"active" => 1,
			"feature_flags" => $featureFlags
		];
	}

	/**
	 * Updates a product in the local database and optionally in PayPal.
	 *
	 * @param string $productId Local product ID.
	 * @param array $fields Associative array of fields to update.
	 * @param bool $syncToPayPal Whether to update in PayPal too.
	 * @return array Updated product or { error }
	 */
	public static function update(string $productId, array $fields, bool $syncToPayPal = true): array {
		$pdo = Database::connect("store");

		$stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
		$stmt->execute([$productId]);
		$product = $stmt->fetch();

		if (!$product) {
			return ["error" => "Product not found."];
		}

		$sets = [];
		$values = [];

		if (isset($fields["name"])) {
			$sets[] = "`name` = ?";
			$values[] = $fields["name"];
		}
		if (isset($fields["description"])) {
			$sets[] = "`description` = ?";
			$values[] = $fields["description"];
		}
		if (isset($fields["active"])) {
			$sets[] = "`active` = ?";
			$values[] = $fields["active"] ? 1 : 0;
		}
		if (isset($fields["metadata"])) {
			$sets[] = "`metadata` = ?";
			$values[] = is_string($fields["metadata"]) ? $fields["metadata"] : json_encode($fields["metadata"]);
		}
		if (array_key_exists("feature_flags", $fields)) {
			$sets[] = "`feature_flags` = ?";
			$values[] = $fields["feature_flags"];
		}

		if (empty($sets)) {
			return ["error" => "No fields to update."];
		}

		$values[] = $productId;
		$stmt = $pdo->prepare("UPDATE `products` SET " . implode(", ", $sets) . " WHERE `id` = ?");
		$stmt->execute($values);

		// Sync to PayPal
		if ($syncToPayPal && !empty($product["paypal_product_id"])) {
			PayPalApi::init(PayPal::defaultEnv());
			$patchOps = [];
			if (isset($fields["description"])) {
				$patchOps[] = ["op" => "replace", "path" => "/description", "value" => $fields["description"]];
			}
			if (!empty($patchOps)) {
				PayPalApi::patch("v1/catalogs/products/" . $product["paypal_product_id"], $patchOps);
			}
		}

		$stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
		$stmt->execute([$productId]);
		return $stmt->fetch() ?: ["error" => "Product not found after update."];
	}

	/**
	 * Gets a single product with its prices.
	 */
	public static function getWithPrices(string $productId): array {
		$pdo = Database::connect("store");

		$stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
		$stmt->execute([$productId]);
		$product = $stmt->fetch();

		if (!$product) {
			return ["error" => "Product not found."];
		}

		$stmt = $pdo->prepare("SELECT * FROM `prices` WHERE `product_id` = ? ORDER BY `unit_amount` ASC");
		$stmt->execute([$productId]);
		$product["prices"] = $stmt->fetchAll();

		return $product;
	}

	/**
	 * Lists all products with their prices.
	 */
	public static function listAll(bool $activeOnly = true): array {
		$pdo = Database::connect("store");

		$sql = "SELECT * FROM `products`";
		if ($activeOnly) $sql .= " WHERE `active` = 1";
		$sql .= " ORDER BY `created_at` ASC";
		$products = $pdo->query($sql)->fetchAll();

		$priceSql = "SELECT * FROM `prices`";
		if ($activeOnly) $priceSql .= " WHERE `active` = 1";
		$priceSql .= " ORDER BY `unit_amount` ASC";
		$allPrices = $pdo->query($priceSql)->fetchAll();

		$pricesByProduct = [];
		foreach ($allPrices as $price) {
			$pid = $price["product_id"];
			if (!isset($pricesByProduct[$pid])) $pricesByProduct[$pid] = [];
			$pricesByProduct[$pid][] = $price;
		}

		foreach ($products as &$product) {
			$product["prices"] = $pricesByProduct[$product["id"]] ?? [];
		}

		return $products;
	}

	/**
	 * Creates a price/billing plan for a product.
	 * Stored locally and optionally synced to PayPal as a Billing Plan.
	 */
	public static function createPrice(
		string $productId,
		int $unitAmount,
		string $currency = "USD",
		string $intervalUnit = "MONTH",
		int $intervalCount = 1,
		bool $syncToPayPal = true
	): array {
		$pdo = Database::connect("store");

		$stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
		$stmt->execute([$productId]);
		$product = $stmt->fetch();

		if (!$product) {
			return ["error" => "Product not found."];
		}

		$id = Database::generateId(255);
		$paypalPlanId = null;

		if ($syncToPayPal && !empty($product["paypal_product_id"])) {
			PayPalApi::init(PayPal::defaultEnv());
			$amountStr = number_format($unitAmount / 100, 2, ".", "");

			$planData = [
				"product_id" => $product["paypal_product_id"],
				"name" => $product["name"] . " - " . strtoupper($currency) . " " . $amountStr . "/" . strtolower($intervalUnit),
				"billing_cycles" => [
					[
						"frequency" => [
							"interval_unit" => strtoupper($intervalUnit),
							"interval_count" => $intervalCount
						],
						"tenure_type" => "REGULAR",
						"sequence" => 1,
						"total_cycles" => 0,
						"pricing_scheme" => [
							"fixed_price" => [
								"value" => $amountStr,
								"currency_code" => strtoupper($currency)
							]
						]
					]
				],
				"payment_preferences" => [
					"auto_bill_outstanding" => true,
					"payment_failure_threshold" => 3
				]
			];

			$ppResult = PayPalApi::post("v1/billing/plans", $planData);

			if (isset($ppResult["_error"])) {
				$msg = $ppResult["message"] ?? ($ppResult["details"][0]["description"] ?? "Failed to create PayPal billing plan.");
				return ["error" => $msg];
			}

			$paypalPlanId = $ppResult["id"] ?? null;
		}

		$stmt = $pdo->prepare("
			INSERT INTO `prices` (`id`, `product_id`, `paypal_plan_id`, `unit_amount`, `currency`, `interval_unit`, `interval_count`, `active`)
			VALUES (?, ?, ?, ?, ?, ?, ?, 1)
		");
		$stmt->execute([$id, $productId, $paypalPlanId, $unitAmount, strtolower($currency), strtoupper($intervalUnit), $intervalCount]);

		return [
			"id" => $id,
			"product_id" => $productId,
			"paypal_plan_id" => $paypalPlanId,
			"unit_amount" => $unitAmount,
			"currency" => strtolower($currency),
			"interval_unit" => strtoupper($intervalUnit),
			"interval_count" => $intervalCount,
			"active" => 1
		];
	}

	/**
	 * Updates a price in the local database.
	 * If the price amount changes and the price has a PayPal plan, the old plan is
	 * deactivated and a new one is created with the updated amount.
	 *
	 * @param string $priceId Local price ID.
	 * @param array $fields Fields to update (unit_amount, currency, interval_unit, interval_count, active).
	 * @param bool $syncToPayPal Whether to sync plan changes to PayPal.
	 * @return array Updated price or { error }
	 */
	public static function updatePrice(string $priceId, array $fields, bool $syncToPayPal = true): array {
		$pdo = Database::connect("store");

		$stmt = $pdo->prepare("SELECT p.*, pr.`name` AS `product_name`, pr.`paypal_product_id` FROM `prices` p JOIN `products` pr ON p.`product_id` = pr.`id` WHERE p.`id` = ?");
		$stmt->execute([$priceId]);
		$price = $stmt->fetch();

		if (!$price) {
			return ["error" => "Price not found."];
		}

		$sets = [];
		$values = [];
		$amountChanged = false;
		$newAmount = (int)$price["unit_amount"];
		$newCurrency = $price["currency"];
		$newIntervalUnit = $price["interval_unit"];
		$newIntervalCount = (int)$price["interval_count"];

		if (isset($fields["unit_amount"])) {
			$newAmount = (int)$fields["unit_amount"];
			if ($newAmount !== (int)$price["unit_amount"]) $amountChanged = true;
			$sets[] = "`unit_amount` = ?";
			$values[] = $newAmount;
		}
		if (isset($fields["currency"])) {
			$newCurrency = strtolower($fields["currency"]);
			if ($newCurrency !== $price["currency"]) $amountChanged = true;
			$sets[] = "`currency` = ?";
			$values[] = $newCurrency;
		}
		if (isset($fields["interval_unit"])) {
			$newIntervalUnit = strtoupper($fields["interval_unit"]);
			if ($newIntervalUnit !== $price["interval_unit"]) $amountChanged = true;
			$sets[] = "`interval_unit` = ?";
			$values[] = $newIntervalUnit;
		}
		if (isset($fields["interval_count"])) {
			$newIntervalCount = (int)$fields["interval_count"];
			if ($newIntervalCount !== (int)$price["interval_count"]) $amountChanged = true;
			$sets[] = "`interval_count` = ?";
			$values[] = $newIntervalCount;
		}
		if (isset($fields["active"])) {
			$sets[] = "`active` = ?";
			$values[] = $fields["active"] ? 1 : 0;
		}

		if (empty($sets)) {
			return ["error" => "No fields to update."];
		}

		// If pricing changed and there's a PayPal plan, deactivate old and create new
		$newPlanId = $price["paypal_plan_id"];
		if ($amountChanged && $syncToPayPal && !empty($price["paypal_product_id"])) {
			PayPalApi::init(PayPal::defaultEnv());

			// Deactivate old plan
			if (!empty($price["paypal_plan_id"])) {
				PayPalApi::post("v1/billing/plans/" . $price["paypal_plan_id"] . "/deactivate");
			}

			// Create new plan with updated pricing
			$amountStr = number_format($newAmount / 100, 2, ".", "");
			$planData = [
				"product_id" => $price["paypal_product_id"],
				"name" => $price["product_name"] . " - " . strtoupper($newCurrency) . " " . $amountStr . "/" . strtolower($newIntervalUnit),
				"billing_cycles" => [
					[
						"frequency" => [
							"interval_unit" => strtoupper($newIntervalUnit),
							"interval_count" => $newIntervalCount
						],
						"tenure_type" => "REGULAR",
						"sequence" => 1,
						"total_cycles" => 0,
						"pricing_scheme" => [
							"fixed_price" => [
								"value" => $amountStr,
								"currency_code" => strtoupper($newCurrency)
							]
						]
					]
				],
				"payment_preferences" => [
					"auto_bill_outstanding" => true,
					"payment_failure_threshold" => 3
				]
			];

			$ppResult = PayPalApi::post("v1/billing/plans", $planData);

			if (isset($ppResult["_error"])) {
				$msg = $ppResult["message"] ?? ($ppResult["details"][0]["description"] ?? "Failed to create replacement PayPal billing plan.");
				return ["error" => $msg];
			}

			$newPlanId = $ppResult["id"] ?? $price["paypal_plan_id"];
			$sets[] = "`paypal_plan_id` = ?";
			$values[] = $newPlanId;
		}

		$values[] = $priceId;
		$stmt = $pdo->prepare("UPDATE `prices` SET " . implode(", ", $sets) . " WHERE `id` = ?");
		$stmt->execute($values);

		// Return updated price
		$stmt = $pdo->prepare("SELECT * FROM `prices` WHERE `id` = ?");
		$stmt->execute([$priceId]);
		return $stmt->fetch() ?: ["error" => "Price not found after update."];
	}

	/**
	 * Deactivates a price (soft delete).
	 */
	public static function deactivatePrice(string $priceId): array {
		$pdo = Database::connect("store");

		$stmt = $pdo->prepare("SELECT * FROM `prices` WHERE `id` = ?");
		$stmt->execute([$priceId]);
		$price = $stmt->fetch();

		if (!$price) {
			return ["error" => "Price not found."];
		}

		$stmt = $pdo->prepare("UPDATE `prices` SET `active` = 0 WHERE `id` = ?");
		$stmt->execute([$priceId]);

		if (!empty($price["paypal_plan_id"])) {
			PayPalApi::init(PayPal::defaultEnv());
			PayPalApi::post("v1/billing/plans/" . $price["paypal_plan_id"] . "/deactivate");
		}

		return ["success" => true];
	}
}
