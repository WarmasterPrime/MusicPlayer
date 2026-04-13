import { Api } from "../Api.mjs";
import { Session } from "../Session.mjs";

/**
 * Chat API client with visibility-aware polling.
 * Polls every 3s when the chat is visible, 15s in background, stops when hidden completely.
 */
export class ChatService {

	static #pollTimer = null;
	static #pollInterval = 3000;
	static #bgInterval = 15000;
	static #conversationId = null;
	static #lastMessageTime = "";
	static #listeners = new Set();
	static #visible = false;
	static #pageVisible = true;
	static #unreadCount = 0;
	static #unreadListeners = new Set();
	static #modPollTimer = null;

	/**
	 * Initialize visibility tracking for efficient polling.
	 */
	static init() {
		document.addEventListener("visibilitychange", function () {
			ChatService.#pageVisible = document.visibilityState === "visible";
			ChatService.#adjustPolling();
		});
	}

	// ── User API ────────────────────────────────────

	/**
	 * Gets the current user's open conversation (creates none).
	 * @returns {Promise<object>}
	 */
	static async getMyConversation() {
		return Api.get("assets/php/chat/getConversation.php");
	}

	/**
	 * Gets a specific conversation by ID (moderator use).
	 * @param {string} conversationId
	 * @returns {Promise<object>}
	 */
	static async getConversation(conversationId) {
		return Api.get("assets/php/chat/getConversation.php?conversation_id=" + encodeURIComponent(conversationId));
	}

	/**
	 * Sends a text message. Creates a conversation if conversationId is empty.
	 * @param {string} conversationId
	 * @param {string} message
	 * @returns {Promise<object>}
	 */
	static async sendMessage(conversationId, message) {
		return Api.send("assets/php/chat/sendMessage.php", {
			conversation_id: conversationId,
			message: message
		});
	}

	/**
	 * Uploads a file attachment.
	 * @param {string} conversationId
	 * @param {File} file
	 * @param {string} message - Optional accompanying text.
	 * @returns {Promise<object>}
	 */
	static async uploadAttachment(conversationId, file, message = "") {
		let fd = new FormData();
		fd.append("conversation_id", conversationId);
		fd.append("message", message);
		fd.append("file", file);
		return Api.upload("assets/php/chat/uploadAttachment.php", fd);
	}

	/**
	 * Updates the typing indicator.
	 * @param {string} conversationId
	 * @param {string} content - Current text being typed.
	 */
	static async updateTyping(conversationId, content) {
		return Api.send("assets/php/chat/updateTyping.php", {
			conversation_id: conversationId,
			content: content
		});
	}

	// ── Moderator / Admin API ───────────────────────

	/**
	 * Lists conversations (mod/admin only).
	 * @param {string} status - "open", "closed", or "" for all.
	 * @param {number} page
	 * @returns {Promise<object>}
	 */
	static async listConversations(status = "open", page = 1) {
		let url = "assets/php/chat/listConversations.php?page=" + page;
		if (status) url += "&status=" + encodeURIComponent(status);
		return Api.get(url);
	}

	/**
	 * Closes a conversation (mod/admin only).
	 * @param {string} conversationId
	 * @returns {Promise<object>}
	 */
	static async closeConversation(conversationId) {
		return Api.send("assets/php/chat/closeConversation.php", {
			conversation_id: conversationId
		});
	}

	/**
	 * Deletes a conversation and all its data (mod/admin only).
	 * @param {string} conversationId
	 * @returns {Promise<object>}
	 */
	static async deleteConversation(conversationId) {
		return Api.send("assets/php/chat/deleteConversation.php", {
			conversation_id: conversationId
		});
	}

	// ── Polling ─────────────────────────────────────

	/**
	 * Start polling a conversation for new messages.
	 * @param {string} conversationId
	 */
	static startPolling(conversationId) {
		ChatService.stopPolling();
		ChatService.#conversationId = conversationId;
		ChatService.#visible = true;
		ChatService.#poll();
	}

	/**
	 * Stop active polling.
	 */
	static stopPolling() {
		if (ChatService.#pollTimer) {
			clearTimeout(ChatService.#pollTimer);
			ChatService.#pollTimer = null;
		}
		ChatService.#conversationId = null;
		ChatService.#lastMessageTime = "";
		ChatService.#visible = false;
	}

	/**
	 * Mark the chat UI as visible or hidden (for polling speed).
	 * @param {boolean} vis
	 */
	static setVisible(vis) {
		ChatService.#visible = vis;
		ChatService.#adjustPolling();
	}

	static #adjustPolling() {
		// If we have no conversation we're polling, nothing to adjust
		if (!ChatService.#conversationId) return;
		// Already scheduled — clearTimeout and reschedule at correct rate
		if (ChatService.#pollTimer) {
			clearTimeout(ChatService.#pollTimer);
			ChatService.#pollTimer = null;
		}
		if (ChatService.#visible && ChatService.#pageVisible) {
			ChatService.#schedulePoll(ChatService.#pollInterval);
		} else if (ChatService.#pageVisible) {
			// Chat tab not visible but page is — slow poll for notifications
			ChatService.#schedulePoll(ChatService.#bgInterval);
		}
		// If page hidden, don't poll at all
	}

	static #schedulePoll(delay) {
		ChatService.#pollTimer = setTimeout(function () {
			ChatService.#poll();
		}, delay);
	}

	static async #poll() {
		if (!ChatService.#conversationId) return;
		try {
			let url = "assets/php/chat/poll.php?conversation_id=" + encodeURIComponent(ChatService.#conversationId);
			if (ChatService.#lastMessageTime) {
				url += "&after=" + encodeURIComponent(ChatService.#lastMessageTime);
			}
			let result = await Api.get(url);
			if (result && result.success) {
				if (result.messages && result.messages.length > 0) {
					// Update last message time
					let lastMsg = result.messages[result.messages.length - 1];
					ChatService.#lastMessageTime = lastMsg.created_at;
				}
				// Notify listeners
				ChatService.#listeners.forEach(function (cb) {
					cb(result);
				});
			}
		} catch (e) {
			// Fail silently — will retry on next poll
		}
		// Schedule next poll
		ChatService.#adjustPolling();
	}

	/**
	 * Subscribe to poll updates.
	 * Callback receives: { messages: [], typing: null|obj, status: "open"|"closed" }
	 * @param {Function} callback
	 */
	static onUpdate(callback) {
		ChatService.#listeners.add(callback);
	}

	/**
	 * Unsubscribe from poll updates.
	 * @param {Function} callback
	 */
	static offUpdate(callback) {
		ChatService.#listeners.delete(callback);
	}

	// ── Unread Notification Counter ─────────────────

	/**
	 * Get current unread count.
	 * @returns {number}
	 */
	static get unreadCount() {
		return ChatService.#unreadCount;
	}

	/**
	 * Set the unread count and notify listeners.
	 * @param {number} count
	 */
	static set unreadCount(count) {
		ChatService.#unreadCount = count;
		ChatService.#unreadListeners.forEach(function (cb) {
			cb(count);
		});
	}

	/**
	 * Subscribe to unread count changes.
	 * @param {Function} callback - Receives the new count.
	 */
	static onUnreadChange(callback) {
		ChatService.#unreadListeners.add(callback);
	}

	/**
	 * Reset unread counter (e.g. when opening chat).
	 */
	static clearUnread() {
		ChatService.unreadCount = 0;
	}

	/**
	 * Sets the last known message timestamp so polling skips old messages.
	 * @param {string} timestamp
	 */
	static setLastMessageTime(timestamp) {
		ChatService.#lastMessageTime = timestamp;
	}
}
