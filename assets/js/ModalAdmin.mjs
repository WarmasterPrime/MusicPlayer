import { Modal } from "./Modal.mjs";
import { Api } from "./Api.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";

/**
 * Admin panel with sub-tabs: Products, Users, Coupons, Tax, Transactions.
 * Requires StoreAdmin or UserAdmin authority.
 */
export class ModalAdmin {

	static activeSubTab = "products";
	static productCache = [];
	static couponCache = [];

	/** All authority flags available in the SET column. */
	static authorityFlags = [
		{ key: "DbSelect", group: "Database" },
		{ key: "DbInsert", group: "Database" },
		{ key: "DbAlter", group: "Database" },
		{ key: "ClientViewPublic", group: "Client View" },
		{ key: "ClientViewUnlisted", group: "Client View" },
		{ key: "ClientViewPrivate", group: "Client View" },
		{ key: "ClientViewOwn", group: "Client View" },
		{ key: "ClientModifyPublic", group: "Client Modify" },
		{ key: "ClientModifyUnlisted", group: "Client Modify" },
		{ key: "ClientModifyPrivate", group: "Client Modify" },
		{ key: "ClientModifyOwn", group: "Client Modify" },
		{ key: "ServerViewPublic", group: "Server View" },
		{ key: "ServerViewUnlisted", group: "Server View" },
		{ key: "ServerViewPrivate", group: "Server View" },
		{ key: "StoreAdmin", group: "Admin" },
		{ key: "UserAdmin", group: "Admin" }
	];

	/** All feature keys that can be granted to users. */
	static featureKeys = [
		{ key: "file_upload", group: "Content" },
		{ key: "lyrics_display", group: "Content" },
		{ key: "lyrics_editing", group: "Content" },
		{ key: "song_name_customization", group: "Content" },
		{ key: "playlists", group: "Playlists" },
		{ key: "url_shared_playlists", group: "Playlists" },
		{ key: "cloud_storage", group: "Storage" },
		{ key: "custom_fonts", group: "Appearance" },
		{ key: "custom_backgrounds", group: "Appearance" },
		{ key: "creator_badge", group: "Misc" }
	];

	static render() {
		if (!Session.isLoggedIn()) {
			return "<div style='text-align:center;padding:40px;color:var(--text-muted,rgba(255,255,255,0.5));'>Please log in.</div>";
		}
		let html = "";
		html += "<div class='store-subtabs'>";
		html += "<button class='store-subtab" + (ModalAdmin.activeSubTab === "products" ? " active" : "") + "' data-admin-tab='products'>Products</button>";
		html += "<button class='store-subtab" + (ModalAdmin.activeSubTab === "users" ? " active" : "") + "' data-admin-tab='users'>Users</button>";
		html += "<button class='store-subtab" + (ModalAdmin.activeSubTab === "coupons" ? " active" : "") + "' data-admin-tab='coupons'>Coupons</button>";
		html += "<button class='store-subtab" + (ModalAdmin.activeSubTab === "tax" ? " active" : "") + "' data-admin-tab='tax'>Tax</button>";
		html += "<button class='store-subtab" + (ModalAdmin.activeSubTab === "transactions" ? " active" : "") + "' data-admin-tab='transactions'>Transactions</button>";
		html += "</div>";
		html += "<div id='admin-content'></div>";
		return html;
	}

	static onMount() {
		let tabs = document.querySelectorAll("[data-admin-tab]");
		for (let i = 0; i < tabs.length; i++) {
			tabs[i].addEventListener("click", function () {
				ModalAdmin.activeSubTab = this.getAttribute("data-admin-tab");
				let all = document.querySelectorAll("[data-admin-tab]");
				for (let j = 0; j < all.length; j++) all[j].classList.remove("active");
				this.classList.add("active");
				ModalAdmin.renderSubTab(ModalAdmin.activeSubTab);
			});
		}
		ModalAdmin.renderSubTab(ModalAdmin.activeSubTab);
	}

	static renderSubTab(key) {
		let c = document.getElementById("admin-content");
		if (!c) return;
		if (key === "products") ModalAdmin.loadProducts(c);
		else if (key === "users") ModalAdmin.loadUsers(c);
		else if (key === "coupons") ModalAdmin.loadCoupons(c);
		else if (key === "tax") ModalAdmin.loadTaxRates(c);
		else if (key === "transactions") ModalAdmin.loadTransactions(c);
	}

	// ═══════════════════════════════════════════════
	//  PRODUCTS
	// ═══════════════════════════════════════════════

	static async loadProducts(container) {
		container.innerHTML = "<div class='admin-loading'>Loading products...</div>";
		try {
			let result = await Api.get("assets/php/store/getProducts.php?include_inactive=1");
			if (result.success) {
				ModalAdmin.productCache = result.products || [];
				ModalAdmin.renderProducts(container, ModalAdmin.productCache);
			} else {
				container.innerHTML = "<div class='admin-error'>Failed to load products.</div>";
			}
		} catch (e) {
			container.innerHTML = "<div class='admin-error'>Error loading products.</div>";
		}
	}

	static renderProducts(container, products) {
		let html = "<div style='margin-bottom:16px;'><button class='modal-form-btn' id='admin-create-product' style='width:auto;padding:6px 16px;font-size:13px;'>+ Create Product</button></div>";
		if (products.length === 0) {
			html += "<div class='admin-muted'>No products found.</div>";
		} else {
			html += "<div class='admin-table-wrap'><table class='billing-table'><thead><tr><th>Name</th><th>Active</th><th>Prices</th><th>Actions</th></tr></thead><tbody>";
			for (let i = 0; i < products.length; i++) {
				let p = products[i];
				let priceInfo = ModalAdmin.formatPrices(p.prices);
				html += "<tr>";
				html += "<td>" + ModalAdmin.escapeHtml(p.name) + "<div class='admin-id'>" + ModalAdmin.escapeHtml(p.id) + "</div></td>";
				html += "<td>" + (p.active != 0 ? "<span class='admin-badge-active'>Active</span>" : "<span class='admin-badge-inactive'>Inactive</span>") + "</td>";
				html += "<td style='font-size:12px;'>" + ModalAdmin.escapeHtml(priceInfo) + "</td>";
				html += "<td><button class='admin-action-btn' data-edit-product='" + i + "'>Edit</button></td>";
				html += "</tr>";
			}
			html += "</tbody></table></div>";
		}
		container.innerHTML = html;
		document.getElementById("admin-create-product")?.addEventListener("click", function () { ModalAdmin.showCreateProductForm(); });
		let editBtns = container.querySelectorAll("[data-edit-product]");
		for (let i = 0; i < editBtns.length; i++) {
			editBtns[i].addEventListener("click", function () {
				let idx = parseInt(this.getAttribute("data-edit-product"), 10);
				ModalAdmin.showEditProductForm(ModalAdmin.productCache[idx]);
			});
		}
	}

	static showCreateProductForm() {
		let container = document.getElementById("admin-content");
		if (!container) return;
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back'>Back</button>";
		html += "<div class='modal-form-title' style='font-size:16px;'>Create Product</div>";
		html += "<div class='modal-form-group'><label>Name</label><input type='text' id='admin-product-name' /></div>";
		html += "<div class='modal-form-group'><label>Description</label><textarea id='admin-product-desc' rows='3'></textarea></div>";
		html += "<div class='modal-form-group'><label>Features (comma-separated metadata)</label><input type='text' id='admin-product-features' placeholder='feature1,feature2' /></div>";
		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:12px 0;' />";
		html += "<div class='modal-form-title' style='font-size:14px;'>Initial Price</div>";
		html += "<div class='modal-form-group'><label>Amount ($)</label><input type='number' id='admin-price-amount' value='9.99' step='0.01' min='0.01' /></div>";
		html += "<div class='modal-form-group'><label>Currency</label><input type='text' id='admin-price-currency' value='usd' /></div>";
		html += "<div class='modal-form-group'><label>Interval</label><select id='admin-price-interval'><option value='month'>Monthly</option><option value='year'>Yearly</option></select></div>";
		html += "<button class='modal-form-btn' id='admin-product-submit'>Create</button>";
		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;
		document.getElementById("admin-back").addEventListener("click", function () { ModalAdmin.renderSubTab("products"); });
		document.getElementById("admin-product-submit").addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let name = document.getElementById("admin-product-name")?.value || "";
			if (!name.trim()) { ModalAdmin.setMsg(msg, "Name required.", "error"); return; }
			let metadata = {};
			let features = (document.getElementById("admin-product-features")?.value || "").trim();
			if (features) metadata["features"] = features;
			ModalAdmin.setMsg(msg, "Creating...", "");
			try {
				let result = await Api.send("assets/php/admin/createProduct.php", {
					"name": name,
					"description": document.getElementById("admin-product-desc")?.value || "",
					"metadata": metadata
				});
				if (result.success && result.product) {
					let priceResult = await Api.send("assets/php/admin/createPrice.php", {
						"product_id": result.product.id,
						"unit_amount": Math.round(parseFloat(document.getElementById("admin-price-amount")?.value || "9.99") * 100),
						"currency": document.getElementById("admin-price-currency")?.value || "usd",
						"interval": document.getElementById("admin-price-interval")?.value || "month"
					});
					Toast.success("Product created" + (priceResult.success ? " with price." : ". Price failed."));
					ModalAdmin.renderSubTab("products");
				} else { ModalAdmin.setMsg(msg, result.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});
	}

	static showEditProductForm(product) {
		let container = document.getElementById("admin-content");
		if (!container) return;
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back'>Back</button>";
		html += "<div class='modal-form-title' style='font-size:16px;'>Edit Product</div>";
		html += "<div class='admin-id' style='margin-bottom:12px;'>" + ModalAdmin.escapeHtml(product.id) + "</div>";
		html += "<div class='modal-form-group'><label>Name</label><input type='text' id='admin-product-name' value='" + ModalAdmin.escapeAttr(product.name || "") + "' /></div>";
		html += "<div class='modal-form-group'><label>Description</label><textarea id='admin-product-desc' rows='3'>" + ModalAdmin.escapeHtml(product.description || "") + "</textarea></div>";
		html += "<div class='modal-form-group'><label>Active</label><select id='admin-product-active'><option value='true'" + (product.active != 0 ? " selected" : "") + ">Active</option><option value='false'" + (product.active == 0 ? " selected" : "") + ">Inactive</option></select></div>";
		let metaObj = product.metadata || {};
		if (typeof metaObj === "string") { try { metaObj = JSON.parse(metaObj); } catch (e) { metaObj = {}; } }
		let featuresMeta = (metaObj && metaObj.features) ? metaObj.features : "";
		html += "<div class='modal-form-group'><label>Features (metadata)</label><input type='text' id='admin-product-features' value='" + ModalAdmin.escapeAttr(featuresMeta) + "' /></div>";

		// Show current prices (editable)
		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:12px 0;' />";
		html += "<div class='modal-form-title' style='font-size:14px;'>Current Prices</div>";
		if (product.prices && product.prices.length > 0) {
			for (let i = 0; i < product.prices.length; i++) {
				let pr = product.prices[i];
				let interval = pr.interval_unit ? pr.interval_unit.toUpperCase() : "MONTH";
				let isActive = pr.active != 0;
				html += "<div class='admin-price-row' data-price-id='" + ModalAdmin.escapeAttr(pr.id) + "' style='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);" + (!isActive ? "opacity:0.4;" : "") + "'>";
				html += "<span style='color:rgba(255,255,255,0.5);font-size:13px;'>$</span>";
				html += "<input type='number' class='admin-price-amount' value='" + ((pr.unit_amount || 0) / 100).toFixed(2) + "' step='0.01' min='0.01' style='width:80px;font-size:13px;padding:4px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;' " + (!isActive ? "disabled" : "") + " />";
				html += "<select class='admin-price-interval' style='font-size:13px;padding:4px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;' " + (!isActive ? "disabled" : "") + ">";
				html += "<option value='MONTH'" + (interval === "MONTH" ? " selected" : "") + ">/ month</option>";
				html += "<option value='YEAR'" + (interval === "YEAR" ? " selected" : "") + ">/ year</option>";
				html += "<option value='WEEK'" + (interval === "WEEK" ? " selected" : "") + ">/ week</option>";
				html += "<option value='DAY'" + (interval === "DAY" ? " selected" : "") + ">/ day</option>";
				html += "</select>";
				html += "<button class='admin-action-btn admin-price-save' style='font-size:11px;padding:3px 10px;'" + (!isActive ? " disabled" : "") + ">Save</button>";
				if (isActive) {
					html += "<button class='admin-action-btn admin-price-deactivate' style='font-size:11px;padding:3px 10px;color:rgba(255,80,80,0.9);'>Deactivate</button>";
				} else {
					html += "<span style='font-size:11px;color:rgba(255,80,80,0.6);'>Inactive</span>";
				}
				html += "</div>";
			}
		} else {
			html += "<div class='admin-muted'>No prices.</div>";
		}

		// Add new price section
		html += "<details style='margin-top:10px;'><summary style='cursor:pointer;color:var(--accent,rgba(255,50,100,0.9));font-size:13px;'>+ Add New Price</summary>";
		html += "<div class='modal-form-group'><label>Amount ($)</label><input type='number' id='admin-new-price-amount' value='9.99' step='0.01' min='0.01' /></div>";
		html += "<div class='modal-form-group'><label>Currency</label><input type='text' id='admin-new-price-currency' value='usd' /></div>";
		html += "<div class='modal-form-group'><label>Interval</label><select id='admin-new-price-interval'><option value='month'>Monthly</option><option value='year'>Yearly</option></select></div>";
		html += "<button class='modal-form-btn' id='admin-add-price' style='width:auto;padding:6px 16px;font-size:13px;'>Add Price</button>";
		html += "</details>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";
		html += "<button class='modal-form-btn' id='admin-product-save'>Save Changes</button>";
		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;

		document.getElementById("admin-back").addEventListener("click", function () { ModalAdmin.renderSubTab("products"); });

		document.getElementById("admin-product-save").addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let metadata = {};
			let features = (document.getElementById("admin-product-features")?.value || "").trim();
			if (features) metadata["features"] = features;
			ModalAdmin.setMsg(msg, "Saving...", "");
			try {
				let result = await Api.send("assets/php/admin/updateProduct.php", {
					"product_id": product.id,
					"name": document.getElementById("admin-product-name")?.value || "",
					"description": document.getElementById("admin-product-desc")?.value || "",
					"active": document.getElementById("admin-product-active")?.value === "true",
					"metadata": metadata
				});
				if (result.success) { Toast.success("Product saved."); ModalAdmin.renderSubTab("products"); }
				else { ModalAdmin.setMsg(msg, result.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});

		document.getElementById("admin-add-price")?.addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let dollarAmt = parseFloat(document.getElementById("admin-new-price-amount")?.value || "0");
			if (dollarAmt <= 0) { ModalAdmin.setMsg(msg, "Price amount must be > 0.", "error"); return; }
			ModalAdmin.setMsg(msg, "Adding price...", "");
			try {
				let result = await Api.send("assets/php/admin/createPrice.php", {
					"product_id": product.id,
					"unit_amount": Math.round(dollarAmt * 100),
					"currency": document.getElementById("admin-new-price-currency")?.value || "usd",
					"interval": document.getElementById("admin-new-price-interval")?.value || "month"
				});
				if (result.success) { Toast.success("Price added."); ModalAdmin.renderSubTab("products"); }
				else { ModalAdmin.setMsg(msg, result.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});

		// Price save buttons
		let saveBtns = container.querySelectorAll(".admin-price-save");
		for (let i = 0; i < saveBtns.length; i++) {
			saveBtns[i].addEventListener("click", async function () {
				let row = this.closest(".admin-price-row");
				if (!row) return;
				let priceId = row.getAttribute("data-price-id");
				let amountInput = row.querySelector(".admin-price-amount");
				let intervalSelect = row.querySelector(".admin-price-interval");
				let dollarAmount = parseFloat(amountInput?.value || "0");
				if (dollarAmount <= 0) { Toast.error("Amount must be greater than 0."); return; }
				let newAmountCents = Math.round(dollarAmount * 100);
				let newInterval = intervalSelect?.value || "MONTH";
				let msg = document.getElementById("admin-msg");
				ModalAdmin.setMsg(msg, "Updating price...", "");
				try {
					let result = await Api.send("assets/php/admin/updatePrice.php", {
						"price_id": priceId,
						"unit_amount": newAmountCents,
						"interval_unit": newInterval
					});
					if (result.success) {
						Toast.success("Price updated ($" + dollarAmount.toFixed(2) + "/" + newInterval.toLowerCase() + ").");
						// Refetch product and re-open edit form
						let refreshed = await Api.send("assets/php/store/getProduct.php", { "product_id": product.id });
						if (refreshed && refreshed.success && refreshed.product) {
							ModalAdmin.showEditProductForm(refreshed.product);
						} else { ModalAdmin.renderSubTab("products"); }
					} else {
						ModalAdmin.setMsg(msg, result.message || "Failed to update price.", "error");
					}
				} catch (e) { ModalAdmin.setMsg(msg, "Error updating price.", "error"); }
			});
		}

		// Price deactivate buttons
		let deactivateBtns = container.querySelectorAll(".admin-price-deactivate");
		for (let i = 0; i < deactivateBtns.length; i++) {
			deactivateBtns[i].addEventListener("click", async function () {
				let row = this.closest(".admin-price-row");
				if (!row) return;
				let priceId = row.getAttribute("data-price-id");
				if (!confirm("Deactivate this price? Existing subscribers will not be affected, but no new subscriptions can use this price.")) return;
				let msg = document.getElementById("admin-msg");
				ModalAdmin.setMsg(msg, "Deactivating...", "");
				try {
					let result = await Api.send("assets/php/admin/updatePrice.php", {
						"price_id": priceId,
						"active": false
					});
					if (result.success) {
						Toast.success("Price deactivated.");
						let refreshed = await Api.send("assets/php/store/getProduct.php", { "product_id": product.id });
						if (refreshed && refreshed.success && refreshed.product) {
							ModalAdmin.showEditProductForm(refreshed.product);
						} else { ModalAdmin.renderSubTab("products"); }
					} else {
						ModalAdmin.setMsg(msg, result.message || "Failed to deactivate.", "error");
					}
				} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
			});
		}
	}

	// ═══════════════════════════════════════════════
	//  USERS
	// ═══════════════════════════════════════════════

	static loadUsers(container) {
		let html = "";
		html += "<div class='admin-search'>";
		html += "<input type='text' id='admin-user-search' placeholder='Search by username or email...' />";
		html += "<button class='modal-form-btn' id='admin-user-search-btn' style='width:auto;padding:6px 16px;font-size:13px;white-space:nowrap;'>Search</button>";
		html += "</div>";
		html += "<div id='admin-users-list'><div class='admin-muted' style='padding:20px;'>Click Search to list all users, or enter a search term.</div></div>";
		container.innerHTML = html;
		document.getElementById("admin-user-search-btn").addEventListener("click", function () { ModalAdmin.searchUsers(); });
		document.getElementById("admin-user-search").addEventListener("keypress", function (e) { if (e.key === "Enter") ModalAdmin.searchUsers(); });
	}

	static async searchUsers(page) {
		page = page || 1;
		let search = document.getElementById("admin-user-search")?.value || "";
		let list = document.getElementById("admin-users-list");
		if (!list) return;
		list.innerHTML = "<div class='admin-loading'>Loading...</div>";
		try {
			let result = await Api.get("assets/php/admin/getUsers.php?page=" + page + "&search=" + encodeURIComponent(search));
			if (result.success) { ModalAdmin.renderUsersList(list, result.users || [], result.total, result.page, result.pages); }
			else { list.innerHTML = "<div class='admin-error'>" + ModalAdmin.escapeHtml(result.message || "Failed.") + "</div>"; }
		} catch (e) { list.innerHTML = "<div class='admin-error'>Error loading users.</div>"; }
	}

	static renderUsersList(container, users, total, page, pages) {
		let html = "<div style='font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:8px;'>" + total + " users found</div>";
		if (users.length === 0) {
			html += "<div class='admin-muted'>No users found.</div>";
		} else {
			html += "<div class='admin-table-wrap'><table class='billing-table'><thead><tr><th>Username</th><th>Email</th><th>Authority</th><th>Created</th><th></th></tr></thead><tbody>";
			for (let i = 0; i < users.length; i++) {
				let u = users[i];
				html += "<tr>";
				html += "<td>" + ModalAdmin.escapeHtml(u.username) + "</td>";
				html += "<td>" + ModalAdmin.escapeHtml(u.email || "") + "</td>";
				html += "<td class='admin-authority-cell'>" + ModalAdmin.escapeHtml(u.authority || "") + "</td>";
				html += "<td style='font-size:12px;white-space:nowrap;'>" + ModalAdmin.escapeHtml(u.created_at || "") + "</td>";
				html += "<td><button class='admin-action-btn' data-user-detail='" + ModalAdmin.escapeAttr(u.id) + "'>Detail</button></td>";
				html += "</tr>";
			}
			html += "</tbody></table></div>";
		}
		if (pages > 1) {
			html += "<div style='text-align:center;margin-top:12px;'>";
			for (let p = 1; p <= Math.min(pages, 10); p++) {
				html += "<button class='admin-action-btn" + (p === page ? " active" : "") + "' data-user-page='" + p + "' style='margin:2px;'>" + p + "</button>";
			}
			html += "</div>";
		}
		container.innerHTML = html;
		let detailBtns = container.querySelectorAll("[data-user-detail]");
		for (let i = 0; i < detailBtns.length; i++) {
			detailBtns[i].addEventListener("click", function () { ModalAdmin.showUserDetail(this.getAttribute("data-user-detail")); });
		}
		let pageBtns = container.querySelectorAll("[data-user-page]");
		for (let i = 0; i < pageBtns.length; i++) {
			pageBtns[i].addEventListener("click", function () { ModalAdmin.searchUsers(parseInt(this.getAttribute("data-user-page"), 10)); });
		}
	}

	static async showUserDetail(userId) {
		let container = document.getElementById("admin-content");
		if (!container) return;
		container.innerHTML = "<div class='admin-loading'>Loading user...</div>";
		try {
			let result = await Api.get("assets/php/admin/getUserDetail.php?user_id=" + encodeURIComponent(userId));
			if (result.success) { ModalAdmin.renderUserDetail(container, result); }
			else { container.innerHTML = "<div class='admin-error'>" + ModalAdmin.escapeHtml(result.message || "Failed.") + "</div>"; }
		} catch (e) { container.innerHTML = "<div class='admin-error'>Error loading user.</div>"; }
	}

	static renderUserDetail(container, data) {
		let u = data.user;
		let currentFlags = (u.authority || "").split(",").filter(function (f) { return f.length > 0; });
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back-users'>Back to Users</button>";

		// ── Editable user info ──
		html += "<div class='admin-detail-section'>";
		html += "<div class='modal-form-title' style='font-size:16px;'>User Info</div>";
		html += "<div class='admin-id' style='margin-bottom:10px;'>ID: " + ModalAdmin.escapeHtml(u.id) + "</div>";
		html += "<div class='modal-form-group'><label>Username</label><input type='text' id='admin-edit-username' value='" + ModalAdmin.escapeAttr(u.username || "") + "' /></div>";
		html += "<div class='modal-form-group'><label>Email</label><input type='text' id='admin-edit-email' value='" + ModalAdmin.escapeAttr(u.email || "") + "' /></div>";
		html += "<div style='font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:4px;'>Created: " + ModalAdmin.escapeHtml(u.created_at || "") + "</div>";

		// Authority checkboxes grouped
		html += "<div style='margin-top:12px;'><label style='font-weight:bold;'>Authority Flags</label></div>";
		html += "<div class='admin-authority-grid'>";
		let lastGroup = "";
		for (let i = 0; i < ModalAdmin.authorityFlags.length; i++) {
			let flag = ModalAdmin.authorityFlags[i];
			if (flag.group !== lastGroup) {
				if (lastGroup !== "") html += "</div>";
				html += "<div class='admin-authority-group'><div class='admin-authority-group-label'>" + ModalAdmin.escapeHtml(flag.group) + "</div>";
				lastGroup = flag.group;
			}
			let checked = currentFlags.indexOf(flag.key) !== -1 ? " checked" : "";
			html += "<label class='admin-checkbox'><input type='checkbox' class='admin-auth-flag' value='" + ModalAdmin.escapeAttr(flag.key) + "'" + checked + " /> " + ModalAdmin.escapeHtml(flag.key) + "</label>";
		}
		if (lastGroup !== "") html += "</div>";
		html += "</div>";

		// Feature checkboxes grouped
		let currentFeatures = (data.features || []).map(function (f) { return f.feature_key; });
		html += "<div style='margin-top:16px;'><label style='font-weight:bold;'>Feature Flags</label></div>";
		html += "<div class='admin-authority-grid'>";
		let lastFeatureGroup = "";
		for (let i = 0; i < ModalAdmin.featureKeys.length; i++) {
			let fk = ModalAdmin.featureKeys[i];
			if (fk.group !== lastFeatureGroup) {
				if (lastFeatureGroup !== "") html += "</div>";
				html += "<div class='admin-authority-group'><div class='admin-authority-group-label'>" + ModalAdmin.escapeHtml(fk.group) + "</div>";
				lastFeatureGroup = fk.group;
			}
			let checked = currentFeatures.indexOf(fk.key) !== -1 ? " checked" : "";
			html += "<label class='admin-checkbox'><input type='checkbox' class='admin-feature-flag' value='" + ModalAdmin.escapeAttr(fk.key) + "'" + checked + " /> " + ModalAdmin.escapeHtml(fk.key) + "</label>";
		}
		if (lastFeatureGroup !== "") html += "</div>";
		html += "</div>";

		html += "<button class='modal-form-btn' id='admin-save-user' style='margin-top:12px;'>Save User Info</button>";
		html += "<div class='modal-form-message' id='admin-user-msg'></div>";
		html += "</div>";

		// ── Subscriptions ──
		html += "<div class='admin-detail-section'>";
		html += "<div class='modal-form-title' style='font-size:14px;'>Subscriptions</div>";
		if (data.subscriptions && data.subscriptions.length > 0) {
			for (let i = 0; i < data.subscriptions.length; i++) {
				let sub = data.subscriptions[i];
				html += "<div class='subscription-card'>";
				html += "<div><strong>Status:</strong> " + ModalAdmin.escapeHtml(sub.status) + "</div>";
				html += "<div class='admin-id'>Sub: " + ModalAdmin.escapeHtml(sub.paypal_subscription_id) + "</div>";
				html += "<div class='admin-id'>Plan: " + ModalAdmin.escapeHtml(sub.paypal_plan_id) + "</div>";
				if (sub.status === "active" || sub.status === "trialing") {
					html += "<button class='admin-action-btn admin-cancel-sub' data-sub-id='" + ModalAdmin.escapeAttr(sub.paypal_subscription_id) + "' style='margin-top:6px;'>Cancel</button>";
				}
				html += "</div>";
			}
		} else { html += "<div class='admin-muted'>No subscriptions.</div>"; }
		html += "</div>";

		// ── Transactions ──
		html += "<div class='admin-detail-section'>";
		html += "<div class='modal-form-title' style='font-size:14px;'>Recent Transactions</div>";
		if (data.transactions && data.transactions.length > 0) {
			html += "<div class='admin-table-wrap'><table class='billing-table'><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>";
			for (let i = 0; i < data.transactions.length; i++) {
				let t = data.transactions[i];
				html += "<tr><td style='white-space:nowrap;'>" + ModalAdmin.escapeHtml(t.created_at || "") + "</td>";
				html += "<td>$" + (t.amount_cents / 100).toFixed(2) + " " + ModalAdmin.escapeHtml(t.currency || "usd") + "</td>";
				html += "<td>" + ModalAdmin.escapeHtml(t.status) + "</td><td>";
				if (t.paypal_capture_id && t.status !== "refunded") {
					html += "<button class='admin-action-btn admin-refund' data-pi='" + ModalAdmin.escapeAttr(t.paypal_capture_id) + "'>Refund</button>";
				}
				html += "</td></tr>";
			}
			html += "</tbody></table></div>";
		} else { html += "<div class='admin-muted'>No transactions.</div>"; }
		html += "</div>";

		// ── Linked platforms ──
		html += "<div class='admin-detail-section'>";
		html += "<div class='modal-form-title' style='font-size:14px;'>Linked Platforms</div>";
		if (data.platforms && data.platforms.length > 0) {
			for (let i = 0; i < data.platforms.length; i++) {
				let pl = data.platforms[i];
				html += "<div style='font-size:13px;color:rgba(255,255,255,0.7);padding:2px 0;'>" + ModalAdmin.escapeHtml(pl.platform) + ": " + ModalAdmin.escapeHtml(pl.platform_email || "N/A") + "</div>";
			}
		} else { html += "<div class='admin-muted'>None.</div>"; }
		html += "</div>";

		container.innerHTML = html;

		// ── Attach handlers ──
		document.getElementById("admin-back-users").addEventListener("click", function () {
			let c = document.getElementById("admin-content");
			if (c) ModalAdmin.loadUsers(c);
		});

		// Save user info
		document.getElementById("admin-save-user").addEventListener("click", function () { ModalAdmin.saveUserInfo(u.id); });

		// Cancel sub
		let cancelBtns = container.querySelectorAll(".admin-cancel-sub");
		for (let i = 0; i < cancelBtns.length; i++) {
			cancelBtns[i].addEventListener("click", async function () {
				if (!confirm("Cancel this subscription?")) return;
				try {
					let r = await Api.send("assets/php/admin/cancelUserSubscription.php", { "subscription_id": this.getAttribute("data-sub-id") });
					if (r.success) { Toast.success("Canceled."); ModalAdmin.showUserDetail(u.id); } else { Toast.error(r.message || "Failed."); }
				} catch (e) { Toast.error("Error."); }
			});
		}

		// Refund
		let refundBtns = container.querySelectorAll(".admin-refund");
		for (let i = 0; i < refundBtns.length; i++) {
			refundBtns[i].addEventListener("click", async function () {
				if (!confirm("Issue full refund?")) return;
				try {
					let r = await Api.send("assets/php/admin/issueRefund.php", { "capture_id": this.getAttribute("data-pi") });
					if (r.success) { Toast.success("Refunded."); ModalAdmin.showUserDetail(u.id); } else { Toast.error(r.message || "Failed."); }
				} catch (e) { Toast.error("Error."); }
			});
		}

	}

	static async saveUserInfo(userId) {
		let msg = document.getElementById("admin-user-msg");
		let username = document.getElementById("admin-edit-username")?.value || "";
		let email = document.getElementById("admin-edit-email")?.value || "";

		// Collect checked authority flags
		let checks = document.querySelectorAll(".admin-auth-flag");
		let flags = [];
		for (let i = 0; i < checks.length; i++) {
			if (checks[i].checked) flags.push(checks[i].value);
		}
		let authority = flags.join(",");

		// Collect checked feature flags
		let featureChecks = document.querySelectorAll(".admin-feature-flag");
		let features = [];
		for (let i = 0; i < featureChecks.length; i++) {
			if (featureChecks[i].checked) features.push(featureChecks[i].value);
		}

		if (username.trim().length < 3) { ModalAdmin.setMsg(msg, "Username must be at least 3 characters.", "error"); return; }

		ModalAdmin.setMsg(msg, "Saving...", "");
		try {
			let r = await Api.send("assets/php/admin/updateUser.php", {
				"user_id": userId,
				"username": username.trim(),
				"email": email.trim(),
				"authority": authority,
				"features": features
			});
			if (r.success) {
				Toast.success("User saved.");
				ModalAdmin.setMsg(msg, "Saved.", "success");
			} else {
				ModalAdmin.setMsg(msg, r.message || "Failed.", "error");
			}
		} catch (e) { ModalAdmin.setMsg(msg, "Error saving.", "error"); }
	}

	// ═══════════════════════════════════════════════
	//  COUPONS
	// ═══════════════════════════════════════════════

	static async loadCoupons(container) {
		container.innerHTML = "<div class='admin-loading'>Loading coupons...</div>";
		try {
			let result = await Api.get("assets/php/admin/getCoupons.php");
			if (result.success) {
				ModalAdmin.couponCache = result.coupons || [];
				ModalAdmin.renderCoupons(container, ModalAdmin.couponCache);
			} else { container.innerHTML = "<div class='admin-error'>Failed to load coupons.</div>"; }
		} catch (e) { container.innerHTML = "<div class='admin-error'>Error loading coupons.</div>"; }
	}

	static renderCoupons(container, coupons) {
		let html = "<div style='margin-bottom:16px;'><button class='modal-form-btn' id='admin-create-coupon' style='width:auto;padding:6px 16px;font-size:13px;'>+ Create Coupon</button></div>";
		if (coupons.length === 0) {
			html += "<div class='admin-muted'>No coupons found.</div>";
		} else {
			html += "<div class='admin-table-wrap'><table class='billing-table'><thead><tr><th>Name</th><th>Discount</th><th>Duration</th><th>Redeemed</th><th>Actions</th></tr></thead><tbody>";
			for (let i = 0; i < coupons.length; i++) {
				let c = coupons[i];
				let discount = c.percent_off ? c.percent_off + "% off" : "$" + ((c.amount_off || 0) / 100).toFixed(2) + " off";
				let dur = (c.duration || "") + (c.duration_in_months ? " (" + c.duration_in_months + " mo)" : "");
				html += "<tr>";
				html += "<td>" + ModalAdmin.escapeHtml(c.name || "") + "<div class='admin-id'>" + ModalAdmin.escapeHtml(c.id) + "</div></td>";
				html += "<td>" + ModalAdmin.escapeHtml(discount) + "</td>";
				html += "<td>" + ModalAdmin.escapeHtml(dur) + "</td>";
				html += "<td>" + (c.times_redeemed || 0) + "</td>";
				html += "<td style='white-space:nowrap;'>";
				html += "<button class='admin-action-btn' data-edit-coupon='" + i + "'>Edit</button> ";
				html += "<button class='admin-action-btn admin-delete-btn' data-delete-coupon='" + ModalAdmin.escapeAttr(c.id) + "'>Delete</button>";
				html += "</td></tr>";
			}
			html += "</tbody></table></div>";
		}
		container.innerHTML = html;
		document.getElementById("admin-create-coupon")?.addEventListener("click", function () { ModalAdmin.showCreateCouponForm(); });
		let editBtns = container.querySelectorAll("[data-edit-coupon]");
		for (let i = 0; i < editBtns.length; i++) {
			editBtns[i].addEventListener("click", function () {
				let idx = parseInt(this.getAttribute("data-edit-coupon"), 10);
				ModalAdmin.showEditCouponForm(ModalAdmin.couponCache[idx]);
			});
		}
		let delBtns = container.querySelectorAll("[data-delete-coupon]");
		for (let i = 0; i < delBtns.length; i++) {
			delBtns[i].addEventListener("click", function () {
				ModalAdmin.deleteCoupon(this.getAttribute("data-delete-coupon"));
			});
		}
	}

	static showCreateCouponForm() {
		let container = document.getElementById("admin-content");
		if (!container) return;
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back'>Back</button>";
		html += "<div class='modal-form-title' style='font-size:16px;'>Create Coupon</div>";
		html += "<div class='modal-form-group'><label>Name</label><input type='text' id='admin-coupon-name' /></div>";
		html += "<div class='modal-form-group'><label>Discount Type</label><select id='admin-coupon-type'><option value='percent'>Percentage Off</option><option value='amount'>Fixed Amount Off</option></select></div>";
		html += "<div class='modal-form-group'><label>Value (% or cents)</label><input type='number' id='admin-coupon-value' value='10' /></div>";
		html += "<div class='modal-form-group'><label>Duration</label><select id='admin-coupon-duration'><option value='once'>Once</option><option value='repeating'>Repeating</option><option value='forever'>Forever</option></select></div>";
		html += "<div class='modal-form-group'><label>Duration in Months (if repeating)</label><input type='number' id='admin-coupon-months' value='3' /></div>";
		html += "<button class='modal-form-btn' id='admin-coupon-submit'>Create Coupon</button>";
		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;
		document.getElementById("admin-back").addEventListener("click", function () { ModalAdmin.renderSubTab("coupons"); });
		document.getElementById("admin-coupon-submit").addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let name = document.getElementById("admin-coupon-name")?.value || "";
			if (!name.trim()) { ModalAdmin.setMsg(msg, "Name required.", "error"); return; }
			let data = { "name": name, "duration": document.getElementById("admin-coupon-duration")?.value || "once" };
			let type = document.getElementById("admin-coupon-type")?.value || "percent";
			let value = parseInt(document.getElementById("admin-coupon-value")?.value || "10", 10);
			if (type === "percent") data["percent_off"] = value; else data["amount_off"] = value;
			if (data["duration"] === "repeating") data["duration_in_months"] = parseInt(document.getElementById("admin-coupon-months")?.value || "3", 10);
			ModalAdmin.setMsg(msg, "Creating...", "");
			try {
				let r = await Api.send("assets/php/admin/createCoupon.php", data);
				if (r.success) { Toast.success("Coupon created."); ModalAdmin.renderSubTab("coupons"); }
				else { ModalAdmin.setMsg(msg, r.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});
	}

	static showEditCouponForm(coupon) {
		let container = document.getElementById("admin-content");
		if (!container) return;
		let discount = coupon.percent_off ? coupon.percent_off + "% off" : "$" + ((coupon.amount_off || 0) / 100).toFixed(2) + " off";
		let dur = (coupon.duration || "") + (coupon.duration_in_months ? " (" + coupon.duration_in_months + " mo)" : "");
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back'>Back</button>";
		html += "<div class='modal-form-title' style='font-size:16px;'>Edit Coupon</div>";
		html += "<div class='admin-id' style='margin-bottom:12px;'>" + ModalAdmin.escapeHtml(coupon.id) + "</div>";
		html += "<div class='modal-form-group'><label>Name</label><input type='text' id='admin-coupon-name' value='" + ModalAdmin.escapeAttr(coupon.name || "") + "' /></div>";
		html += "<div style='font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px;'><em>Discount type cannot be changed after creation.</em></div>";
		html += "<div style='font-size:13px;color:rgba(255,255,255,0.7);'>Discount: " + ModalAdmin.escapeHtml(discount) + "</div>";
		html += "<div style='font-size:13px;color:rgba(255,255,255,0.7);'>Duration: " + ModalAdmin.escapeHtml(dur) + "</div>";
		html += "<div style='font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:12px;'>Times Redeemed: " + (coupon.times_redeemed || 0) + "</div>";
		html += "<button class='modal-form-btn' id='admin-coupon-save'>Save Changes</button>";
		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;
		document.getElementById("admin-back").addEventListener("click", function () { ModalAdmin.renderSubTab("coupons"); });
		document.getElementById("admin-coupon-save").addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let name = document.getElementById("admin-coupon-name")?.value || "";
			if (!name.trim()) { ModalAdmin.setMsg(msg, "Name required.", "error"); return; }
			ModalAdmin.setMsg(msg, "Saving...", "");
			try {
				let r = await Api.send("assets/php/admin/updateCoupon.php", { "coupon_id": coupon.id, "name": name });
				if (r.success) { Toast.success("Coupon saved."); ModalAdmin.renderSubTab("coupons"); }
				else { ModalAdmin.setMsg(msg, r.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});
	}

	static async deleteCoupon(couponId) {
		if (!confirm("Delete coupon " + couponId + "? This cannot be undone.")) return;
		try {
			let r = await Api.send("assets/php/admin/deleteCoupon.php", { "coupon_id": couponId });
			if (r.success) { Toast.success("Coupon deleted."); ModalAdmin.renderSubTab("coupons"); }
			else { Toast.error(r.message || "Failed."); }
		} catch (e) { Toast.error("Error deleting coupon."); }
	}

	// ═══════════════════════════════════════════════
	//  HELPERS
	// ═══════════════════════════════════════════════

	static formatPrices(prices) {
		if (!prices || prices.length === 0) return "No prices";
		let parts = [];
		for (let i = 0; i < prices.length; i++) {
			let pr = prices[i];
			let interval = "one-time";
			if (pr.interval_unit) {
				interval = pr.interval_unit.toLowerCase();
			} else if (pr.recurring && pr.recurring.interval) {
				interval = pr.recurring.interval;
			}
			let active = pr.active != 0;
			let label = "$" + (pr.unit_amount / 100).toFixed(2) + "/" + interval;
			if (!active) label += " (inactive)";
			parts.push(label);
		}
		return parts.join(", ");
	}

	// ═══════════════════════════════════════════════
	//  TAX RATES
	// ═══════════════════════════════════════════════

	static async loadTaxRates(container) {
		container.innerHTML = "<div class='admin-loading'>Loading tax rates...</div>";
		try {
			let result = await Api.send("assets/php/admin/getTaxRates.php");
			if (result.success) {
				ModalAdmin.renderTaxRates(container, result.tax_rates || []);
			} else {
				container.innerHTML = "<div class='admin-error'>Failed to load tax rates.</div>";
			}
		} catch (e) {
			container.innerHTML = "<div class='admin-error'>Error loading tax rates.</div>";
		}
	}

	static renderTaxRates(container, rates) {
		let html = "";
		html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>";
		html += "<div class='modal-form-title' style='font-size:16px;margin:0;'>Tax Rates</div>";
		html += "<button class='modal-form-btn' id='admin-add-tax' style='width:auto;padding:6px 16px;font-size:13px;'>+ Add Tax Rate</button>";
		html += "</div>";

		if (rates.length === 0) {
			html += "<div class='admin-muted' style='padding:20px;'>No tax rates configured. Prices are shown without tax.</div>";
		} else {
			html += "<div class='admin-table-wrap'><table class='billing-table'>";
			html += "<thead><tr><th>Name</th><th>Percentage</th><th>Status</th><th></th></tr></thead><tbody>";
			for (let i = 0; i < rates.length; i++) {
				let r = rates[i];
				let isActive = r.active != 0;
				html += "<tr style='" + (!isActive ? "opacity:0.4;" : "") + "'>";
				html += "<td>" + ModalAdmin.escapeHtml(r.name) + "</td>";
				html += "<td>" + parseFloat(r.percentage).toFixed(2) + "%</td>";
				html += "<td>" + (isActive ? "<span class='admin-badge-active'>Active</span>" : "<span class='admin-badge-inactive'>Inactive</span>") + "</td>";
				html += "<td>";
				html += "<button class='admin-action-btn admin-edit-tax' data-tax-id='" + ModalAdmin.escapeAttr(r.id) + "' data-tax-name='" + ModalAdmin.escapeAttr(r.name) + "' data-tax-pct='" + r.percentage + "' data-tax-active='" + (isActive ? "1" : "0") + "' style='font-size:11px;'>Edit</button>";
				if (isActive) {
					html += " <button class='admin-action-btn admin-deactivate-tax' data-tax-id='" + ModalAdmin.escapeAttr(r.id) + "' style='font-size:11px;color:rgba(255,80,80,0.9);'>Deactivate</button>";
				}
				html += "</td></tr>";
			}
			html += "</tbody></table></div>";
		}

		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;

		// Add tax button
		document.getElementById("admin-add-tax")?.addEventListener("click", function () {
			ModalAdmin.showTaxForm(container, null);
		});

		// Edit buttons
		let editBtns = container.querySelectorAll(".admin-edit-tax");
		for (let i = 0; i < editBtns.length; i++) {
			editBtns[i].addEventListener("click", function () {
				ModalAdmin.showTaxForm(container, {
					id: this.getAttribute("data-tax-id"),
					name: this.getAttribute("data-tax-name"),
					percentage: this.getAttribute("data-tax-pct"),
					active: this.getAttribute("data-tax-active") === "1"
				});
			});
		}

		// Deactivate buttons
		let deactivateBtns = container.querySelectorAll(".admin-deactivate-tax");
		for (let i = 0; i < deactivateBtns.length; i++) {
			deactivateBtns[i].addEventListener("click", async function () {
				let id = this.getAttribute("data-tax-id");
				if (!confirm("Deactivate this tax rate?")) return;
				try {
					let result = await Api.send("assets/php/admin/deleteTaxRate.php", { "id": id });
					if (result.success) { Toast.success("Tax rate deactivated."); ModalAdmin.renderSubTab("tax"); }
					else { Toast.error(result.message || "Failed."); }
				} catch (e) { Toast.error("Error."); }
			});
		}
	}

	static showTaxForm(container, existing) {
		let isEdit = existing !== null;
		let html = "";
		html += "<button class='modal-form-btn admin-back-btn' id='admin-back'>Back</button>";
		html += "<div class='modal-form-title' style='font-size:16px;'>" + (isEdit ? "Edit Tax Rate" : "New Tax Rate") + "</div>";
		html += "<div class='modal-form-group'><label>Name</label><input type='text' id='admin-tax-name' value='" + (isEdit ? ModalAdmin.escapeAttr(existing.name) : "") + "' placeholder='e.g. Sales Tax' /></div>";
		html += "<div class='modal-form-group'><label>Percentage (%)</label><input type='number' step='0.01' min='0' max='100' id='admin-tax-pct' value='" + (isEdit ? existing.percentage : "0") + "' /></div>";
		if (isEdit) {
			html += "<div class='modal-form-group'><label>Active</label><select id='admin-tax-active'><option value='1'" + (existing.active ? " selected" : "") + ">Active</option><option value='0'" + (!existing.active ? " selected" : "") + ">Inactive</option></select></div>";
		}
		html += "<button class='modal-form-btn' id='admin-tax-save'>Save</button>";
		html += "<div class='modal-form-message' id='admin-msg'></div>";
		container.innerHTML = html;

		document.getElementById("admin-back").addEventListener("click", function () { ModalAdmin.renderSubTab("tax"); });
		document.getElementById("admin-tax-save").addEventListener("click", async function () {
			let msg = document.getElementById("admin-msg");
			let name = (document.getElementById("admin-tax-name")?.value || "").trim();
			let pct = parseFloat(document.getElementById("admin-tax-pct")?.value || "0");
			if (!name) { ModalAdmin.setMsg(msg, "Name required.", "error"); return; }
			if (isNaN(pct) || pct < 0 || pct > 100) { ModalAdmin.setMsg(msg, "Percentage must be 0-100.", "error"); return; }
			let data = { "name": name, "percentage": pct };
			if (isEdit) {
				data["id"] = existing.id;
				let activeVal = document.getElementById("admin-tax-active")?.value;
				data["active"] = activeVal === "1";
			}
			ModalAdmin.setMsg(msg, "Saving...", "");
			try {
				let result = await Api.send("assets/php/admin/saveTaxRate.php", data);
				if (result.success) { Toast.success("Tax rate saved."); ModalAdmin.renderSubTab("tax"); }
				else { ModalAdmin.setMsg(msg, result.message || "Failed.", "error"); }
			} catch (e) { ModalAdmin.setMsg(msg, "Error.", "error"); }
		});
	}

	// ═══════════════════════════════════════════════
	//  TRANSACTIONS
	// ═══════════════════════════════════════════════

	static async loadTransactions(container) {
		// Default date range: 1 year ago to today
		let today = new Date();
		let yearAgo = new Date();
		yearAgo.setFullYear(yearAgo.getFullYear() - 1);
		let defaultFrom = yearAgo.toISOString().split("T")[0];
		let defaultTo = today.toISOString().split("T")[0];

		let html = "";
		html += "<div class='modal-form-title' style='font-size:16px;margin-bottom:12px;'>Transactions</div>";
		html += "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;'>";
		html += "<input type='text' id='admin-tx-search' placeholder='Search user...' style='flex:1;min-width:120px;' />";
		html += "<label style='font-size:12px;color:rgba(255,255,255,0.5);margin-left:6px;'>From</label>";
		html += "<input type='date' id='admin-tx-from' value='" + defaultFrom + "' style='font-size:13px;padding:4px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;' />";
		html += "<label style='font-size:12px;color:rgba(255,255,255,0.5);'>To</label>";
		html += "<input type='date' id='admin-tx-to' value='" + defaultTo + "' style='font-size:13px;padding:4px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;' />";
		html += "<button class='modal-form-btn' id='admin-tx-filter' style='width:auto;padding:6px 16px;font-size:13px;white-space:nowrap;'>Filter</button>";
		html += "</div>";
		html += "<div id='admin-tx-results'><div class='admin-muted' style='padding:20px;'>Loading...</div></div>";
		container.innerHTML = html;

		// Initial load
		ModalAdmin.fetchTransactions(defaultFrom, defaultTo, "");

		// Filter button
		document.getElementById("admin-tx-filter")?.addEventListener("click", function () {
			let search = document.getElementById("admin-tx-search")?.value || "";
			let from = document.getElementById("admin-tx-from")?.value || "";
			let to = document.getElementById("admin-tx-to")?.value || "";
			ModalAdmin.fetchTransactions(from, to, search);
		});

		// Enter key on search
		document.getElementById("admin-tx-search")?.addEventListener("keydown", function (e) {
			if (e.key === "Enter") {
				document.getElementById("admin-tx-filter")?.click();
			}
		});
	}

	static async fetchTransactions(dateFrom, dateTo, search) {
		let resultsDiv = document.getElementById("admin-tx-results");
		if (!resultsDiv) return;
		resultsDiv.innerHTML = "<div class='admin-loading'>Loading transactions...</div>";

		try {
			let params = "?date_from=" + encodeURIComponent(dateFrom) + "&date_to=" + encodeURIComponent(dateTo);
			if (search) params += "&search=" + encodeURIComponent(search);
			let result = await Api.get("assets/php/admin/getTransactions.php" + params);

			if (!result || !result.success) {
				resultsDiv.innerHTML = "<div class='admin-error'>Failed to load transactions.</div>";
				return;
			}

			let txs = result.transactions || [];
			let total = result.total || 0;

			if (txs.length === 0) {
				resultsDiv.innerHTML = "<div class='admin-muted' style='padding:20px;'>No transactions found for this range.</div>";
				return;
			}

			let html = "<div style='font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:6px;'>Showing " + txs.length + " of " + total + " transactions</div>";
			html += "<div class='admin-table-wrap'><table class='billing-table'>";
			html += "<thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Tax</th><th>Status</th><th>Description</th></tr></thead><tbody>";

			for (let i = 0; i < txs.length; i++) {
				let t = txs[i];
				let isRefund = t.status === "refunded";
				let amountColor = isRefund ? "color:rgba(255,80,80,0.9);" : "color:rgba(80,220,100,0.9);";
				let amountPrefix = isRefund ? "-" : "+";
				let amount = (t.amount_cents / 100).toFixed(2);
				let tax = (t.tax_amount / 100).toFixed(2);
				let date = ModalAdmin.formatDate(t.created_at);

				html += "<tr>";
				html += "<td style='white-space:nowrap;font-size:12px;'>" + ModalAdmin.escapeHtml(date) + "</td>";
				html += "<td style='font-size:12px;'>" + ModalAdmin.escapeHtml(t.username || "Unknown") + "</td>";
				html += "<td style='" + amountColor + "font-weight:600;white-space:nowrap;'>" + amountPrefix + "$" + amount + " " + ModalAdmin.escapeHtml((t.currency || "usd").toUpperCase()) + "</td>";
				html += "<td style='font-size:12px;color:rgba(255,255,255,0.5);white-space:nowrap;'>$" + tax + "</td>";
				html += "<td style='font-size:12px;'>" + ModalAdmin.escapeHtml(t.status || "") + "</td>";
				html += "<td style='font-size:11px;color:rgba(255,255,255,0.4);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + ModalAdmin.escapeHtml(t.description || "") + "</td>";
				html += "</tr>";
			}

			html += "</tbody></table></div>";
			resultsDiv.innerHTML = html;

		} catch (e) {
			resultsDiv.innerHTML = "<div class='admin-error'>Error loading transactions.</div>";
		}
	}

	static formatDate(dateStr) {
		if (!dateStr) return "";
		try {
			let d = new Date(dateStr);
			return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
		} catch (e) { return dateStr; }
	}

	static setMsg(elm, text, type) {
		if (elm) { elm.innerText = text; elm.className = "modal-form-message" + (type ? " " + type : ""); }
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
