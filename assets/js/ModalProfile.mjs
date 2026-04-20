import { Modal } from "./Modal.mjs";
import { Api } from "./Api.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { GoogleAuth } from "./services/GoogleAuth.mjs";
import { FeatureGate } from "./FeatureGate.mjs";
import { Tutorial } from "./Tutorial.mjs";

/**
 * Manages the user profile view and edit form within the modal tab.
 */
export class ModalProfile {

	/**
	 * Renders the profile form skeleton (fields populated after fetch).
	 * @returns {string}
	 */
	static render() {
		if (!Session.isLoggedIn()) {
			return "<div style='text-align:center;padding:40px;color:var(--text-muted,rgba(255,255,255,0.5));'>Please log in to view your profile.</div>";
		}

		let html = "";
		html += "<div class='modal-form-title'>Profile</div>";
		// Profile header with picture and username
		html += "<div class='profile-header'>";
		html += "<div class='profile-pic-wrap'>";
		html += "<div class='profile-pic' id='profile-pic-preview'></div>";
		html += "<input type='file' id='profile-pic-input' accept='image/*' style='display:none;' />";
		html += "<button class='modal-form-btn' id='profile-pic-btn' style='width:auto;font-size:12px;padding:4px 10px;margin-top:4px;'>Change Photo</button>";
		html += "</div>";
		html += "<div class='profile-username'>" + ModalProfile.escapeHtml(Session.user.username || "") + "</div>";
		html += "</div>";
		// Background image upload.
		html += "<br/>";
		html += "<div class='profile-header'>";
		html += "<div class='profile-pic-wrap'>";
		html += "<div class='profile-pic' id='background-pic-preview'></div>";
		html += "<input type='file' id='background-pic-input' accept='image/*' style='display:none;' />";
		html += "<button class='modal-form-btn' id='background-pic-btn' style='width:auto;font-size:12px;padding:4px 10px;margin-top:4px;'>Change Background</button>";
		html += " <button class='modal-form-btn' id='background-pic-remove' style='width:auto;font-size:12px;padding:4px 10px;margin-top:4px;background-color:rgba(220,50,50,0.3);border-color:rgba(220,50,50,0.3);'>Remove Background</button>";
		html += "</div>";
		html += "<div class='profile-username'>Background Image</div>";
		html += "</div>";
		

		html += "<div class='modal-form-group'><label>First Name</label><input type='text' id='profile-first-name' value='' /></div>";
		html += "<div class='modal-form-group'><label>Last Name</label><input type='text' id='profile-last-name' value='' /></div>";
		html += "<div class='modal-form-group'><label>Email</label><input type='email' id='profile-email' value='' /></div>";
		html += "<div class='modal-form-group'><label>Phone</label><input type='tel' id='profile-phone' value='' /></div>";
		html += "<div class='modal-form-group'><label>Country</label><input type='text' id='profile-country' value='' /></div>";
		html += "<div class='modal-form-group'><label>Region</label><input type='text' id='profile-region' value='' /></div>";
		html += "<div class='modal-form-group'><label>Language</label><input type='text' id='profile-language' value='' /></div>";
		html += "<div class='modal-form-group'><label>Description</label><textarea id='profile-description' rows='3'></textarea></div>";
		html += "<div class='modal-form-group'><label>Date of Birth</label><input type='date' id='profile-dob' value='' /></div>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";
		html += "<div class='modal-form-title' style='font-size:16px;'>Display Preferences</div>";
		html += "<div class='modal-form-group'><label>Song Display Format</label>";
		html += "<select id='profile-song-display-format'>";
		html += "<option value='artist-title'>Artist - Title</option>";
		html += "<option value='title-artist'>Title - Artist</option>";
		html += "</select></div>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";
		html += "<div class='modal-form-title' style='font-size:16px;'>Change Password</div>";
		html += "<div class='modal-form-group'><label>New Password</label><input type='password' id='profile-new-password' autocomplete='new-password' /></div>";
		html += "<div class='modal-form-group'><label>Confirm Password</label><input type='password' id='profile-confirm-password' autocomplete='new-password' /></div>";

		html += "<button class='modal-form-btn' id='profile-save'>Save Profile</button>";
		html += "<div class='modal-form-message' id='profile-message'></div>";

		html += "<hr style='border-color:rgba(255,50,100,0.2);margin:16px 0;' />";
		html += "<div class='modal-form-title' style='font-size:16px;'>Data Privacy</div>";
		html += "<div class='modal-form-group' style='text-align:center;'>";
		html += "<button class='modal-form-btn' id='profile-export-data' style='background:rgba(255,50,100,0.15); border-color:rgba(255,50,100,0.3);'>Download My Data</button>";
		html += "</div>";

		html += "<hr style='border-color:rgba(100,120,255,0.2);margin:16px 0;' />";
		html += "<div class='modal-form-title' style='font-size:16px;'>Help</div>";
		html += "<div class='modal-form-group' style='text-align:center;'>";
		html += "<button class='modal-form-btn' id='profile-replay-tutorial' style='background:rgba(80,120,255,0.15);border-color:rgba(80,120,255,0.3);'>Replay Tutorial</button>";
		html += "</div>";

		// Linked Accounts section
		html += "<div class='linked-accounts'>";
		html += "<div class='linked-accounts-title'>Linked Accounts</div>";
		html += "<div id='linked-accounts-list'><div style='color:rgba(255,255,255,0.4);font-size:13px;'>Loading...</div></div>";
		html += "</div>";
		return html;
	}

	/**
	 * Attaches event listeners and fetches profile data from the server.
	 */
	static attachListeners() {
		let saveBtn = document.getElementById("profile-save");
		if (saveBtn)
			saveBtn.addEventListener("click", function () { ModalProfile.save(); });

		let picBtn = document.getElementById("profile-pic-btn");
		let picInput = document.getElementById("profile-pic-input");
		
		if (picBtn && picInput) {
			picBtn.addEventListener("click", function () { picInput.click(); });
			picInput.addEventListener("change", function () {
				if (this.files && this.files[0]) {
					let reader = new FileReader();
					reader.onload = function (e) {
						let preview = document.getElementById("profile-pic-preview");
						if (preview)
							preview.style.backgroundImage = "url('" + e.target.result + "')";
					};
					reader.readAsDataURL(this.files[0]);
				}
			});
		}
		
		let bgBtn = document.getElementById("background-pic-btn");
		let bgInput = document.getElementById("background-pic-input");
		if (bgBtn && bgInput) {
			bgBtn.addEventListener("click", function () {
				if (!FeatureGate.check("custom_backgrounds")) {
					FeatureGate.showUpgradePrompt("custom_backgrounds");
					return;
				}
				bgInput.click();
			});
			bgInput.addEventListener("change", function () {
				if (this.files && this.files[0]) {
					let reader = new FileReader();
					reader.onload = function (e) {
						let preview = document.getElementById("background-pic-preview");
						if (preview)
							preview.style.backgroundImage = "url('" + e.target.result + "')";
					};
					reader.readAsDataURL(this.files[0]);
				}
			});
		}

		let removeBtn = document.getElementById("background-pic-remove");
		if (removeBtn) {
			removeBtn.addEventListener("click", async function () {
				if (!confirm("Remove your background image? This will make OBS transparent.")) return;
				try {
					let result = await Api.send("assets/php/deleteBackground.php", {});
					if (result.success) {
						Toast.success("Background removed.");
						let preview = document.getElementById("background-pic-preview");
						if (preview) preview.style.backgroundImage = "";
						// Clear page background
						let bg = document.getElementById("bg");
						if (bg) bg.style.backgroundImage = "";
					} else {
						Toast.error(result.message || "Failed.");
					}
				} catch (e) { Toast.error("Error removing background."); }
			});
		}

		let exportBtn = document.getElementById("profile-export-data");
		if (exportBtn) {
			exportBtn.addEventListener("click", function () {
				ModalProfile.promptDataExport();
			});
		}

		let tutorialBtn = document.getElementById("profile-replay-tutorial");
		if (tutorialBtn) {
			tutorialBtn.addEventListener("click", function () {
				Modal.close();
				setTimeout(function () { Tutorial.startForce(); }, 250);
			});
		}

		// Save song display format on change
		let displayFormatSelect = document.getElementById("profile-song-display-format");
		if (displayFormatSelect) {
			displayFormatSelect.addEventListener("change", async function () {
				try {
					let result = await Api.send("assets/php/saveUserPreference.php", {
						"key": "song_display_format",
						"value": this.value
					});
					if (result.success) {
						Toast.success("Display format saved.");
						Session.songDisplayFormat = this.value;
					}
				} catch (e) {}
			});
		}

		// Fetch profile data from server and populate fields
		ModalProfile.fetchProfile();
		ModalProfile.loadLinkedAccounts();
	}

	/**
	 * Prompts the user to choose an export format and initiates the download.
	 */
	static promptDataExport() {
		let html = "";
		html += "<div class='modal-form-title'>Download My Data</div>";
		html += "<p style='text-align:center;font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:20px;'>";
		html += "Select the format you would like to receive your data in:";
		html += "</p>";
		html += "<div class='modal-form-group'>";
		html += "<button class='modal-form-btn export-format-btn' data-format='txt' style='margin-bottom:8px;'>Text File (.txt)</button>";
		html += "<button class='modal-form-btn export-format-btn' data-format='csv' style='margin-bottom:8px;'>Spreadsheet (.csv)</button>";
		html += "<button class='modal-form-btn export-format-btn' data-format='json' style='margin-bottom:8px;'>JSON (.json)</button>";
		html += "</div>";
		html += "<button class='modal-form-btn' id='export-cancel' style='background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);margin-top:10px;'>Cancel</button>";

		Modal.openRaw(html);

		let btns = document.querySelectorAll(".export-format-btn");
		for (let i = 0; i < btns.length; i++) {
			btns[i].addEventListener("click", async function () {
				let format = this.getAttribute("data-format");
				Modal.open("profile");
				try {
					// credentials:"same-origin" ensures the session cookie is
					// attached on all browsers; without it some configurations
					// (e.g. strict cross-site cookies behind a reverse proxy)
					// drop the auth cookie and the PHP endpoint returns 401.
					let response = await fetch("assets/php/exportData.php?format=" + encodeURIComponent(format), {
						credentials: "same-origin"
					});
					if (!response.ok) {
						// Try to pull the server's error message so the user
						// knows WHY the export failed rather than a generic
						// "try again". Falls back to status text if the
						// response body isn't readable.
						let detail = "";
						try { detail = await response.text(); } catch (e) {}
						let status = response.status + " " + (response.statusText || "");
						console.warn("[exportData]", status, detail);
						let brief = (detail || status).trim().split("\n")[0].slice(0, 140);
						Toast.error("Export failed: " + (brief || status));
						return;
					}
					let blob = await response.blob();
					let filename = "MusicPlayer_Data." + format;
					let disposition = response.headers.get("Content-Disposition");
					if (disposition) {
						let match = disposition.match(/filename="([^"]+)"/);
						if (match) filename = match[1];
					}
					let url = URL.createObjectURL(blob);
					let a = document.createElement("a");
					a.href = url;
					a.download = filename;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				} catch (e) {
					console.error("[exportData]", e);
					Toast.error("Export failed: " + (e && e.message ? e.message : "network error"));
				}
			});
		}

		let cancel = document.getElementById("export-cancel");
		if (cancel) {
			cancel.addEventListener("click", function () {
				Modal.open("profile");
			});
		}
	}

	/**
	 * Loads and displays linked accounts in the profile.
	 */
	static async loadLinkedAccounts() {
		let container = document.getElementById("linked-accounts-list");
		if (!container) return;

		try {
			let platforms = await GoogleAuth.getLinkedPlatforms();
			let html = "";
			let hasGoogle = false;

			if (platforms.length === 0) {
				html += "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>No linked accounts.</div>";
			}

			for (let i = 0; i < platforms.length; i++) {
				let plat = platforms[i];
				if (plat.platform === "google") hasGoogle = true;
				html += "<div class='linked-account-item'>";
				html += "<div class='linked-account-info'>";
				html += "<span class='linked-account-platform'>" + ModalProfile.escapeHtml(plat.platform) + "</span>";
				if (plat.platform_email) {
					html += "<span class='linked-account-email'>" + ModalProfile.escapeHtml(plat.platform_email) + "</span>";
				}
				html += "</div>";
				html += "<button class='linked-account-unlink' data-platform='" + ModalProfile.escapeAttr(plat.platform) + "'>Unlink</button>";
				html += "</div>";
			}

			if (!hasGoogle) {
				html += "<button class='google-login-btn' id='link-google-btn' style='margin-top:8px;'>";
				html += GoogleAuth.getGoogleLogoSvg() + " Link Google Account</button>";
			}

			container.innerHTML = html;

			let linkBtn = document.getElementById("link-google-btn");
			if (linkBtn) {
				linkBtn.addEventListener("click", function () { GoogleAuth.initiateLink(); });
			}

			let unlinkBtns = container.querySelectorAll(".linked-account-unlink");
			for (let i = 0; i < unlinkBtns.length; i++) {
				unlinkBtns[i].addEventListener("click", async function () {
					let platform = this.getAttribute("data-platform");
					if (platform === "google") {
						let success = await GoogleAuth.unlink();
						if (success) ModalProfile.loadLinkedAccounts();
					}
				});
			}
		} catch (e) {
			container.innerHTML = "<div style='color:rgba(255,255,255,0.4);font-size:13px;'>Failed to load linked accounts.</div>";
		}
	}

	/**
	 * Fetches the user profile from the server and populates the form fields.
	 */
	static async fetchProfile() {
		try {
			let result = await Api.get("assets/php/getProfile.php");
			if (result.success && result.profile) {
				let p = result.profile;
				let setVal = function (id, val) {
					let el = document.getElementById(id);
					if (el) el.value = val || "";
				};
				setVal("profile-first-name", p.first_name);
				setVal("profile-last-name", p.last_name);
				setVal("profile-email", p.email);
				setVal("profile-phone", p.phone);
				setVal("profile-country", p.country);
				setVal("profile-region", p.region);
				setVal("profile-language", p.language);
				setVal("profile-dob", p.dob);
				let desc = document.getElementById("profile-description");
				if (desc) desc.value = p.description || "";
				
				// Load profile picture if one exists
				if (p.has_picture) {
					let preview = document.getElementById("profile-pic-preview");
					if (preview)
						preview.style.backgroundImage = "url('assets/php/getProfilePicture.php?t=" + Date.now() + "')";
				}
				if(p.has_bg) {
					let preview = document.getElementById("background-pic-preview");
					if (preview)
						preview.style.backgroundImage = "url('assets/php/getBackgroundPicture.php?t=" + Date.now() + "')";
				}
			}
		} catch (e) {}

		// Load display preferences
		try {
			let prefResult = await Api.get("assets/php/getUserPreferences.php");
			if (prefResult.success && prefResult.preferences) {
				let fmt = prefResult.preferences["song_display_format"];
				if (fmt) {
					let sel = document.getElementById("profile-song-display-format");
					if (sel) sel.value = fmt;
					Session.songDisplayFormat = fmt;
				}
			}
		} catch (e) {}
	}

	/**
	 * Saves the profile data to the server.
	 */
	static async save() {
		let message = document.getElementById("profile-message");
		let newPw = (document.getElementById("profile-new-password")?.value || "");
		let confirmPw = (document.getElementById("profile-confirm-password")?.value || "");

		if (newPw.length > 0 && newPw !== confirmPw) {
			if (message) {
				message.innerText = "Passwords do not match.";
				message.className = "modal-form-message error";
			}
			return;
		}
		if (newPw.length > 0 && newPw.length < 6) {
			if (message) {
				message.innerText = "Password must be at least 6 characters.";
				message.className = "modal-form-message error";
			}
			return;
		}

		let picInput = document.getElementById("profile-pic-input");
		let hasFile = picInput && picInput.files && picInput.files.length > 0;
		
		let bgInput = document.getElementById("background-pic-input");
		let hasBgFile = bgInput && bgInput.files && bgInput.files.length > 0;
		
		if (hasFile || hasBgFile) {
			// Use FormData for file upload
			let formData = new FormData();
			formData.append("first_name", document.getElementById("profile-first-name")?.value || "");
			formData.append("last_name", document.getElementById("profile-last-name")?.value || "");
			formData.append("email", document.getElementById("profile-email")?.value || "");
			formData.append("phone", document.getElementById("profile-phone")?.value || "");
			formData.append("country", document.getElementById("profile-country")?.value || "");
			formData.append("region", document.getElementById("profile-region")?.value || "");
			formData.append("language", document.getElementById("profile-language")?.value || "");
			formData.append("description", document.getElementById("profile-description")?.value || "");
			formData.append("dob", document.getElementById("profile-dob")?.value || "");
			if (newPw.length > 0) {
				formData.append("new_password", newPw);
				formData.append("confirm_password", confirmPw);
			}
			if(hasFile)
				formData.append("profile_picture", picInput.files[0]);
			if(hasBgFile)
				formData.append("background", bgInput.files[0]);
			
			try {
				let result = await Api.upload("assets/php/updateProfile.php", formData);
				ModalProfile.handleSaveResult(result, message);
			} catch (e) {
				Toast.error("Save error.");
			}
		} else {
			let data = {
				"first_name": document.getElementById("profile-first-name")?.value || "",
				"last_name": document.getElementById("profile-last-name")?.value || "",
				"email": document.getElementById("profile-email")?.value || "",
				"phone": document.getElementById("profile-phone")?.value || "",
				"country": document.getElementById("profile-country")?.value || "",
				"region": document.getElementById("profile-region")?.value || "",
				"language": document.getElementById("profile-language")?.value || "",
				"description": document.getElementById("profile-description")?.value || "",
				"dob": document.getElementById("profile-dob")?.value || ""
			};
			if (newPw.length > 0) {
				data["new_password"] = newPw;
				data["confirm_password"] = confirmPw;
			}

			try {
				let result = await Api.send("assets/php/updateProfile.php", data);
				ModalProfile.handleSaveResult(result, message);
			} catch (e) {
				Toast.error("Save error.");
			}
		}
	}

	/**
	 * Handles the save response.
	 * @param {object} result - The server response.
	 * @param {HTMLElement} message - The message element.
	 */
	static handleSaveResult(result, message) {
		if (result.success) {
			Toast.success("Profile saved.");
			if (message) {
				message.innerText = "Profile updated.";
				message.className = "modal-form-message success";
			}
			// Clear password fields
			let pw = document.getElementById("profile-new-password");
			let cpw = document.getElementById("profile-confirm-password");
			if (pw) pw.value = "";
			if (cpw) cpw.value = "";
			// Refresh page background if a new background was uploaded
			let bgInput = document.getElementById("background-pic-input");
			if (bgInput && bgInput.files && bgInput.files.length > 0) {
				let bg = document.getElementById("bg");
				if (bg) {
					bg.style.backgroundImage = "url('assets/php/getBackgroundPicture.php?t=" + Date.now() + "')";
					bg.style.backgroundSize = "cover";
					bg.style.backgroundPosition = "center";
				}
			}
		} else {
			Toast.error(result.message || "Save failed.");
			if (message) {
				message.innerText = result.message || "Save failed.";
				message.className = "modal-form-message error";
			}
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
	 * Escapes a string for HTML attribute values.
	 * @param {string} str
	 * @returns {string}
	 */
	static escapeAttr(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
}
