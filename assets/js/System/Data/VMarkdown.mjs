/**
 * A simple Markdown parser that converts Markdown strings into HTML.
 */
export class VMarkdown {

	/**
	 * Parses a Markdown string and returns HTML content.
	 * Supports headers (#), lists (-), links [text](url), and paragraphs.
	 * @param {string} md - The Markdown content.
	 * @returns {string} - The generated HTML content.
	 */
	static parse(md) {
		if (typeof md !== "string") return "";

		let html = md;

		// 1. Headers: # Header -> <h1>Header</h1>, ## Header -> <h2>Header</h2>, etc.
		html = html.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
		html = html.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
		html = html.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
		html = html.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
		html = html.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
		html = html.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

		// 2. Unordered Lists: - item -> <ul><li>item</li></ul>
		// This handles multiple items in a single list
		html = html.replace(/^\-\s+(.*)$/gm, "<li>$1</li>");
		// Wrap contiguous <li> elements with <ul>
		html = html.replace(/(<li>.*<\/li>)+/gs, (match) => `<ul>${match}</ul>`);

		// 3. Links: [text](url) -> <a href="url">text</a>
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

		// 4. Bold: **text** -> <strong>text</strong>
		html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

		// 5. Italic: *text* -> <em>text</em>
		html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

		// 6. Paragraphs: Anything not a header, list item, or empty line is a paragraph
		// Split by lines and wrap non-HTML elements
		let lines = html.split("\n");
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line && !line.startsWith("<h") && !line.startsWith("<ul") && !line.startsWith("<li")) {
				lines[i] = `<p>${line}</p>`;
			}
		}
		html = lines.join("\n");

		return html;
	}
}
