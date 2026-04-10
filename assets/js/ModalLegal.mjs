import { Modal } from "./Modal.mjs";
import { VMarkdown } from "./System/Data/VMarkdown.mjs";

/**
 * Manages the Privacy Policy and Terms of Use content and rendering.
 */
export class ModalLegal {

	/**
	 * Fetches and renders a Markdown file.
	 * @param {string} file - The path to the Markdown file.
	 * @returns {Promise<string>} - The generated HTML content.
	 */
	static async renderFromMD(file) {
		try {
			let response = await fetch(file);
			if (!response.ok) throw new Error("Failed to fetch " + file);
			let md = await response.text();
			let parsed = VMarkdown.parse(md);

			let html = "";
			html += "<div class='modal-legal-container'>";
			html += "<div class='modal-legal-content'>";
			html += parsed;
			html += "</div>";
			html += "<button class='modal-form-btn' id='legal-back-btn'>Back</button>";
			html += "</div>";
			return html;
		} catch (error) {
			console.error("Error loading legal MD:", error);
			return "<div class='modal-form-message error'>Failed to load content.</div>";
		}
	}

	/**
	 * Opens the Privacy Policy in the modal.
	 * @param {Function|null} backFn - Function to call when clicking 'Back'. If null, the modal closes.
	 */
	static async openPrivacy(backFn = null) {
		let html = await ModalLegal.renderFromMD("assets/privacy.md");
		Modal.openRaw(html);
		ModalLegal.attachBackListener(backFn);
	}

	/**
	 * Opens the Terms of Use in the modal.
	 * @param {Function|null} backFn - Function to call when clicking 'Back'. If null, the modal closes.
	 */
	static async openTerms(backFn = null) {
		let html = await ModalLegal.renderFromMD("assets/terms.md");
		Modal.openRaw(html);
		ModalLegal.attachBackListener(backFn);
	}

	/**
	 * Attaches a listener to the back button.
	 * @param {Function|null} backFn - The function to execute on click.
	 */
	static attachBackListener(backFn) {
		let btn = document.getElementById("legal-back-btn");
		if (btn) {
			btn.addEventListener("click", function () {
				if (typeof backFn === "function")
					backFn();
				else
					Modal.close();
			});
		}
	}
}
