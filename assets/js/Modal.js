
class Modal {

	static element = null;
	static contentElement = null;
	static isOpen = false;

	/**
	 * Initializes the modal by creating the DOM elements and appending them to the body.
	 */
	static ini() {
		if(Modal.element !== null)
			return;

		let overlay = document.createElement("div");
		overlay.id = "modal-overlay";
		overlay.className = "modal-overlay";
		overlay.addEventListener("click", function(event) {
			if(event.target === overlay)
				Modal.close();
		});

		let container = document.createElement("div");
		container.id = "modal-container";
		container.className = "modal-container";

		let closeBtn = document.createElement("button");
		closeBtn.id = "modal-close";
		closeBtn.className = "modal-close";
		closeBtn.innerText = "X";
		closeBtn.addEventListener("click", function() {
			Modal.close();
		});

		let content = document.createElement("div");
		content.id = "modal-content";
		content.className = "modal-content";

		container.appendChild(closeBtn);
		container.appendChild(content);
		overlay.appendChild(container);
		document.body.appendChild(overlay);

		Modal.element = overlay;
		Modal.contentElement = content;

		// Close on Escape key
		document.addEventListener("keydown", function(event) {
			if(event.key === "Escape" && Modal.isOpen)
				Modal.close();
		});
	}

	/**
	 * Opens the modal with the given HTML content.
	 * @param {string} content The HTML content to display inside the modal.
	 */
	static open(content) {
		if(Modal.element === null)
			Modal.ini();
		if(typeof content === "string")
			Modal.contentElement.innerHTML = content;
		Modal.element.style.display = "flex";
		Modal.isOpen = true;
	}

	/**
	 * Closes and hides the modal.
	 */
	static close() {
		if(Modal.element !== null) {
			Modal.element.style.display = "none";
			Modal.isOpen = false;
		}
	}

	/**
	 * Sets the inner content of the modal without changing visibility.
	 * @param {string} html The HTML content string.
	 */
	static setContent(html) {
		if(Modal.contentElement !== null && typeof html === "string")
			Modal.contentElement.innerHTML = html;
	}

}
