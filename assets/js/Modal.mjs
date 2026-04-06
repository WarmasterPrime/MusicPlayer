import { Session } from "./Session.mjs";

/**
 * Manages a full-screen modal overlay with a tab system.
 */
export class Modal {

	static element = null;
	static containerElement = null;
	static tabBarElement = null;
	static contentElement = null;
	static isOpen = false;
	static tabs = new Map();
	static activeTab = null;

	/**
	 * Initializes the modal by creating DOM elements.
	 */
	static ini() {
		if (Modal.element !== null)
			return;

		let overlay = document.createElement("div");
		overlay.id = "modal-overlay";
		overlay.className = "modal-overlay";
		overlay.addEventListener("click", function (event) {
			if (event.target === overlay)
				Modal.close();
		});

		let container = document.createElement("div");
		container.id = "modal-container";
		container.className = "modal-container";

		let closeBtn = document.createElement("button");
		closeBtn.id = "modal-close";
		closeBtn.className = "modal-close";
		closeBtn.innerText = "X";
		closeBtn.addEventListener("click", function () {
			Modal.close();
		});

		let tabBar = document.createElement("div");
		tabBar.id = "modal-tabs";
		tabBar.className = "modal-tabs";

		let content = document.createElement("div");
		content.id = "modal-content";
		content.className = "modal-content";

		container.appendChild(closeBtn);
		container.appendChild(tabBar);
		container.appendChild(content);
		overlay.appendChild(container);
		document.body.appendChild(overlay);

		Modal.element = overlay;
		Modal.containerElement = container;
		Modal.tabBarElement = tabBar;
		Modal.contentElement = content;

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape" && Modal.isOpen)
				Modal.close();
		});
	}

	/**
	 * Registers a tab in the modal.
	 * @param {string} name - Unique tab identifier.
	 * @param {string} label - Display label.
	 * @param {Function} renderFn - Returns HTML string for tab content.
	 * @param {Function|null} onMountFn - Called after content is set in DOM.
	 * @param {boolean} requiresAuth - Whether the tab requires a logged-in user.
	 * @param {Function|null} visibleFn - Optional callback returning boolean; tab is hidden when it returns false.
	 */
	static registerTab(name, label, renderFn, onMountFn = null, requiresAuth = false, visibleFn = null) {
		Modal.tabs.set(name, { name, label, renderFn, onMountFn, requiresAuth, visibleFn });
	}

	/**
	 * Opens the modal and activates the specified tab.
	 * @param {string} tabName - The tab to activate.
	 */
	static open(tabName) {
		if (Modal.element === null)
			Modal.ini();
		Modal.renderTabBar();
		Modal.switchTab(tabName);
		Modal.tabBarElement.style.display = "";
		Modal.element.style.display = "flex";
		Modal.isOpen = true;
	}

	/**
	 * Opens the modal with raw HTML content. No tabs shown.
	 * @param {string} html - The HTML content.
	 */
	static openRaw(html) {
		if (Modal.element === null)
			Modal.ini();
		Modal.tabBarElement.style.display = "none";
		Modal.activeTab = null;
		if (typeof html === "string")
			Modal.contentElement.innerHTML = html;
		Modal.element.style.display = "flex";
		Modal.isOpen = true;
	}

	/**
	 * Switches to a different tab.
	 * @param {string} tabName - The tab to switch to.
	 */
	static switchTab(tabName) {
		let tab = Modal.tabs.get(tabName);
		if (!tab) return;

		Modal.activeTab = tabName;

		// Toggle wider modal for store/admin tabs
		if (tabName === "store" || tabName === "admin") {
			Modal.containerElement.classList.add("modal-wide");
		} else {
			Modal.containerElement.classList.remove("modal-wide");
		}

		// Update active state on tab buttons
		let buttons = Modal.tabBarElement.querySelectorAll(".modal-tab");
		for (let i = 0; i < buttons.length; i++) {
			if (buttons[i].getAttribute("data-tab") === tabName)
				buttons[i].classList.add("active");
			else
				buttons[i].classList.remove("active");
		}

		// Render tab content
		let html = tab.renderFn();
		if (typeof html === "string")
			Modal.contentElement.innerHTML = html;

		// Post-render mount callback
		if (typeof tab.onMountFn === "function")
			setTimeout(function () { tab.onMountFn(); }, 0);
	}

	/**
	 * Renders the tab bar buttons based on registered tabs and auth state.
	 */
	static renderTabBar() {
		Modal.tabBarElement.innerHTML = "";
		let isLoggedIn = Session.isLoggedIn();

		Modal.tabs.forEach(function (tab) {
			if (tab.requiresAuth && !isLoggedIn) return;
			if (typeof tab.visibleFn === "function" && !tab.visibleFn()) return;

			let btn = document.createElement("button");
			btn.className = "modal-tab" + (Modal.activeTab === tab.name ? " active" : "");
			btn.setAttribute("data-tab", tab.name);
			btn.innerText = tab.label;
			btn.addEventListener("click", function () {
				Modal.switchTab(tab.name);
			});
			Modal.tabBarElement.appendChild(btn);
		});
	}

	/**
	 * Closes and hides the modal.
	 */
	static close() {
		if (Modal.element !== null) {
			Modal.element.style.display = "none";
			Modal.isOpen = false;
			let elm = document.querySelector("canvas#visualizer");
			if(elm!==undefined)
				elm.focus();
		}
	}

	/**
	 * Sets the inner content of the modal without changing visibility.
	 * @param {string} html - The HTML content string.
	 */
	static setContent(html) {
		if (Modal.contentElement !== null && typeof html === "string")
			Modal.contentElement.innerHTML = html;
	}

	/**
	 * Refreshes the tab bar to reflect auth state changes.
	 */
	static refreshTabs() {
		if (Modal.tabBarElement !== null)
			Modal.renderTabBar();
	}
}
