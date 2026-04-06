import { Api } from "../Api.mjs";
import { Modal } from "../Modal.mjs";
import { Toast } from "../Toast.mjs";
import { StoreCheckout } from "./StoreCheckout.mjs";

/**
 * Fetches and renders the product catalog in the Store sub-tab.
 */
export class StoreProducts {

	static products = [];
	static loaded = false;
	static onBackToStore = null;

	/**
	 * Loads products from the server and renders into the container.
	 * @param {HTMLElement} container
	 * @param {Function} [onBack] - Called when navigating back from detail view.
	 */
	static async load(container, onBack) {
		StoreProducts.onBackToStore = onBack || null;
		container.innerHTML = "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.5);'>Loading products...</div>";

		try {
			let result = await Api.send("assets/php/store/getProducts.php");
			if (result && result.success) {
				StoreProducts.products = result.products || [];
				StoreProducts.loaded = true;
			} else {
				StoreProducts.products = [];
			}
		} catch (e) {
			StoreProducts.products = [];
		}

		container.innerHTML = StoreProducts.renderGrid();
		StoreProducts.attachGridListeners(container);
	}

	/**
	 * Renders the product grid HTML.
	 * @returns {string}
	 */
	static renderGrid() {
		if (StoreProducts.products.length === 0) {
			return "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.4);'>No products available.</div>";
		}

		let html = "<div class='product-grid'>";
		for (let i = 0; i < StoreProducts.products.length; i++) {
			let p = StoreProducts.products[i];
			let price = StoreProducts.getDisplayPrice(p);

			html += "<div class='product-card' data-product-index='" + i + "'>";
			html += "<div class='product-card-name'>" + StoreProducts.escapeHtml(p.name) + "</div>";
			html += "<div class='product-card-price'>" + price.display;
			if (price.interval) {
				html += " <span class='product-card-interval'>/ " + StoreProducts.escapeHtml(price.interval) + "</span>";
			}
			html += "</div>";
			if (p.description) {
				html += "<div class='product-card-description'>" + StoreProducts.escapeHtml(p.description) + "</div>";
			}
			html += "</div>";
		}
		html += "</div>";
		return html;
	}

	/**
	 * Attaches click listeners to product cards.
	 * @param {HTMLElement} container
	 */
	static attachGridListeners(container) {
		container.addEventListener("click", function (event) {
			let card = event.target.closest(".product-card");
			if (card) {
				let index = parseInt(card.getAttribute("data-product-index"));
				if (!isNaN(index) && index >= 0 && index < StoreProducts.products.length) {
					StoreProducts.openDetail(StoreProducts.products[index]);
				}
			}
		});
	}

	/**
	 * Opens the product detail view.
	 * @param {object} product
	 */
	static openDetail(product) {
		let price = StoreProducts.getDisplayPrice(product);
		let features = StoreProducts.parseFeatures(product);

		let html = "";
		html += "<div class='product-detail'>";
		html += "<button class='product-detail-back' id='product-back'>&larr; Back to Store</button>";
		html += "<h2>" + StoreProducts.escapeHtml(product.name) + "</h2>";

		if (product.description) {
			html += "<p class='product-description'>" + StoreProducts.escapeHtml(product.description) + "</p>";
		}

		html += "<div class='product-detail-price'>" + price.display;
		if (price.interval) {
			html += " <span class='product-card-interval'>/ " + StoreProducts.escapeHtml(price.interval) + "</span>";
		}
		html += "</div>";

		if (features.length > 0) {
			html += "<ul class='product-features'>";
			for (let f of features) {
				html += "<li>" + StoreProducts.escapeHtml(f) + "</li>";
			}
			html += "</ul>";
		}

		// Price selection if multiple prices
		if (product.prices && product.prices.length > 1) {
			html += "<div class='product-price-select'>";
			html += "<label>Select plan:</label>";
			html += "<select id='price-select' class='product-price-dropdown'>";
			for (let i = 0; i < product.prices.length; i++) {
				let p = product.prices[i];
				let label = StoreProducts.formatPrice(p.unit_amount, p.currency);
				if (p.recurring && p.recurring.interval) {
					label += " / " + p.recurring.interval;
				}
				html += "<option value='" + StoreProducts.escapeAttr(p.id) + "'>" + StoreProducts.escapeHtml(label) + "</option>";
			}
			html += "</select>";
			html += "</div>";
		}

		let btnLabel = price.isRecurring ? "Subscribe" : "Purchase";
		html += "<button class='modal-form-btn product-buy-btn' id='product-buy'>" + btnLabel + "</button>";
		html += "</div>";

		Modal.setContent(html);

		setTimeout(function () {
			let backBtn = document.getElementById("product-back");
			if (backBtn) {
				backBtn.addEventListener("click", function () {
					if (StoreProducts.onBackToStore) {
						StoreProducts.onBackToStore();
					}
				});
			}

			let buyBtn = document.getElementById("product-buy");
			if (buyBtn) {
				buyBtn.addEventListener("click", function () {
					let priceId = "";
					let select = document.getElementById("price-select");
					if (select) {
						priceId = select.value;
					} else if (product.prices && product.prices.length > 0) {
						priceId = product.prices[0].id;
					}
					if (priceId.length > 0) {
						let mode = price.isRecurring ? "subscription" : "payment";
						StoreCheckout.startCheckout(priceId, mode);
					} else {
						Toast.error("No price available.");
					}
				});
			}
		}, 0);
	}

	/**
	 * Gets the primary display price for a product.
	 * @param {object} product
	 * @returns {{ display: string, interval: string|null, isRecurring: boolean }}
	 */
	static getDisplayPrice(product) {
		if (!product.prices || product.prices.length === 0) {
			return { display: "Free", interval: null, isRecurring: false };
		}
		let p = product.prices[0];
		let display = StoreProducts.formatPrice(p.unit_amount, p.currency);
		let interval = null;
		let isRecurring = false;
		if (p.recurring && p.recurring.interval) {
			interval = p.recurring.interval;
			isRecurring = true;
		}
		return { display: display, interval: interval, isRecurring: isRecurring };
	}

	/**
	 * Formats cents into a price string.
	 * @param {number} cents
	 * @param {string} currency
	 * @returns {string}
	 */
	static formatPrice(cents, currency) {
		let amount = (cents / 100).toFixed(2);
		let symbol = "$";
		if (currency === "eur") symbol = "\u20AC";
		else if (currency === "gbp") symbol = "\u00A3";
		return symbol + amount;
	}

	/**
	 * Parses features from product metadata.
	 * Expects metadata.features as a comma-separated string.
	 * @param {object} product
	 * @returns {string[]}
	 */
	static parseFeatures(product) {
		let meta = product.metadata || {};
		let featStr = meta.features || "";
		if (featStr.length === 0) return [];
		return featStr.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
	}

	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
