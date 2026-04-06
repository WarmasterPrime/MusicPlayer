import { Api } from "./Api.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { FeatureGate } from "./FeatureGate.mjs";

/**
 * Manages the custom fonts tab: upload, list, preview, and font preferences.
 */
export class ModalFonts {

	static fonts = [];
	static options = {};

	/**
	 * Renders the fonts management tab.
	 * @returns {string}
	 */
	static render() {
		if (!Session.isLoggedIn()) {
			return "<div style='text-align:center;padding:40px;color:var(--text-muted,rgba(255,255,255,0.5));'>Please log in to manage fonts.</div>";
		}

		let html = "";
		html += "<div class='modal-form-title'>Custom Fonts</div>";

		// Upload section
		html += "<div class='font-upload-section'>";
		html += "<div class='modal-form-group'><label>Font Name</label><input type='text' id='font-upload-name' placeholder='My Custom Font' /></div>";
		html += "<div class='modal-form-group'><label>Font File (TTF, OTF, WOFF, WOFF2)</label>";
		html += "<input type='file' id='font-upload-file' accept='.ttf,.otf,.woff,.woff2' /></div>";
		html += "<button class='modal-form-btn' id='font-upload-btn'>Upload Font</button>";
		html += "<div class='modal-form-message' id='font-upload-message'></div>";
		html += "</div>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";

		// Font list
		html += "<div class='modal-form-title' style='font-size:16px;'>Your Fonts</div>";
		html += "<div id='font-list'><div style='color:rgba(255,255,255,0.4);font-size:13px;'>Loading...</div></div>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";

		// Font preferences
		html += "<div class='modal-form-title' style='font-size:16px;'>Font Preferences</div>";
		html += "<div class='modal-form-group'><label>Song Name Font</label><select id='font-opt-song-name'><option value=''>Default</option></select></div>";
		html += "<div class='modal-form-group'><label>Lyrics Font</label><select id='font-opt-lyrics'><option value=''>Default</option></select></div>";
		html += "<div class='modal-form-group'><label>UI Font</label><select id='font-opt-ui'><option value=''>Default</option></select></div>";
		html += "<button class='modal-form-btn' id='font-options-save'>Save Preferences</button>";
		html += "<div class='modal-form-message' id='font-options-message'></div>";

		// Font preview
		html += "<div id='font-preview' style='margin-top:16px;padding:16px;background:rgba(0,0,0,0.3);border-radius:8px;min-height:60px;'>";
		html += "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>Select a font to preview</div>";
		html += "</div>";

		return html;
	}

	/**
	 * Attaches event listeners and loads data.
	 */
	static attachListeners() {
		let uploadBtn = document.getElementById("font-upload-btn");
		if (uploadBtn) {
			uploadBtn.addEventListener("click", function () { ModalFonts.uploadFont(); });
		}

		let saveBtn = document.getElementById("font-options-save");
		if (saveBtn) {
			saveBtn.addEventListener("click", function () { ModalFonts.saveFontOptions(); });
		}

		// Preview on select change
		let selectIds = ["font-opt-song-name", "font-opt-lyrics", "font-opt-ui"];
		for (let i = 0; i < selectIds.length; i++) {
			let el = document.getElementById(selectIds[i]);
			if (el) {
				el.addEventListener("change", function () { ModalFonts.updatePreview(); });
			}
		}

		ModalFonts.loadFonts();
		ModalFonts.loadFontOptions();
	}

	/**
	 * Uploads a font file to the server.
	 */
	static async uploadFont() {
		let message = document.getElementById("font-upload-message");
		let nameInput = document.getElementById("font-upload-name");
		let fileInput = document.getElementById("font-upload-file");

		if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
			if (message) { message.innerText = "Please select a font file."; message.className = "modal-form-message error"; }
			return;
		}

		// Client-side feature gate check
		if (!FeatureGate.check("custom_fonts")) {
			FeatureGate.showUpgradePrompt("custom_fonts");
			return;
		}

		let formData = new FormData();
		formData.append("font_file", fileInput.files[0]);
		formData.append("name", (nameInput ? nameInput.value.trim() : "") || fileInput.files[0].name.replace(/\.[^.]+$/, ""));

		if (message) { message.innerText = "Uploading..."; message.className = "modal-form-message"; }

		try {
			let result = await Api.upload("assets/php/fonts/uploadFont.php", formData);
			if (result.success) {
				Toast.success("Font uploaded.");
				if (message) { message.innerText = "Font uploaded successfully."; message.className = "modal-form-message success"; }
				if (nameInput) nameInput.value = "";
				if (fileInput) fileInput.value = "";
				ModalFonts.loadFonts();
			} else {
				if (result.feature_gated) {
					FeatureGate.showUpgradePrompt("custom_fonts");
				} else {
					if (message) { message.innerText = result.message || "Upload failed."; message.className = "modal-form-message error"; }
				}
			}
		} catch (e) {
			if (message) { message.innerText = "Upload error."; message.className = "modal-form-message error"; }
		}
	}

	/**
	 * Fetches the user's fonts from the server.
	 */
	static async loadFonts() {
		let container = document.getElementById("font-list");
		if (!container) return;

		try {
			let result = await Api.get("assets/php/fonts/getFonts.php");
			if (result.success) {
				ModalFonts.fonts = result.fonts || [];
				ModalFonts.renderFontList(container);
				ModalFonts.populateSelects();
			} else {
				container.innerHTML = "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>Failed to load fonts.</div>";
			}
		} catch (e) {
			container.innerHTML = "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>Error loading fonts.</div>";
		}
	}

	/**
	 * Renders the font list into a container element.
	 * @param {HTMLElement} container
	 */
	static renderFontList(container) {
		if (ModalFonts.fonts.length === 0) {
			container.innerHTML = "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>No custom fonts uploaded.</div>";
			return;
		}

		let html = "";
		for (let i = 0; i < ModalFonts.fonts.length; i++) {
			let f = ModalFonts.fonts[i];
			html += "<div class='font-item'>";
			html += "<div class='font-item-info'>";
			html += "<span class='font-item-name'>" + ModalFonts.escapeHtml(f.name) + "</span>";
			html += "<span class='font-item-type'>" + ModalFonts.escapeHtml(f.mime_type) + "</span>";
			html += "</div>";
			html += "<button class='font-item-delete' data-font-id='" + ModalFonts.escapeAttr(f.id) + "'>Delete</button>";
			html += "</div>";

			// Inject @font-face for preview
			ModalFonts.injectFontFace(f.id, f.name);
		}
		container.innerHTML = html;

		// Attach delete handlers
		let deleteBtns = container.querySelectorAll(".font-item-delete");
		for (let i = 0; i < deleteBtns.length; i++) {
			deleteBtns[i].addEventListener("click", async function () {
				let fontId = this.getAttribute("data-font-id");
				await ModalFonts.deleteFont(fontId);
			});
		}
	}

	/**
	 * Populates the font select dropdowns with available fonts.
	 */
	static populateSelects() {
		let selects = ["font-opt-song-name", "font-opt-lyrics", "font-opt-ui"];
		let keys = ["song_name_font", "lyrics_font", "ui_font"];

		for (let s = 0; s < selects.length; s++) {
			let el = document.getElementById(selects[s]);
			if (!el) continue;

			// Keep first option (Default), remove the rest
			while (el.options.length > 1) el.remove(1);

			for (let i = 0; i < ModalFonts.fonts.length; i++) {
				let opt = document.createElement("option");
				opt.value = ModalFonts.fonts[i].id;
				opt.textContent = ModalFonts.fonts[i].name;
				el.appendChild(opt);
			}

			// Restore saved selection
			let savedOpt = ModalFonts.options[keys[s]];
			if (savedOpt && savedOpt.font_id) {
				el.value = savedOpt.font_id;
			}
		}
	}

	/**
	 * Injects a @font-face style tag for a custom font.
	 * @param {string} fontId
	 * @param {string} fontName
	 */
	static injectFontFace(fontId, fontName) {
		let styleId = "font-face-" + fontId;
		if (document.getElementById(styleId)) return;

		let safeName = fontName.replace(/[^a-zA-Z0-9]/g, "-");
		let style = document.createElement("style");
		style.id = styleId;
		style.textContent = "@font-face { font-family: 'custom-" + safeName + "'; src: url('assets/php/fonts/serveFont.php?id=" + encodeURIComponent(fontId) + "'); }";
		document.head.appendChild(style);
	}

	/**
	 * Deletes a font by ID.
	 * @param {string} fontId
	 */
	static async deleteFont(fontId) {
		try {
			let result = await Api.send("assets/php/fonts/deleteFont.php", { "font_id": fontId });
			if (result.success) {
				Toast.success("Font deleted.");
				ModalFonts.loadFonts();
			} else {
				Toast.error(result.message || "Delete failed.");
			}
		} catch (e) {
			Toast.error("Error deleting font.");
		}
	}

	/**
	 * Loads the user's font option preferences.
	 */
	static async loadFontOptions() {
		try {
			let result = await Api.get("assets/php/fonts/getFontOptions.php");
			if (result.success) {
				ModalFonts.options = result.options || {};
				ModalFonts.populateSelects();
				ModalFonts.applyFonts();
			}
		} catch (e) {}
	}

	/**
	 * Saves font preferences to the server.
	 */
	static async saveFontOptions() {
		let message = document.getElementById("font-options-message");

		if (!FeatureGate.check("custom_fonts")) {
			FeatureGate.showUpgradePrompt("custom_fonts");
			return;
		}

		let songFont = document.getElementById("font-opt-song-name")?.value || "";
		let lyricsFont = document.getElementById("font-opt-lyrics")?.value || "";
		let uiFont = document.getElementById("font-opt-ui")?.value || "";

		let data = {};
		data["song_name_font"] = { "font_id": songFont || null, "value": songFont || null };
		data["lyrics_font"] = { "font_id": lyricsFont || null, "value": lyricsFont || null };
		data["ui_font"] = { "font_id": uiFont || null, "value": uiFont || null };

		try {
			let result = await Api.send("assets/php/fonts/saveFontOptions.php", data);
			if (result.success) {
				Toast.success("Font preferences saved.");
				if (message) { message.innerText = "Saved."; message.className = "modal-form-message success"; }
				ModalFonts.loadFontOptions();
			} else {
				if (result.feature_gated) {
					FeatureGate.showUpgradePrompt("custom_fonts");
				} else {
					if (message) { message.innerText = result.message || "Save failed."; message.className = "modal-form-message error"; }
				}
			}
		} catch (e) {
			if (message) { message.innerText = "Error saving."; message.className = "modal-form-message error"; }
		}
	}

	/**
	 * Updates the font preview area based on the current selection.
	 */
	static updatePreview() {
		let preview = document.getElementById("font-preview");
		if (!preview) return;

		let songSelect = document.getElementById("font-opt-song-name");
		let selectedId = songSelect ? songSelect.value : "";

		if (!selectedId) {
			preview.innerHTML = "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>Select a font to preview</div>";
			preview.style.fontFamily = "";
			return;
		}

		let font = null;
		for (let i = 0; i < ModalFonts.fonts.length; i++) {
			if (ModalFonts.fonts[i].id === selectedId) { font = ModalFonts.fonts[i]; break; }
		}
		if (font) {
			let family = "custom-" + font.name.replace(/[^a-zA-Z0-9]/g, "-");
			preview.style.fontFamily = "'" + family + "', sans-serif";
			preview.innerHTML = "<div style='font-size:24px;color:#FFF;'>The quick brown fox jumps over the lazy dog</div>" +
				"<div style='font-size:16px;color:rgba(255,255,255,0.6);margin-top:8px;'>0123456789 !@#$%^&*()</div>";
		}
	}

	/**
	 * Applies saved font preferences to page elements.
	 * Works with both the loaded fonts array and the options response data.
	 */
	static applyFonts() {
		let applyFont = function (optKey, elementId) {
			let opt = ModalFonts.options[optKey];
			if (!opt || !opt.font_id) return;

			// Resolve font name from fonts array or options response
			let fontName = null;
			for (let i = 0; i < ModalFonts.fonts.length; i++) {
				if (ModalFonts.fonts[i].id === opt.font_id) { fontName = ModalFonts.fonts[i].name; break; }
			}
			if (!fontName && opt.font_name) fontName = opt.font_name;
			if (!fontName) return;

			let family = "custom-" + fontName.replace(/[^a-zA-Z0-9]/g, "-");
			ModalFonts.injectFontFace(opt.font_id, fontName);
			let el = document.getElementById(elementId);
			if (el) el.style.fontFamily = "'" + family + "', sans-serif";
		};

		applyFont("song_name_font", "song-name");
		applyFont("lyrics_font", "caption");
	}

	/**
	 * Escapes HTML entities.
	 * @param {string} str
	 * @returns {string}
	 */
	static escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	/**
	 * Escapes a string for HTML attribute values.
	 * @param {string} str
	 * @returns {string}
	 */
	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
