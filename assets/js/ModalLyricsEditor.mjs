import { Modal } from "./Modal.mjs";
import { Api } from "./Api.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { AudioLibrary } from "./AudioLibrary.mjs";
import { ModalSongManagement } from "./ModalSongManagement.mjs";
import { FeatureGate } from "./FeatureGate.mjs";

/**
 * Lyrics editor with themed table UI, auto-save, and timestamp validation.
 */
export class ModalLyricsEditor {

	static songId = null;
	static rows = [];
	static saveTimer = null;
	static saveDelay = 2000;
	static dirty = false;

	/**
	 * Opens the lyrics editor for a specific song.
	 * @param {string} songId - The song database ID.
	 */
	static async open(songId) {
		// Feature gate check
		if (!FeatureGate.check("lyrics_editing")) {
			FeatureGate.showUpgradePrompt("lyrics_editing");
			return;
		}

		ModalLyricsEditor.songId = songId;
		ModalLyricsEditor.dirty = false;
		try {
			let result = await Api.send("assets/php/getLyrics.php", { "song_id": songId });
			if (result) {
				let lyrics = result;
				if (typeof lyrics === "string")
					lyrics = JSON.parse(lyrics);
				if (Array.isArray(lyrics)) {
					ModalLyricsEditor.rows = lyrics.map(function (entry) {
						return { timestamp: entry.timestamp ?? 0, text: entry.text ?? "" };
					});
				} else {
					ModalLyricsEditor.rows = lyrics.map(function(key, value) {
						return {timestamp: key, text: value};
					});
				}
			} else {
				ModalLyricsEditor.rows = [];
			}
		} catch (e) {
			ModalLyricsEditor.rows = [];
		}
		Modal.setContent(ModalLyricsEditor.render());
		ModalLyricsEditor.attachListeners();
	}

	/**
	 * Renders the lyrics editor table HTML.
	 * @returns {string}
	 */
	static render() {
		let html = "";
		html += "<button class='modal-form-btn' id='manage-back' style='width:auto;margin-bottom:12px;'>Back</button>";
		html += "<div class='modal-form-title'>Lyrics Editor</div>";
		html += "<div class='lyrics-editor-info'>Song ID: " + ModalLyricsEditor.escapeHtml(ModalLyricsEditor.songId || "") + "</div>";
		html += "<div class='lyrics-editor-table-wrap'>";
		html += "<table class='lyrics-editor-table' id='lyrics-table'>";
		html += "<thead><tr><th>Timestamp (ms)</th><th>Lyrics Text</th><th></th></tr></thead>";
		html += "<tbody id='lyrics-tbody'>";
		for (let i = 0; i < ModalLyricsEditor.rows.length; i++) {
			html += ModalLyricsEditor.renderRow(i);
		}
		html += "</tbody>";
		html += "</table>";
		html += "</div>";
		html += "<div class='lyrics-editor-actions'>";
		html += "<button class='modal-form-btn' id='lyrics-add-row' style='width:auto;'>+ Add Row</button>";
		html += "<button class='modal-form-btn' id='lyrics-sort' style='width:auto;margin-left:8px;'>Sort by Time</button>";
		html += "<button class='modal-form-btn' id='lyrics-save' style='width:auto;margin-left:8px;'>Save Now</button>";
		html += "</div>";
		html += "<div class='lyrics-editor-status' id='lyrics-status'></div>";
		return html;
	}

	/**
	 * Renders a single row of the lyrics table.
	 * @param {number} index - The row index.
	 * @returns {string}
	 */
	static renderRow(index) {
		let row = ModalLyricsEditor.rows[index];
		let html = "<tr class='lyrics-row' data-index='" + index + "'>";
		html += "<td><input type='number' class='lyrics-ts' data-index='" + index + "' value='" + (row.timestamp || 0) + "' min='0' step='100' /></td>";
		html += "<td><input type='text' class='lyrics-text' data-index='" + index + "' value='" + ModalLyricsEditor.escapeAttr(row.text || "") + "' /></td>";
		html += "<td><button class='lyrics-delete-btn' data-index='" + index + "'>X</button></td>";
		html += "</tr>";
		return html;
	}

	/**
	 * Attaches event listeners to the editor.
	 */
	static attachListeners() {
		let addBtn = document.getElementById("lyrics-add-row");
		if (addBtn) {
			addBtn.addEventListener("click", function () {
				ModalLyricsEditor.rows.push({ timestamp: 0, text: "" });
				ModalLyricsEditor.refreshTable();
				ModalLyricsEditor.markDirty();
			});
		}

		let sortBtn = document.getElementById("lyrics-sort");
		if (sortBtn) {
			sortBtn.addEventListener("click", function () {
				ModalLyricsEditor.rows.sort(function (a, b) { return a.timestamp - b.timestamp; });
				ModalLyricsEditor.refreshTable();
				Toast.success("Sorted by timestamp.");
			});
		}

		let saveBtn = document.getElementById("lyrics-save");
		if (saveBtn) {
			saveBtn.addEventListener("click", function () {
				ModalLyricsEditor.save();
			});
		}

		ModalLyricsEditor.attachTableListeners();
	}

	/**
	 * Attaches event delegation for table inputs.
	 */
	static attachTableListeners() {
		
		let backBtn = document.getElementById("manage-back");
		if (backBtn) {
			backBtn.addEventListener("click", function () {
				ModalSongManagement.editingSongId = ModalLyricsEditor.songId;
				Modal.setContent(ModalSongManagement.render());
				//ModalSongManagement.attachEditListeners();
				setTimeout(function () { ModalSongManagement.attachListeners(); }, 0);
				Modal.refreshTabs();
			});
		}
		
		let tbody = document.getElementById("lyrics-tbody");
		if (!tbody) return;

		tbody.addEventListener("input", function (event) {
			let el = event.target;
			let index = parseInt(el.getAttribute("data-index"));
			if (isNaN(index) || index < 0 || index >= ModalLyricsEditor.rows.length) return;

			if (el.classList.contains("lyrics-ts")) {
				let val = parseFloat(el.value);
				if (!isNaN(val) && val >= 0) {
					ModalLyricsEditor.rows[index].timestamp = val;
					ModalLyricsEditor.markDirty();
				}
			} else if (el.classList.contains("lyrics-text")) {
				ModalLyricsEditor.rows[index].text = el.value;
				ModalLyricsEditor.markDirty();
			}
		});

		tbody.addEventListener("click", function (event) {
			let btn = event.target.closest(".lyrics-delete-btn");
			if (btn) {
				let index = parseInt(btn.getAttribute("data-index"));
				if (!isNaN(index) && index >= 0 && index < ModalLyricsEditor.rows.length) {
					ModalLyricsEditor.rows.splice(index, 1);
					ModalLyricsEditor.refreshTable();
					ModalLyricsEditor.markDirty();
				}
			}
		});
	}

	/**
	 * Refreshes the table body HTML.
	 */
	static refreshTable() {
		let tbody = document.getElementById("lyrics-tbody");
		if (!tbody) return;
		let html = "";
		for (let i = 0; i < ModalLyricsEditor.rows.length; i++) {
			html += ModalLyricsEditor.renderRow(i);
		}
		tbody.innerHTML = html;
	}

	/**
	 * Marks the editor as having unsaved changes and starts the auto-save timer.
	 */
	static markDirty() {
		ModalLyricsEditor.dirty = true;
		if (ModalLyricsEditor.saveTimer !== null) {
			clearTimeout(ModalLyricsEditor.saveTimer);
		}
		ModalLyricsEditor.saveTimer = setTimeout(function () {
			ModalLyricsEditor.save();
		}, ModalLyricsEditor.saveDelay);

		let status = document.getElementById("lyrics-status");
		if (status) status.innerText = "Unsaved changes...";
	}

	/**
	 * Saves lyrics to the server.
	 */
	static async save() {
		if (ModalLyricsEditor.saveTimer !== null) {
			clearTimeout(ModalLyricsEditor.saveTimer);
			ModalLyricsEditor.saveTimer = null;
		}

		let status = document.getElementById("lyrics-status");
		if (status) status.innerText = "Saving...";

		// Check for out-of-order timestamps
		let outOfOrder = false;
		for (let i = 1; i < ModalLyricsEditor.rows.length; i++) {
			if (ModalLyricsEditor.rows[i].timestamp < ModalLyricsEditor.rows[i - 1].timestamp) {
				outOfOrder = true;
				break;
			}
		}
		if (outOfOrder) {
			if (status) status.innerText = "Warning: Timestamps are out of order. Use Sort to fix.";
		}

		try {
			let result = await Api.send("assets/php/saveLyrics.php", {
				"song_id": ModalLyricsEditor.songId,
				"lyrics_json": ModalLyricsEditor.rows
			});
			if (result.success) {
				ModalLyricsEditor.dirty = false;
				Toast.success("Lyrics saved.");
				if (status) status.innerText = "Saved.";
			} else {
				Toast.error(result.message || "Save failed.");
				if (status) status.innerText = "Save failed.";
			}
		} catch (e) {
			Toast.error("Save error.");
			if (status) status.innerText = "Save error.";
		}
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
	 * Escapes a string for use in HTML attributes.
	 * @param {string} str
	 * @returns {string}
	 */
	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
