/**
 * Canvas Graphics Interface - provides shape drawing primitives for the canvas.
 */
export class Cgi {

	static saved = false;
	static debug = 0;

	/**
	 * Generates a line on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static line(q = false) {
		Cgi.setup(q);
		if (typeof q.data.line.type === "string")
			q.ctx.lineCap = q.data.line.type.toLowerCase();
		q.ctx.lineTo(q.w, q.h);
		Cgi.fin(q);
	}

	/**
	 * Generates a triangle on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static triangle(q = false) {
		q.ctx.save();
		q.ctx.beginPath();
		q.ctx.moveTo((q.x + (q.w / 2)), q.y);
		q.ctx.lineTo((q.x + q.w), (q.y + q.h));
		q.ctx.lineTo(q.x, (q.y + q.h));
		q.ctx.lineTo((q.x + (q.w / 2)), q.y);
		q.ctx.closePath();
		q.ctx.clip();
		Cgi.setup(q);
		Cgi.fin(q);
	}

	/**
	 * Generates a box on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static box(q = false) {
		Cgi.setup(q);
		q.ctx.rect(q.x, q.y, q.w, q.h);
		Cgi.fin(q);
	}

	/**
	 * Generates a pentagon on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static pentagon(q = false) {
		q.ctx.save();
		q.ctx.beginPath();
		q.ctx.moveTo((q.x + (q.w / 2)), q.y);
		q.ctx.lineTo(q.x + q.w, q.y + (q.h / 2.5));
		q.ctx.lineTo((q.x + (q.w - (q.w / 4))), (q.y + q.h));
		q.ctx.lineTo((q.x + (q.w / 4)), (q.y + q.h));
		q.ctx.lineTo(q.x, q.y + (q.h / 2.5));
		q.ctx.lineTo((q.x + (q.w / 2)), q.y);
		q.ctx.closePath();
		q.ctx.clip();
		Cgi.setup(q);
		Cgi.fin(q);
	}

	/**
	 * Generates a hexagon on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static hexagon(q = false) {
		q.ctx.save();
		q.ctx.pos = { "x": q.x, "y": q.y };
		let bpos = (q.w / 4);
		q.ctx.moveTo(q.x, (q.y + (q.h / 2)));
		q.ctx.beginPath();
		q.ctx.moveTo(q.x, (q.y + (q.h / 2)));
		q.ctx.lineTo(q.x + bpos, q.y);
		q.ctx.lineTo(q.x + (bpos * 3), q.y);
		q.ctx.lineTo(q.x + q.w, q.y + (q.h / 2));
		q.ctx.lineTo(q.x + (bpos * 3), q.y + q.h);
		q.ctx.lineTo(q.x + bpos, q.y + q.h);
		q.ctx.lineTo(q.x, (q.y + (q.h / 2)));
		q.ctx.lineTo(q.x, q.y + q.h);
		q.ctx.closePath();
		q.ctx.clip();
		Cgi.setup(q);
		Cgi.fin(q);
	}

	/**
	 * Generates an octagon on the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static octagon(q = false) {
		q.ctx.save();
		q.ctx.pos = { "x": q.x, "y": q.y };
		let bpos = (q.w / 4);
		q.ctx.moveTo(q.x, (q.y + (q.h / 2)));
		q.ctx.beginPath();
		q.ctx.moveTo(q.x, (q.y + (q.h / 2)));
		q.ctx.lineTo(q.x + bpos, q.y);
		q.ctx.lineTo(q.x + (bpos * 3), q.y);
		q.ctx.lineTo(q.x + q.w, q.y + (q.h / 2));
		q.ctx.lineTo(q.x + (bpos * 3), q.y + q.h);
		q.ctx.lineTo(q.x + bpos, q.y + q.h);
		q.ctx.lineTo(q.x, (q.y + (q.h / 2)));
		q.ctx.lineTo(q.x, q.y + q.h);
		q.ctx.closePath();
		q.ctx.clip();
		Cgi.setup(q);
		Cgi.fin(q);
	}

	/**
	 * Clears the canvas.
	 * @param {object} q - The drawing configuration object.
	 */
	static clear(q) {
		q.ctx.clearRect(0, 0, q.w, q.h);
	}

	/**
	 * Finalizes the drawing operation.
	 * @param {object} q - The drawing configuration object.
	 */
	static fin(q = false) {
		q.ctx.restore();
		if (q.shape === "line")
			q.ctx.stroke();
	}

	/**
	 * Sets up the beginning phase of the drawing operation.
	 * @param {object} q - The drawing configuration object.
	 */
	static setup(q = false) {
		q.ctx.moveTo(q.x, q.y);
		if (q.fill !== false) {
			q.ctx.fillStyle = Cgi.getColor(q.fill, q);
			if (q.shape !== "line")
				q.ctx.fillRect(q.x, q.y, q.w, q.h);
		}
		if (q["border-color"])
			q.ctx.strokeStyle = Cgi.getColor(q["border-color"], q);
		if (typeof q["border-width"] === "number")
			q.ctx.lineWidth = q["border-width"];
	}

	/**
	 * Resolves a color value, supporting gradients.
	 * @param {string} q - The color or gradient string.
	 * @param {object} ctx - The drawing context configuration.
	 * @returns {string|CanvasGradient}
	 */
	static getColor(q = false, ctx = false) {
		let res = "";
		if (q.indexOf("linear-gradient") !== -1) {
			let g = ctx.ctx.createLinearGradient(
				ctx.data.gradient.x + (ctx.data.width / 2),
				ctx.data.gradient.y + (ctx.data.height / 2),
				ctx.data.gradient.width,
				ctx.data.gradient.height
			);
			let i = 0;
			let lim = ctx.data.gradient.colors.length;
			while (i < lim) {
				if (ctx.data.gradient.colors[i])
					g.addColorStop(i, ctx.data.gradient.colors[i]);
				i++;
			}
			res = g;
		} else if (q.indexOf("radial-gradient") !== -1) {
			let g = ctx.ctx.createRadialGradient(
				ctx.x + (ctx.data.width / 2),
				ctx.y + (ctx.data.height / 2),
				0,
				ctx.x + ctx.data.width,
				ctx.y + ctx.data.height,
				155
			);
			let i = 0;
			let lim = ctx.data.gradient.colors.length;
			while (i < lim) {
				if (ctx.data.gradient.colors[i])
					g.addColorStop(i, ctx.data.gradient.colors[i]);
				i++;
			}
			res = g;
		} else {
			res = q;
		}
		return res;
	}
}
