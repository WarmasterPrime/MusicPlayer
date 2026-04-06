
class ModalAuth {

	static currentUser = null;

	/**
	 * Opens the login form in the modal.
	 */
	static openLogin() {
		Modal.open(ModalAuth.renderLogin());
		ModalAuth.attachLoginListeners();
	}

	/**
	 * Opens the registration form in the modal.
	 */
	static openRegister() {
		Modal.open(ModalAuth.renderRegister());
		ModalAuth.attachRegisterListeners();
	}

	/**
	 * Renders the login form HTML.
	 * @returns {string} HTML string.
	 */
	static renderLogin() {
		let html = "";
		html += "<div class='modal-form-title'>Login</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Username</label>";
		html += "<input type='text' id='login-username' autocomplete='username' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Password</label>";
		html += "<input type='password' id='login-password' autocomplete='current-password' />";
		html += "</div>";
		html += "<button class='modal-form-btn' id='login-btn'>Login</button>";
		html += "<div class='modal-form-message' id='login-message'></div>";
		html += "<div class='modal-form-link'>Don't have an account? <a id='login-to-register'>Register</a></div>";
		return html;
	}

	/**
	 * Renders the registration form HTML.
	 * @returns {string} HTML string.
	 */
	static renderRegister() {
		let html = "";
		html += "<div class='modal-form-title'>Register</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Username</label>";
		html += "<input type='text' id='register-username' autocomplete='username' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Password</label>";
		html += "<input type='password' id='register-password' autocomplete='new-password' />";
		html += "</div>";
		html += "<div class='modal-form-group'>";
		html += "<label>Confirm Password</label>";
		html += "<input type='password' id='register-password-confirm' autocomplete='new-password' />";
		html += "</div>";
		html += "<button class='modal-form-btn' id='register-btn'>Register</button>";
		html += "<div class='modal-form-message' id='register-message'></div>";
		html += "<div class='modal-form-link'>Already have an account? <a id='register-to-login'>Login</a></div>";
		return html;
	}

	/**
	 * Attaches event listeners to the login form elements.
	 */
	static attachLoginListeners() {
		let btn = document.getElementById("login-btn");
		if(btn) {
			btn.addEventListener("click", function() {
				ModalAuth.login();
			});
		}
		let pwInput = document.getElementById("login-password");
		if(pwInput) {
			pwInput.addEventListener("keypress", function(event) {
				if(event.key === "Enter")
					ModalAuth.login();
			});
		}
		let usernameInput = document.getElementById("login-username");
		if(usernameInput) {
			usernameInput.addEventListener("keypress", function(event) {
				if(event.key === "Enter")
					ModalAuth.login();
			});
			usernameInput.focus();
		}
		let toRegister = document.getElementById("login-to-register");
		if(toRegister) {
			toRegister.addEventListener("click", function() {
				ModalAuth.openRegister();
			});
		}
	}

	/**
	 * Attaches event listeners to the registration form elements.
	 */
	static attachRegisterListeners() {
		let btn = document.getElementById("register-btn");
		if(btn) {
			btn.addEventListener("click", function() {
				ModalAuth.register();
			});
		}
		let confirmInput = document.getElementById("register-password-confirm");
		if(confirmInput) {
			confirmInput.addEventListener("keypress", function(event) {
				if(event.key === "Enter")
					ModalAuth.register();
			});
		}
		let usernameInput = document.getElementById("register-username");
		if(usernameInput) {
			usernameInput.focus();
		}
		let toLogin = document.getElementById("register-to-login");
		if(toLogin) {
			toLogin.addEventListener("click", function() {
				ModalAuth.openLogin();
			});
		}
	}

	/**
	 * Sends the login request to the server.
	 */
	static login() {
		let username = document.getElementById("login-username");
		let password = document.getElementById("login-password");
		let message = document.getElementById("login-message");
		if(!username || !password) return;

		let u = username.value.trim();
		let p = password.value;

		if(u.length === 0 || p.length === 0) {
			ModalAuth.setMessage(message, "Please enter username and password.", "error");
			return;
		}

		ModalAuth.setMessage(message, "Logging in...", "");

		let a = {
			"src": "assets/php/login.php",
			"args": {
				"username": u,
				"password": p
			}
		};
		Server.send(a, true, function(response) {
			let data = audioLib.getValueFromServerResponse(response);
			try {
				if(typeof data === "string")
					data = JSON.parse(data);
			} catch(e) {}
			if(data && data.success === true) {
				ModalAuth.currentUser = data.user;
				ModalAuth.setMessage(message, "Login successful!", "success");
				ModalAuth.updateAuthButtons();
				setTimeout(function() { Modal.close(); }, 800);
			} else {
				let msg = data && data.message ? data.message : "Login failed.";
				ModalAuth.setMessage(message, msg, "error");
			}
		});
	}

	/**
	 * Sends the registration request to the server.
	 */
	static register() {
		let username = document.getElementById("register-username");
		let password = document.getElementById("register-password");
		let confirm = document.getElementById("register-password-confirm");
		let message = document.getElementById("register-message");
		if(!username || !password || !confirm) return;

		let u = username.value.trim();
		let p = password.value;
		let c = confirm.value;

		if(u.length === 0 || p.length === 0) {
			ModalAuth.setMessage(message, "Please fill in all fields.", "error");
			return;
		}
		if(p !== c) {
			ModalAuth.setMessage(message, "Passwords do not match.", "error");
			return;
		}
		if(u.length < 3) {
			ModalAuth.setMessage(message, "Username must be at least 3 characters.", "error");
			return;
		}
		if(p.length < 6) {
			ModalAuth.setMessage(message, "Password must be at least 6 characters.", "error");
			return;
		}

		ModalAuth.setMessage(message, "Registering...", "");

		let a = {
			"src": "assets/php/register.php",
			"args": {
				"username": u,
				"password": p
			}
		};
		Server.send(a, true, function(response) {
			let data = audioLib.getValueFromServerResponse(response);
			try {
				if(typeof data === "string")
					data = JSON.parse(data);
			} catch(e) {}
			if(data && data.success === true) {
				ModalAuth.currentUser = data.user;
				ModalAuth.setMessage(message, "Registration successful!", "success");
				ModalAuth.updateAuthButtons();
				setTimeout(function() { Modal.close(); }, 800);
			} else {
				let msg = data && data.message ? data.message : "Registration failed.";
				ModalAuth.setMessage(message, msg, "error");
			}
		});
	}

	/**
	 * Logs the current user out.
	 */
	static logout() {
		ModalAuth.currentUser = null;
		ModalAuth.updateAuthButtons();
	}

	/**
	 * Returns whether a user is currently logged in.
	 * @returns {boolean}
	 */
	static isLoggedIn() {
		return ModalAuth.currentUser !== null;
	}

	/**
	 * Updates the login/register/logout buttons in the nav bar based on auth state.
	 */
	static updateAuthButtons() {
		let container = document.getElementById("auth-buttons");
		if(!container) return;
		if(ModalAuth.isLoggedIn()) {
			container.innerHTML = "<span style='color:#FFF;font-family:arial;font-size:12px;margin-right:6px;'>0 - " + ModalAuth.escapeHtml(ModalAuth.currentUser.username) + "</span>" + "<button class='auth-btn' onclick='ModalAuth.logout()'>Logout</button>";
			// Insert check for background image if one exists in the user's profile...
			ModalAuth.fetchProfile();
		} else {
			container.innerHTML = "<button class='auth-btn' onclick='ModalAuth.openLogin()'>Login</button>" +
				"<button class='auth-btn' onclick='ModalAuth.openRegister()'>Register</button>";
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
				//let setVal = function (id, val) {
				//	let el = document.getElementById(id);
				//	if (el) el.value = val || "";
				//};
				//setVal("profile-first-name", p.first_name);
				//setVal("profile-last-name", p.last_name);
				//setVal("profile-email", p.email);
				//setVal("profile-phone", p.phone);
				//setVal("profile-country", p.country);
				//setVal("profile-region", p.region);
				//setVal("profile-language", p.language);
				//setVal("profile-dob", p.dob);
				let desc = document.getElementById("bg");
				console.log(p);
				if(p) {
					desc.style.backgroundImage = "url('assets/php/getBackgroundPicture.php?t=" + Date.now() + "')";
				}
			}
		} catch (e) {}
	}

	/**
	 * Sets a message element's text and style class.
	 * @param {HTMLElement} elm The message element.
	 * @param {string} text The message text.
	 * @param {string} type The message type ("error", "success", or "").
	 */
	static setMessage(elm, text, type) {
		if(elm) {
			elm.innerText = text;
			elm.className = "modal-form-message" + (type ? " " + type : "");
		}
	}

	/**
	 * Escapes HTML entities in a string.
	 * @param {string} str The string to escape.
	 * @returns {string}
	 */
	static escapeHtml(str) {
		if(typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

}
