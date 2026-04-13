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
		html += "<div id='product-tax-line' style='font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;'></div>";

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
				if (p.interval_unit) {
					label += " / " + p.interval_unit.toLowerCase();
				} else if (p.recurring && p.recurring.interval) {
					label += " / " + p.recurring.interval;
				}
				html += "<option value='" + StoreProducts.escapeAttr(p.id) + "'>" + StoreProducts.escapeHtml(label) + "</option>";
			}
			html += "</select>";
			html += "</div>";
		}

		// Coupon code input
		html += "<div class='product-coupon-wrap' style='margin-top:12px;'>";
		html += "<label style='font-size:13px;color:rgba(255,255,255,0.6);'>Coupon Code</label>";
		html += "<div style='display:flex;gap:8px;margin-top:4px;'>";
		html += "<input type='text' id='coupon-code' placeholder='Enter code' style='flex:1;font-size:13px;padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;' />";
		html += "<button class='modal-form-btn' id='coupon-apply' style='width:auto;padding:6px 14px;font-size:12px;'>Apply</button>";
		html += "</div>";
		html += "<div id='coupon-message' style='font-size:12px;margin-top:4px;min-height:16px;'></div>";
		html += "</div>";

		let btnLabel = price.isRecurring ? "Subscribe" : "Purchase";
		html += "<button class='modal-form-btn product-buy-btn' id='product-buy'>" + btnLabel + "</button>";
		html += "</div>";

		Modal.setContent(html);

		// Fetch and display tax info
		Api.get("assets/php/store/getTaxRate.php").then(function (taxResult) {
			let taxLine = document.getElementById("product-tax-line");
			if (taxLine && taxResult && taxResult.success && taxResult.tax_rate) {
				let pct = parseFloat(taxResult.tax_rate.percentage);
				if (pct > 0) {
					taxLine.textContent = "+ " + pct.toFixed(2) + "% tax applied at checkout";
				}
			}
		}).catch(function () {});

		setTimeout(function () {
			let backBtn = document.getElementById("product-back");
			if (backBtn) {
				backBtn.addEventListener("click", function () {
					if (StoreProducts.onBackToStore) {
						StoreProducts.onBackToStore();
					}
				});
			}

			// Coupon apply button
			let couponApplyBtn = document.getElementById("coupon-apply");
			if (couponApplyBtn) {
				couponApplyBtn.addEventListener("click", async function () {
					let codeInput = document.getElementById("coupon-code");
					let msgEl = document.getElementById("coupon-message");
					let code = (codeInput?.value || "").trim();
					if (code.length === 0) {
						if (msgEl) { msgEl.textContent = "Enter a coupon code."; msgEl.style.color = "rgba(255,80,80,0.8)"; }
						return;
					}
					if (msgEl) { msgEl.textContent = "Validating..."; msgEl.style.color = "rgba(255,255,255,0.5)"; }
					try {
						let result = await Api.send("assets/php/store/validateCoupon.php", { "code": code });
						if (result && result.success && result.coupon) {
							let c = result.coupon;
							let discountText = "";
							if (c.percent_off !== null) {
								discountText = c.percent_off + "% off";
							} else if (c.amount_off !== null) {
								discountText = "$" + (c.amount_off / 100).toFixed(2) + " off";
							}
							if (msgEl) { msgEl.textContent = "Coupon applied: " + discountText; msgEl.style.color = "rgba(80,220,80,0.9)"; }
							codeInput.dataset.validated = "true";
						} else {
							if (msgEl) { msgEl.textContent = result.message || "Invalid coupon."; msgEl.style.color = "rgba(255,80,80,0.8)"; }
							codeInput.dataset.validated = "";
						}
					} catch (e) {
						if (msgEl) { msgEl.textContent = "Error validating coupon."; msgEl.style.color = "rgba(255,80,80,0.8)"; }
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
						let couponInput = document.getElementById("coupon-code");
						let couponCode = "";
						if (couponInput && couponInput.dataset.validated === "true") {
							couponCode = couponInput.value.trim();
						}
						StoreCheckout.startCheckout(priceId, mode, couponCode);
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
		// Support both local DB format (interval_unit) and legacy Stripe format (recurring.interval)
		if (p.interval_unit) {
			interval = p.interval_unit.toLowerCase();
			isRecurring = true;
		} else if (p.recurring && p.recurring.interval) {
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

	/** Human-readable labels for feature flag keys. */
	static featureLabels = {
		"file_upload": "File Upload",
		"cloud_storage": "Cloud Storage",
		"creator_badge": "Creator Badge",
		"playlists": "Playlists",
		"url_shared_playlists": "Shared Playlist URLs",
		"custom_backgrounds": "Custom Backgrounds",
		"custom_fonts": "Custom Fonts",
		"lyrics_display": "Lyrics Display",
		"lyrics_editing": "Lyrics Editing",
		"song_name_customization": "Song Name Customization",
		"layout_designer": "Layout Designer",
		"no_ads": "No Ads"
	};

	/**
	 * Parses features from the product's feature_flags column.
	 * Falls back to metadata.features for backward compatibility.
	 * @param {object} product
	 * @returns {string[]} Human-readable feature labels.
	 */
	static parseFeatures(product) {
		let flagStr = product.feature_flags || "";
		// Fallback: legacy metadata.features
		if (!flagStr) {
			let meta = product.metadata || {};
			if (typeof meta === "string") {
				try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
			}
			flagStr = (meta && meta.features) ? meta.features : "";
		}
		if (flagStr.length === 0) return [];
		return flagStr.split(",")
			.map(function (s) { return s.trim(); })
			.filter(function (s) { return s.length > 0; })
			.map(function (key) { return StoreProducts.featureLabels[key] || key.replace(/_/g, " "); });
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
