import { Api } from "../Api.mjs";

/**
 * Fetches and renders the billing history in the Store sub-tab.
 */
export class StoreBilling {

	static transactions = [];
	static loaded = false;

	/**
	 * Loads billing history and renders into the container.
	 * @param {HTMLElement} container
	 */
	static async load(container) {
		container.innerHTML = "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.5);'>Loading billing history...</div>";

		try {
			let result = await Api.send("assets/php/store/getBillingHistory.php");
			if (result && result.success) {
				StoreBilling.transactions = result.transactions || [];
				StoreBilling.loaded = true;
			} else {
				StoreBilling.transactions = [];
			}
		} catch (e) {
			StoreBilling.transactions = [];
		}

		container.innerHTML = StoreBilling.render();
	}

	/**
	 * Renders the billing history table.
	 * @returns {string}
	 */
	static render() {
		if (StoreBilling.transactions.length === 0) {
			return "<div style='text-align:center;padding:30px;color:rgba(255,255,255,0.4);'>No billing history.</div>";
		}

		let html = "<table class='billing-table'>";
		html += "<thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>";
		html += "<tbody>";

		for (let t of StoreBilling.transactions) {
			let date = StoreBilling.formatDate(t.created_at);
			let amount = StoreBilling.formatAmount(t.amount_cents, t.currency);
			let statusClass = t.status === "completed" ? "billing-status-paid" : (t.status === "refunded" ? "billing-status-refunded" : "");

			html += "<tr>";
			html += "<td>" + StoreBilling.escapeHtml(date) + "</td>";
			html += "<td>" + StoreBilling.escapeHtml(t.description || "Payment") + "</td>";
			html += "<td>" + StoreBilling.escapeHtml(amount) + "</td>";
			html += "<td><span class='" + statusClass + "'>" + StoreBilling.escapeHtml(t.status || "unknown") + "</span></td>";
			html += "</tr>";
		}

		html += "</tbody></table>";
		return html;
	}

	/**
	 * Formats a date string.
	 * @param {string} dateStr
	 * @returns {string}
	 */
	static formatDate(dateStr) {
		if (!dateStr) return "";
		try {
			let d = new Date(dateStr);
			return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
		} catch (e) {
			return dateStr;
		}
	}

	/**
	 * Formats cents into a display amount.
	 * @param {number} cents
	 * @param {string} currency
	 * @returns {string}
	 */
	static formatAmount(cents, currency) {
		let amount = (cents / 100).toFixed(2);
		let symbol = "$";
		if (currency === "eur") symbol = "\u20AC";
		else if (currency === "gbp") symbol = "\u00A3";
		return symbol + amount;
	}

	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}
}
