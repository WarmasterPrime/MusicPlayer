import { Modal } from "./Modal.mjs";
import { Api } from "./Api.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { FeatureGate } from "./FeatureGate.mjs";

/**
 * Manages the song upload form within the modal tab.
 */
export class ModalUpload {

	static uploading = false;

	/**
	 * Renders the upload form HTML.
	 * @returns {string}
	 */
	static render() {
		let html = "";
		html += "<div class='modal-form-title'>Upload Song</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Title *</label>";
		html += "<input type='text' id='upload-title' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Artist</label>";
		html += "<input type='text' id='upload-artist' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Album</label>";
		html += "<input type='text' id='upload-album' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Genre</label>";
		html += "<input type='text' id='upload-genre' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Publisher</label>";
		html += "<input type='text' id='upload-publisher' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Keywords (comma-separated)</label>";
		html += "<input type='text' id='upload-keywords' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Audio File * (mp3, m4a, mp4, aac)</label>";
		html += "<input type='file' id='upload-file' accept='.mp3,.m4a,.mp4,.aac,audio/*' />";
		html += "</div>";
		html += "<div class='upload-progress' id='upload-progress' style='display:none;'>";
		html += "<div class='upload-progress-bar' id='upload-progress-bar'></div>";
		html += "</div>";
		html += "<button class='modal-form-btn' id='upload-btn'>Upload</button>";
		html += "<div class='modal-form-message' id='upload-message'></div>";
		return html;
	}

	/**
	 * Attaches event listeners to the upload form.
	 */
	static attachListeners() {
		let btn = document.getElementById("upload-btn");
		if (btn)
			btn.addEventListener("click", function () { ModalUpload.upload(); });

		let titleInput = document.getElementById("upload-title");
		let artistInput = document.getElementById("upload-artist");
		if (titleInput) {
			titleInput.addEventListener("blur", function () { ModalUpload.checkDuplicate(); });
		}
		if (artistInput) {
			artistInput.addEventListener("blur", function () { ModalUpload.checkDuplicate(); });
		}
	}

	/**
	 * Checks for duplicate title+artist combination.
	 */
	static async checkDuplicate() {
		let title = (document.getElementById("upload-title")?.value || "").trim();
		let artist = (document.getElementById("upload-artist")?.value || "").trim();
		let titleInput = document.getElementById("upload-title");
		if (title.length === 0) return;

		try {
			let result = await Api.send("assets/php/searchSongs.php", { "query": title, "limit": 5 });
			if (result.songs && result.songs.length > 0) {
				let duplicate = result.songs.find(function (s) {
					return s.title.toLowerCase() === title.toLowerCase() &&
						s.artist.toLowerCase() === artist.toLowerCase();
				});
				if (duplicate && titleInput) {
					titleInput.style.borderColor = "rgba(220, 50, 50, 0.8)";
					let msg = document.getElementById("upload-message");
					if (msg) {
						msg.innerText = "A song with this title and artist already exists.";
						msg.className = "modal-form-message error";
					}
					return;
				}
			}
		} catch (e) {}

		if (titleInput) titleInput.style.borderColor = "";
		let msg = document.getElementById("upload-message");
		if (msg && msg.classList.contains("error")) {
			msg.innerText = "";
			msg.className = "modal-form-message";
		}
	}

	/**
	 * Uploads the song to the server.
	 */
	static async upload() {
		if (ModalUpload.uploading) return;

		// Feature gate check
		if (!FeatureGate.check("file_upload")) {
			FeatureGate.showUpgradePrompt("file_upload");
			return;
		}

		let title = (document.getElementById("upload-title")?.value || "").trim();
		let fileInput = document.getElementById("upload-file");
		let message = document.getElementById("upload-message");

		if (title.length === 0) {
			if (message) {
				message.innerText = "Title is required.";
				message.className = "modal-form-message error";
			}
			return;
		}
		if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
			if (message) {
				message.innerText = "Please select an audio file.";
				message.className = "modal-form-message error";
			}
			return;
		}

		ModalUpload.uploading = true;
		let progressContainer = document.getElementById("upload-progress");
		let progressBar = document.getElementById("upload-progress-bar");
		if (progressContainer) progressContainer.style.display = "block";

		let formData = new FormData();
		formData.append("title", title);
		formData.append("artist", (document.getElementById("upload-artist")?.value || "").trim());
		formData.append("album", (document.getElementById("upload-album")?.value || "").trim());
		formData.append("genre", (document.getElementById("upload-genre")?.value || "").trim());
		formData.append("publisher", (document.getElementById("upload-publisher")?.value || "").trim());
		formData.append("keywords", (document.getElementById("upload-keywords")?.value || "").trim());
		formData.append("audio_file", fileInput.files[0]);

		try {
			let result = await Api.upload("assets/php/uploadSong.php", formData, function (percent) {
				if (progressBar) progressBar.style.width = percent + "%";
			});
			if (result.success) {
				Toast.success("Song uploaded!");
				if (message) {
					message.innerText = "Upload complete.";
					message.className = "modal-form-message success";
				}
			} else {
				Toast.error(result.message || "Upload failed.");
				if (message) {
					message.innerText = result.message || "Upload failed.";
					message.className = "modal-form-message error";
				}
			}
		} catch (e) {
			Toast.error("Upload error.");
			if (message) {
				message.innerText = "Upload error.";
				message.className = "modal-form-message error";
			}
		}

		ModalUpload.uploading = false;
		if (progressContainer) progressContainer.style.display = "none";
	}
}
