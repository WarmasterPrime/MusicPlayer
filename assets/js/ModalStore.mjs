import { Modal } from "./Modal.mjs";
import { StoreProducts } from "./services/StoreProducts.mjs";
import { StoreBilling } from "./services/StoreBilling.mjs";
import { StoreSubscriptions } from "./services/StoreSubscriptions.mjs";

/**
 * Main Store tab controller with sub-tabs: Store, Billing History, Subscriptions.
 */
export class ModalStore {

	static activeSubTab = "products";

	static subTabs = [
		{ key: "products", label: "Store" },
		{ key: "billing", label: "Billing History" },
		{ key: "subscriptions", label: "Subscriptions" }
	];

	/**
	 * Renders the Store tab with sub-tab navigation.
	 * @returns {string}
	 */
	static render() {
		let html = "";
		html += "<div class='store-subtabs' id='store-subtabs'>";
		for (let i = 0; i < ModalStore.subTabs.length; i++) {
			let tab = ModalStore.subTabs[i];
			let active = tab.key === ModalStore.activeSubTab ? " active" : "";
			html += "<button class='store-subtab" + active + "' data-subtab='" + tab.key + "'>" + tab.label + "</button>";
		}
		html += "</div>";
		html += "<div class='store-content' id='store-content'></div>";
		return html;
	}

	/**
	 * Called after the Store tab content is mounted to the DOM.
	 */
	static onMount() {
		// Attach sub-tab click listeners
		let tabBar = document.getElementById("store-subtabs");
		if (tabBar) {
			tabBar.addEventListener("click", function (event) {
				let btn = event.target.closest(".store-subtab");
				if (btn) {
					let key = btn.getAttribute("data-subtab");
					if (key) {
						ModalStore.switchSubTab(key);
					}
				}
			});
		}

		// Render the active sub-tab
		ModalStore.renderSubTab(ModalStore.activeSubTab);
	}

	/**
	 * Switches to a different sub-tab.
	 * @param {string} key
	 */
	static switchSubTab(key) {
		ModalStore.activeSubTab = key;

		// Update active state on sub-tab buttons
		let buttons = document.querySelectorAll(".store-subtab");
		for (let i = 0; i < buttons.length; i++) {
			if (buttons[i].getAttribute("data-subtab") === key) {
				buttons[i].classList.add("active");
			} else {
				buttons[i].classList.remove("active");
			}
		}

		ModalStore.renderSubTab(key);
	}

	/**
	 * Renders the content for a specific sub-tab.
	 * @param {string} key
	 */
	static renderSubTab(key) {
		let container = document.getElementById("store-content");
		if (!container) return;

		switch (key) {
			case "products":
				StoreProducts.load(container, function () {
					// Back callback — re-render the store tab content
					Modal.setContent(ModalStore.render());
					ModalStore.activeSubTab = "products";
					ModalStore.onMount();
				});
				break;
			case "billing":
				StoreBilling.load(container);
				break;
			case "subscriptions":
				StoreSubscriptions.load(container);
				break;
			default:
				container.innerHTML = "<div style='text-align:center;padding:30px;'>Unknown tab.</div>";
		}
	}
}
