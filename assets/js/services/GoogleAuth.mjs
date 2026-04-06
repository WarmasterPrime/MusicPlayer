import { Api } from "../Api.mjs";
import { Toast } from "../Toast.mjs";

/**
 * Handles Google OAuth button rendering and redirect initiation.
 */
export class GoogleAuth {

	/**
	 * Google "G" logo as inline SVG.
	 * @returns {string}
	 */
	static getGoogleLogoSvg() {
		return '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
	}

	/**
	 * Renders a Google login button HTML.
	 * @param {string} [text="Continue with Google"]
	 * @returns {string}
	 */
	static renderButton(text) {
		text = text || "Continue with Google";
		return "<button class='google-login-btn' id='google-login-btn'>" + GoogleAuth.getGoogleLogoSvg() + " " + text + "</button>";
	}

	/**
	 * Renders the "or" divider between Google and traditional auth.
	 * @returns {string}
	 */
	static renderDivider() {
		return "<div class='auth-divider'>or</div>";
	}

	/**
	 * Attaches click handler to the Google login button.
	 * Navigates to the Google OAuth initiation endpoint.
	 */
	static attachLoginListener() {
		let btn = document.getElementById("google-login-btn");
		if (btn) {
			btn.addEventListener("click", function () {
				GoogleAuth.initiateLogin();
			});
		}
	}

	/**
	 * Initiates the Google OAuth login flow.
	 * Redirects the browser to the PHP endpoint that builds the Google auth URL.
	 */
	static initiateLogin() {
		window.location.href = "assets/php/auth/googleLogin.php";
	}

	/**
	 * Initiates the Google OAuth link flow (for already logged-in users).
	 * Redirects to the link endpoint.
	 */
	static initiateLink() {
		window.location.href = "assets/php/auth/linkGoogle.php";
	}

	/**
	 * Unlinks the Google account from the current user.
	 * @returns {Promise<boolean>}
	 */
	static async unlink() {
		try {
			let result = await Api.send("assets/php/auth/unlinkGoogle.php");
			if (result && result.success) {
				Toast.success("Google account unlinked.");
				return true;
			} else {
				Toast.error(result.message || "Failed to unlink.");
				return false;
			}
		} catch (e) {
			Toast.error("Error unlinking Google account.");
			return false;
		}
	}

	/**
	 * Fetches the user's linked platforms.
	 * @returns {Promise<Array>}
	 */
	static async getLinkedPlatforms() {
		try {
			let result = await Api.send("assets/php/auth/getLinkedPlatforms.php");
			if (result && result.success) {
				return result.platforms || [];
			}
		} catch (e) {}
		return [];
	}
}
