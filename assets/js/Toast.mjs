/**
 * Notification toast system. Displays small notifications at the bottom center.
 * Maximum 3 visible at a time, newest at the bottom.
 */
export class Toast {

	static container = null;
	static maxVisible = 3;
	static defaultTimeout = 4000;

	/**
	 * Initializes the toast container if not already present.
	 */
	static ini() {
		if (Toast.container !== null) return;

		let el = document.createElement("div");
		el.id = "toast-container";
		el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;";
		document.body.appendChild(el);
		Toast.container = el;
	}

	/**
	 * Shows a success toast.
	 * @param {string} message - The message text.
	 * @param {number} timeout - Auto-dismiss time in ms.
	 */
	static success(message, timeout = Toast.defaultTimeout) {
		Toast.#show(message, "success", timeout);
	}

	/**
	 * Shows an error toast.
	 * @param {string} message - The message text.
	 * @param {number} timeout - Auto-dismiss time in ms.
	 */
	static error(message, timeout = Toast.defaultTimeout) {
		Toast.#show(message, "error", timeout);
	}

	/**
	 * Creates and displays a toast notification.
	 * @param {string} message - The message text.
	 * @param {string} type - "success" or "error".
	 * @param {number} timeout - Auto-dismiss time in ms.
	 */
	static #show(message, type, timeout) {
		Toast.ini();

		let el = document.createElement("div");
		let bgColor = type === "success" ? "rgba(40,180,80,0.9)" : "rgba(220,50,50,0.9)";
		el.style.cssText = "background:" + bgColor + ";color:#fff;padding:8px 18px;border-radius:6px;font-family:arial,sans-serif;font-size:13px;opacity:0;transition:opacity 0.3s;pointer-events:auto;max-width:320px;text-align:center;";
		el.innerText = message;

		Toast.container.appendChild(el);

		// Fade in
		requestAnimationFrame(function () {
			el.style.opacity = "1";
		});

		// Enforce max visible
		let children = Toast.container.children;
		while (children.length > Toast.maxVisible) {
			Toast.container.removeChild(children[0]);
		}

		// Auto dismiss
		setTimeout(function () {
			el.style.opacity = "0";
			setTimeout(function () {
				if (el.parentNode === Toast.container)
					Toast.container.removeChild(el);
			}, 350);
		}, timeout);
	}
}
