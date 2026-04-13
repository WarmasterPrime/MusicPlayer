import { Modal } from "./Modal.mjs";
import { Session } from "./Session.mjs";
import { Toast } from "./Toast.mjs";
import { ChatService } from "./services/ChatService.mjs";

/**
 * Live chat modal tab.
 * Users see their single conversation with support.
 * Moderators/admins see a conversation list and can open any thread.
 */
export class ModalChat {

	static #conversationId = "";
	static #messages = [];
	static #typingIndicator = null;
	static #typingTimeout = null;
	static #lastTypingSent = 0;
	static #isMod = false;
	static #conversations = [];
	static #convPage = 1;
	static #convPages = 1;
	static #convFilter = "open";
	static #activeView = "chat"; // "chat" or "list"
	static #mounted = false;
	static #scrollLocked = true;

	/**
	 * Renders the chat tab HTML.
	 * @returns {string}
	 */
	static render() {
		ModalChat.#isMod = Session.hasFlag("Moderator") || Session.hasFlag("UserAdmin");

		if (ModalChat.#isMod) {
			return ModalChat.#renderModView();
		}
		return ModalChat.#renderUserView();
	}

	/**
	 * Called after the tab content is injected into the DOM.
	 */
	static onMount() {
		ModalChat.#mounted = true;
		ChatService.setVisible(true);

		if (ModalChat.#isMod) {
			ModalChat.#mountModView();
		} else {
			ModalChat.#mountUserView();
		}
	}

	/**
	 * Called when switching away from the chat tab.
	 */
	static onUnmount() {
		ModalChat.#mounted = false;
		ChatService.setVisible(false);
	}

	// ═══════════════════════════════════════════════
	//  USER VIEW
	// ═══════════════════════════════════════════════

	static #renderUserView() {
		return `
			<div class="chat-container">
				<div class="chat-header">
					<span class="chat-header-title">Support Chat</span>
					<span class="chat-header-status" id="chat-status"></span>
				</div>
				<div class="chat-messages" id="chat-messages">
					<div class="chat-loading">Loading...</div>
				</div>
				<div class="chat-typing-indicator" id="chat-typing" style="display:none;">
					<span class="chat-typing-dots"><span></span><span></span><span></span></span>
					<span class="chat-typing-label" id="chat-typing-label">Support is typing...</span>
				</div>
				<div class="chat-input-area" id="chat-input-area">
					<div class="chat-input-row">
						<label class="chat-attach-btn" title="Attach file">
							<input type="file" id="chat-file-input" style="display:none;"
								accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt">
							<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
								stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
							</svg>
						</label>
						<textarea class="chat-input" id="chat-input" placeholder="Type a message..." rows="1"></textarea>
						<button class="chat-send-btn" id="chat-send-btn" title="Send">
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
							</svg>
						</button>
					</div>
					<div class="chat-file-preview" id="chat-file-preview" style="display:none;"></div>
				</div>
			</div>`;
	}

	static async #mountUserView() {
		ModalChat.#attachInputListeners();

		// Load existing conversation
		let result = await ChatService.getMyConversation();
		if (result && result.success && result.conversation) {
			ModalChat.#conversationId = result.conversation.id;
			ModalChat.#messages = result.conversation.messages || [];
			ModalChat.#renderMessages();

			let statusEl = document.getElementById("chat-status");
			if (statusEl) statusEl.textContent = result.conversation.status === "open" ? "Online" : "Closed";

			// Start polling
			if (result.conversation.messages && result.conversation.messages.length > 0) {
				let last = result.conversation.messages[result.conversation.messages.length - 1];
				ChatService.setLastMessageTime(last.created_at);
			}
			ChatService.startPolling(ModalChat.#conversationId);
		} else {
			ModalChat.#renderEmpty();
		}

		ChatService.onUpdate(ModalChat.#onPollUpdate);
		ChatService.clearUnread();
	}

	// ═══════════════════════════════════════════════
	//  MODERATOR VIEW
	// ═══════════════════════════════════════════════

	static #renderModView() {
		if (ModalChat.#activeView === "list" || !ModalChat.#conversationId) {
			return ModalChat.#renderConversationList();
		}
		return ModalChat.#renderModConversation();
	}

	static #renderConversationList() {
		return `
			<div class="chat-container chat-mod-container">
				<div class="chat-header">
					<span class="chat-header-title">Support Conversations</span>
					<div class="chat-filter-row">
						<button class="chat-filter-btn ${ModalChat.#convFilter === "open" ? "active" : ""}" data-filter="open">Open</button>
						<button class="chat-filter-btn ${ModalChat.#convFilter === "closed" ? "active" : ""}" data-filter="closed">Closed</button>
						<button class="chat-filter-btn ${ModalChat.#convFilter === "" ? "active" : ""}" data-filter="">All</button>
					</div>
				</div>
				<div class="chat-conv-list" id="chat-conv-list">
					<div class="chat-loading">Loading conversations...</div>
				</div>
				<div class="chat-pagination" id="chat-pagination"></div>
			</div>`;
	}

	static #renderModConversation() {
		return `
			<div class="chat-container">
				<div class="chat-header">
					<button class="chat-back-btn" id="chat-back-btn" title="Back to conversations">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="15 18 9 12 15 6"/>
						</svg>
					</button>
					<span class="chat-header-title" id="chat-conv-title">Conversation</span>
					<span class="chat-header-status" id="chat-status"></span>
					<div class="chat-mod-actions">
						<button class="chat-action-btn chat-close-conv-btn" id="chat-close-conv" title="Close conversation">Close</button>
						<button class="chat-action-btn chat-delete-conv-btn" id="chat-delete-conv" title="Delete conversation">Delete</button>
					</div>
				</div>
				<div class="chat-messages" id="chat-messages">
					<div class="chat-loading">Loading...</div>
				</div>
				<div class="chat-typing-indicator" id="chat-typing" style="display:none;">
					<span class="chat-typing-dots"><span></span><span></span><span></span></span>
					<span class="chat-typing-label" id="chat-typing-label">User is typing...</span>
				</div>
				<div class="chat-input-area" id="chat-input-area">
					<div class="chat-input-row">
						<label class="chat-attach-btn" title="Attach file">
							<input type="file" id="chat-file-input" style="display:none;"
								accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt">
							<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
								stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
							</svg>
						</label>
						<textarea class="chat-input" id="chat-input" placeholder="Type a reply..." rows="1"></textarea>
						<button class="chat-send-btn" id="chat-send-btn" title="Send">
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
							</svg>
						</button>
					</div>
					<div class="chat-file-preview" id="chat-file-preview" style="display:none;"></div>
				</div>
			</div>`;
	}

	static async #mountModView() {
		if (ModalChat.#activeView === "list" || !ModalChat.#conversationId) {
			ModalChat.#activeView = "list";
			ModalChat.#attachFilterListeners();
			await ModalChat.#loadConversationList();
		} else {
			await ModalChat.#openModConversation(ModalChat.#conversationId);
		}
	}

	static #attachFilterListeners() {
		let filterBtns = document.querySelectorAll(".chat-filter-btn");
		filterBtns.forEach(function (btn) {
			btn.addEventListener("click", function () {
				ModalChat.#convFilter = btn.getAttribute("data-filter");
				ModalChat.#convPage = 1;
				filterBtns.forEach(function (b) { b.classList.remove("active"); });
				btn.classList.add("active");
				ModalChat.#loadConversationList();
			});
		});
	}

	static async #loadConversationList() {
		let listEl = document.getElementById("chat-conv-list");
		if (listEl) listEl.innerHTML = '<div class="chat-loading">Loading conversations...</div>';

		let result = await ChatService.listConversations(ModalChat.#convFilter, ModalChat.#convPage);
		if (!result || !result.success) {
			if (listEl) listEl.innerHTML = '<div class="chat-empty">Failed to load conversations.</div>';
			return;
		}

		ModalChat.#conversations = result.conversations || [];
		ModalChat.#convPages = result.pages || 1;

		if (ModalChat.#conversations.length === 0) {
			if (listEl) listEl.innerHTML = '<div class="chat-empty">No conversations found.</div>';
			ModalChat.#renderPagination();
			return;
		}

		let html = "";
		ModalChat.#conversations.forEach(function (conv) {
			let timeStr = ModalChat.#formatTime(conv.last_activity);
			let preview = conv.last_message || "No messages yet";
			if (preview.length > 60) preview = preview.substring(0, 60) + "...";
			let statusClass = conv.status === "open" ? "chat-status-open" : "chat-status-closed";
			html += `
				<div class="chat-conv-item" data-id="${conv.id}">
					<div class="chat-conv-item-header">
						<span class="chat-conv-username">${ModalChat.#esc(conv.username || "Unknown")}</span>
						<span class="chat-conv-time">${timeStr}</span>
					</div>
					<div class="chat-conv-preview">${ModalChat.#esc(preview)}</div>
					<span class="chat-conv-status ${statusClass}">${conv.status}</span>
				</div>`;
		});

		if (listEl) {
			listEl.innerHTML = html;
			listEl.querySelectorAll(".chat-conv-item").forEach(function (el) {
				el.addEventListener("click", function () {
					let id = el.getAttribute("data-id");
					ModalChat.#conversationId = id;
					ModalChat.#activeView = "chat";
					Modal.setContent(ModalChat.#renderModConversation());
					ModalChat.#openModConversation(id);
				});
			});
		}

		ModalChat.#renderPagination();
	}

	static #renderPagination() {
		let pagEl = document.getElementById("chat-pagination");
		if (!pagEl) return;
		if (ModalChat.#convPages <= 1) {
			pagEl.innerHTML = "";
			return;
		}
		let html = "";
		if (ModalChat.#convPage > 1) {
			html += '<button class="chat-page-btn" data-page="' + (ModalChat.#convPage - 1) + '">Prev</button>';
		}
		html += '<span class="chat-page-info">Page ' + ModalChat.#convPage + ' of ' + ModalChat.#convPages + '</span>';
		if (ModalChat.#convPage < ModalChat.#convPages) {
			html += '<button class="chat-page-btn" data-page="' + (ModalChat.#convPage + 1) + '">Next</button>';
		}
		pagEl.innerHTML = html;
		pagEl.querySelectorAll(".chat-page-btn").forEach(function (btn) {
			btn.addEventListener("click", function () {
				ModalChat.#convPage = parseInt(btn.getAttribute("data-page"), 10);
				ModalChat.#loadConversationList();
			});
		});
	}

	static async #openModConversation(conversationId) {
		ModalChat.#attachInputListeners();

		let backBtn = document.getElementById("chat-back-btn");
		if (backBtn) {
			backBtn.addEventListener("click", function () {
				ChatService.stopPolling();
				ChatService.offUpdate(ModalChat.#onPollUpdate);
				ModalChat.#conversationId = "";
				ModalChat.#messages = [];
				ModalChat.#activeView = "list";
				Modal.setContent(ModalChat.#renderConversationList());
				ModalChat.#attachFilterListeners();
				ModalChat.#loadConversationList();
			});
		}

		let closeBtn = document.getElementById("chat-close-conv");
		if (closeBtn) {
			closeBtn.addEventListener("click", async function () {
				let result = await ChatService.closeConversation(conversationId);
				if (result && result.success) {
					Toast.success("Conversation closed.");
					let statusEl = document.getElementById("chat-status");
					if (statusEl) statusEl.textContent = "Closed";
				} else {
					Toast.error("Failed to close conversation.");
				}
			});
		}

		let deleteBtn = document.getElementById("chat-delete-conv");
		if (deleteBtn) {
			deleteBtn.addEventListener("click", async function () {
				if (!confirm("Delete this conversation and all its data?")) return;
				let result = await ChatService.deleteConversation(conversationId);
				if (result && result.success) {
					Toast.success("Conversation deleted.");
					ChatService.stopPolling();
					ChatService.offUpdate(ModalChat.#onPollUpdate);
					ModalChat.#conversationId = "";
					ModalChat.#messages = [];
					ModalChat.#activeView = "list";
					Modal.setContent(ModalChat.#renderConversationList());
					ModalChat.#attachFilterListeners();
					ModalChat.#loadConversationList();
				} else {
					Toast.error("Failed to delete conversation.");
				}
			});
		}

		// Load conversation
		let result = await ChatService.getConversation(conversationId);
		if (result && result.success && result.conversation) {
			ModalChat.#messages = result.conversation.messages || [];
			ModalChat.#renderMessages();

			let titleEl = document.getElementById("chat-conv-title");
			if (titleEl) titleEl.textContent = "Chat with " + (result.conversation.user_username || "User");

			let statusEl = document.getElementById("chat-status");
			if (statusEl) statusEl.textContent = result.conversation.status === "open" ? "Open" : "Closed";

			if (ModalChat.#messages.length > 0) {
				let last = ModalChat.#messages[ModalChat.#messages.length - 1];
				ChatService.setLastMessageTime(last.created_at);
			}
			ChatService.startPolling(conversationId);
			ChatService.onUpdate(ModalChat.#onPollUpdate);
		}
	}

	// ═══════════════════════════════════════════════
	//  SHARED INPUT / SEND LOGIC
	// ═══════════════════════════════════════════════

	static #attachInputListeners() {
		let input = document.getElementById("chat-input");
		let sendBtn = document.getElementById("chat-send-btn");
		let fileInput = document.getElementById("chat-file-input");

		if (input) {
			input.addEventListener("input", function () {
				ModalChat.#autoResizeInput(input);
				ModalChat.#handleTyping();
			});
			input.addEventListener("keydown", function (e) {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					ModalChat.#sendCurrentMessage();
				}
			});
		}

		if (sendBtn) {
			sendBtn.addEventListener("click", function () {
				ModalChat.#sendCurrentMessage();
			});
		}

		if (fileInput) {
			fileInput.addEventListener("change", function () {
				let file = fileInput.files[0];
				if (!file) return;
				if (file.size > 5 * 1024 * 1024) {
					Toast.error("File too large. Maximum size is 5MB.");
					fileInput.value = "";
					return;
				}
				ModalChat.#showFilePreview(file);
			});
		}
	}

	static #autoResizeInput(el) {
		el.style.height = "auto";
		el.style.height = Math.min(el.scrollHeight, 120) + "px";
	}

	static #handleTyping() {
		if (!ModalChat.#conversationId) return;
		let now = Date.now();
		if (now - ModalChat.#lastTypingSent < 2000) return;
		ModalChat.#lastTypingSent = now;

		let input = document.getElementById("chat-input");
		let content = input ? input.value : "";
		ChatService.updateTyping(ModalChat.#conversationId, content);

		// Clear typing after 5s of no input
		if (ModalChat.#typingTimeout) clearTimeout(ModalChat.#typingTimeout);
		ModalChat.#typingTimeout = setTimeout(function () {
			ChatService.updateTyping(ModalChat.#conversationId, "");
		}, 5000);
	}

	static async #sendCurrentMessage() {
		let input = document.getElementById("chat-input");
		let fileInput = document.getElementById("chat-file-input");
		let message = input ? input.value.trim() : "";
		let file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

		if (!message && !file) return;

		// Disable send while processing
		let sendBtn = document.getElementById("chat-send-btn");
		if (sendBtn) sendBtn.disabled = true;

		try {
			let result;
			if (file) {
				result = await ChatService.uploadAttachment(ModalChat.#conversationId, file, message);
				if (fileInput) fileInput.value = "";
				ModalChat.#hideFilePreview();
			} else {
				result = await ChatService.sendMessage(ModalChat.#conversationId, message);
			}

			if (result && result.success) {
				// If conversation was just created
				if (result.conversation_id && !ModalChat.#conversationId) {
					ModalChat.#conversationId = result.conversation_id;
					ChatService.startPolling(ModalChat.#conversationId);
					ChatService.onUpdate(ModalChat.#onPollUpdate);
				}
				if (input) {
					input.value = "";
					input.style.height = "auto";
				}
				// Add message locally for immediate feedback
				let localMsg = {
					id: result.message_id || "temp-" + Date.now(),
					sender_id: Session.user?.id,
					sender_username: Session.user?.username,
					message: message,
					has_attachment: file ? "1" : "0",
					attachment_name: file ? file.name : null,
					attachment_path: result.attachment_path || null,
					attachment_size: file ? file.size : null,
					created_at: new Date().toISOString().replace("T", " ").replace("Z", "")
				};
				ModalChat.#messages.push(localMsg);
				ModalChat.#appendMessage(localMsg);
				ModalChat.#scrollToBottom();
				// Clear typing indicator
				ChatService.updateTyping(ModalChat.#conversationId, "");
			} else {
				Toast.error(result?.message || "Failed to send message.");
			}
		} catch (e) {
			Toast.error("Failed to send message.");
		}

		if (sendBtn) sendBtn.disabled = false;
	}

	static #showFilePreview(file) {
		let previewEl = document.getElementById("chat-file-preview");
		if (!previewEl) return;
		let size = file.size < 1024 ? file.size + " B"
			: file.size < 1024 * 1024 ? (file.size / 1024).toFixed(1) + " KB"
			: (file.size / (1024 * 1024)).toFixed(1) + " MB";
		previewEl.innerHTML = `
			<div class="chat-file-info">
				<span class="chat-file-name">${ModalChat.#esc(file.name)}</span>
				<span class="chat-file-size">${size}</span>
				<button class="chat-file-remove" id="chat-file-remove" title="Remove">&times;</button>
			</div>`;
		previewEl.style.display = "flex";
		document.getElementById("chat-file-remove")?.addEventListener("click", function () {
			let fi = document.getElementById("chat-file-input");
			if (fi) fi.value = "";
			ModalChat.#hideFilePreview();
		});
	}

	static #hideFilePreview() {
		let previewEl = document.getElementById("chat-file-preview");
		if (previewEl) {
			previewEl.innerHTML = "";
			previewEl.style.display = "none";
		}
	}

	// ═══════════════════════════════════════════════
	//  MESSAGE RENDERING
	// ═══════════════════════════════════════════════

	static #renderMessages() {
		let container = document.getElementById("chat-messages");
		if (!container) return;

		if (ModalChat.#messages.length === 0) {
			ModalChat.#renderEmpty();
			return;
		}

		container.innerHTML = "";
		ModalChat.#messages.forEach(function (msg) {
			ModalChat.#appendMessage(msg, container);
		});
		ModalChat.#scrollToBottom();
	}

	static #renderEmpty() {
		let container = document.getElementById("chat-messages");
		if (!container) return;
		container.innerHTML = `
			<div class="chat-empty">
				<div class="chat-empty-icon">
					<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.2)"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
				</div>
				<p>No messages yet. Start a conversation!</p>
			</div>`;
	}

	static #appendMessage(msg, container) {
		if (!container) container = document.getElementById("chat-messages");
		if (!container) return;

		// Clear the empty state if present
		let emptyEl = container.querySelector(".chat-empty");
		if (emptyEl) emptyEl.remove();

		let isSelf = msg.sender_id === Session.user?.id;
		let bubbleClass = isSelf ? "chat-bubble-self" : "chat-bubble-other";
		let senderName = isSelf ? "You" : ModalChat.#esc(msg.sender_username || "Support");
		let timeStr = ModalChat.#formatTime(msg.created_at);

		let attachmentHtml = "";
		if (msg.has_attachment === "1" || msg.has_attachment === 1) {
			let ext = (msg.attachment_name || "").split(".").pop().toLowerCase();
			let isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
			if (isImage && msg.attachment_path) {
				attachmentHtml = `<div class="chat-attachment">
					<img src="${ModalChat.#esc(msg.attachment_path)}" alt="${ModalChat.#esc(msg.attachment_name)}"
						class="chat-attachment-img" loading="lazy">
				</div>`;
			} else {
				let sizeStr = "";
				if (msg.attachment_size) {
					let s = parseInt(msg.attachment_size, 10);
					sizeStr = s < 1024 ? s + " B"
						: s < 1024 * 1024 ? (s / 1024).toFixed(1) + " KB"
						: (s / (1024 * 1024)).toFixed(1) + " MB";
				}
				attachmentHtml = `<div class="chat-attachment chat-attachment-file">
					<a href="${ModalChat.#esc(msg.attachment_path)}" target="_blank" class="chat-attachment-link">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
							stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
							<polyline points="14 2 14 8 20 8"/></svg>
						<span>${ModalChat.#esc(msg.attachment_name || "File")}</span>
						${sizeStr ? '<span class="chat-file-size">' + sizeStr + '</span>' : ''}
					</a>
				</div>`;
			}
		}

		let messageText = msg.message ? '<div class="chat-bubble-text">' + ModalChat.#esc(msg.message) + '</div>' : '';

		let el = document.createElement("div");
		el.className = "chat-message " + bubbleClass;
		el.setAttribute("data-id", msg.id);
		el.innerHTML = `
			<div class="chat-bubble">
				<div class="chat-bubble-header">
					<span class="chat-bubble-sender">${senderName}</span>
					<span class="chat-bubble-time">${timeStr}</span>
				</div>
				${messageText}
				${attachmentHtml}
			</div>`;
		container.appendChild(el);
	}

	static #scrollToBottom() {
		let container = document.getElementById("chat-messages");
		if (container && ModalChat.#scrollLocked) {
			requestAnimationFrame(function () {
				container.scrollTop = container.scrollHeight;
			});
		}
	}

	// ═══════════════════════════════════════════════
	//  POLL UPDATE HANDLER
	// ═══════════════════════════════════════════════

	static #onPollUpdate = function (data) {
		if (!ModalChat.#mounted) {
			// Accumulate unread count if not viewing
			if (data.messages && data.messages.length > 0) {
				let incoming = data.messages.filter(function (m) {
					return m.sender_id !== Session.user?.id;
				});
				if (incoming.length > 0) {
					ChatService.unreadCount = ChatService.unreadCount + incoming.length;
				}
			}
			return;
		}

		// Append new messages (skip ones we already have)
		if (data.messages && data.messages.length > 0) {
			let existingIds = new Set(ModalChat.#messages.map(function (m) { return m.id; }));
			data.messages.forEach(function (msg) {
				if (!existingIds.has(msg.id)) {
					ModalChat.#messages.push(msg);
					ModalChat.#appendMessage(msg);
				}
			});
			ModalChat.#scrollToBottom();
		}

		// Typing indicator
		let typingEl = document.getElementById("chat-typing");
		let typingLabel = document.getElementById("chat-typing-label");
		if (data.typing && data.typing.content && data.typing.content.length > 0) {
			// Check if typing was recent (within 10 seconds)
			let updatedAt = new Date(data.typing.updated_at).getTime();
			let now = Date.now();
			if (now - updatedAt < 10000) {
				if (typingEl) typingEl.style.display = "flex";
				if (typingLabel) {
					let name = ModalChat.#isMod ? "User" : "Support";
					typingLabel.textContent = name + " is typing...";
				}
			} else {
				if (typingEl) typingEl.style.display = "none";
			}
		} else {
			if (typingEl) typingEl.style.display = "none";
		}

		// Status update
		if (data.status === "closed") {
			let statusEl = document.getElementById("chat-status");
			if (statusEl) statusEl.textContent = "Closed";
		}
	};

	// ═══════════════════════════════════════════════
	//  HELPERS
	// ═══════════════════════════════════════════════

	static #formatTime(timestamp) {
		if (!timestamp) return "";
		// MySQL timestamps from WAMP are in server-local time — interpret as local, not UTC
		let d = new Date(timestamp.replace(" ", "T"));
		if (isNaN(d.getTime())) d = new Date(timestamp);
		let now = new Date();
		let diff = now.getTime() - d.getTime();
		if (diff < 60000) return "just now";
		if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
		if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
		if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
		return d.toLocaleDateString();
	}

	static #esc(str) {
		if (!str) return "";
		let div = document.createElement("div");
		div.textContent = str;
		return div.innerHTML;
	}
}
