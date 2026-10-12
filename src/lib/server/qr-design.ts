/**
 * QR designer — builds styled QR SVG (custom colors, rounded modules,
 * custom finder-eye shape, centered logo) plus a printable table card SVG.
 * Only depends on `qrcode` (already a dependency) and on `sharp` for PNG
 * raster rendering.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { HttpError } from './http';

export type QrStyle = {
	/** Hex color WITHOUT '#', e.g. '6f4e37' */
	dark: string;
	light: string;
	/** 0 = square modules, up to 1 = full dot */
	cornerRadius: number;
	/** Shape of the 3 finder-eye frames */
	eyeStyle: 'square' | 'rounded' | 'circle';
	/** Raw SVG string of a small café logo pasted over the middle, or null */
	logoSvg: string | null;
};

const HEX_RE = /^[0-9a-fA-F]{6}$/;

export function parseQrStyle(raw: Record<string, unknown>): QrStyle {
	const dark = typeof raw.dark === 'string' && HEX_RE.test(raw.dark) ? raw.dark.toLowerCase() : '111111';
	const light = typeof raw.light === 'string' && HEX_RE.test(raw.light) ? raw.light.toLowerCase() : 'ffffff';
	let cornerRadius = 0;
	if (typeof raw.cornerRadius === 'number' && raw.cornerRadius >= 0 && raw.cornerRadius <= 1) {
		cornerRadius = raw.cornerRadius;
	}
	const eyeStyle = raw.eyeStyle === 'rounded' || raw.eyeStyle === 'circle' ? raw.eyeStyle : 'square';
	// Logo used to come from uploaded app assets; keep it inline and small.
	const logoSvg =
		typeof raw.logoSvg === 'string' && raw.logoSvg.trim().startsWith('<svg') && raw.logoSvg.length < 60_000 ? raw.logoSvg : null;
	return { dark, light, cornerRadius, eyeStyle, logoSvg };
}

type Matrix = { size: number; data: Uint8Array };

function qrMatrix(text: string, ecc: 'L' | 'M' | 'Q' | 'H' = 'M'): Matrix {
	const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
	return { size: qr.modules.size, data: qr.modules.data as unknown as Uint8Array };
}

function round(v: number): number {
	return Math.round(v * 100) / 100;
}

function roundedRect(x: number, y: number, w: number, h: number, cr: number): string {
	const rr = Math.min(cr, w / 2, h / 2);
	return (
		`M${round(x + rr)} ${round(y)}h${round(w - 2 * rr)}a${round(rr)} ${round(rr)} 0 0 1 ${round(rr)} ${round(rr)}v${round(h - 2 * rr)}` +
		`a${round(rr)} ${round(rr)} 0 0 1 -${round(rr)} ${round(rr)}h-${round(w - 2 * rr)}a${round(rr)} ${round(rr)} 0 0 1 -${round(rr)} -${round(rr)}v-${round(h - 2 * rr)}` +
		`a${round(rr)} ${round(rr)} 0 0 1 ${round(rr)} -${round(rr)}z`
	);
}

function circlePath(cx: number, cy: number, r: number): string {
	return `M${round(cx - r)} ${round(cy)}a${round(r)} ${round(r)} 0 1 0 ${round(2 * r)} 0a${round(r)} ${round(r)} 0 1 0 -${round(2 * r)} 0z`;
}

/** The three 7×7 finder boxes that we re-style on top of the module grid. */
function finderBoxes(n: number): [number, number][] {
	return [
		[0, 0],
		[n - 7, 0],
		[0, n - 7]
	];
}

export function buildQrSvg(text: string, style: QrStyle, size = 512): string {
	const { size: n, data } = qrMatrix(text, style.logoSvg ? 'H' : 'M');
	const margin = 2;
	const total = n + margin * 2;
	const unit = size / total;
	const cr = style.cornerRadius * unit * 0.5;
	const finderBoxesSet = new Set(finderBoxes(n).flatMap(([bx, by]) => {
		const cells: string[] = [];
		for (let y = by; y < by + 7; y++) for (let x = bx; x < bx + 7; x++) cells.push(`${x},${y}`);
		return cells;
	}));
	// Skip a center hole for the logo plate (still keeps error correction H headroom).
	const plateHalf = style.logoSvg ? Math.ceil(n * 0.11) : 0;
	const plateCx = n / 2;
	const plateCy = n / 2;

	const modulePaths: string[] = [];
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const idx = y * n + x;
			if (!data[idx]) continue;
			if (finderBoxesSet.has(`${x},${y}`)) continue;
			if (plateHalf && Math.abs(x - plateCx) <= plateHalf && Math.abs(y - plateCy) <= plateHalf && style.logoSvg) continue;
			const px = (margin + x) * unit;
			const py = (margin + y) * unit;
			modulePaths.push(cr > 0 ? roundedRect(px, py, unit, unit, cr) : `M${round(px)} ${round(py)}h${round(unit)}v${round(unit)}h-${round(unit)}z`);
		}
	}

	// Finder eyes: outer 7×7 frame (stroke), inner 3×3 dot.
	const eyes: string[] = [];
	for (const [bx, by] of finderBoxes(n)) {
		const x = (margin + bx) * unit;
		const y = (margin + by) * unit;
		const outer = 7 * unit;
		const dotW = 3 * unit;
		const dx = x + 2 * unit;
		const dy = y + 2 * unit;
		const frame =
			style.eyeStyle === 'circle'
				? circlePath(x + outer / 2, y + outer / 2, outer / 2 - unit * 0.5)
				: roundedRect(x + unit * 0.25, y + unit * 0.25, outer - unit * 0.5, outer - unit * 0.5, style.eyeStyle === 'rounded' ? outer * 0.22 : unit * 0.15);
		eyes.push(
			`<path d="${frame}" fill="none" stroke="#${style.dark}" stroke-width="${round(unit)}" stroke-linejoin="round"/>` +
				`<path d="${style.eyeStyle === 'circle' ? circlePath(dx + dotW / 2, dy + dotW / 2, dotW / 2) : roundedRect(dx, dy, dotW, dotW, style.eyeStyle === 'rounded' ? dotW * 0.38 : 0)}" fill="#${style.dark}"/>`
		);
	}

	let logo = '';
	if (style.logoSvg) {
		const plate = n * 0.24 * unit;
		const px = size / 2 - plate / 2;
		const vb = extractViewBox(style.logoSvg);
		logo =
			`<g><rect x="${round(px)}" y="${round(px)}" width="${round(plate)}" height="${round(plate)}" rx="${round(plate * 0.2)}" fill="#${style.light}"/>` +
			`<svg x="${round(px + plate * 0.18)}" y="${round(px + plate * 0.18)}" width="${round(plate * 0.64)}" height="${round(plate * 0.64)}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${extractInner(style.logoSvg)}</svg></g>`;
	}

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
		`<rect width="${size}" height="${size}" fill="#${style.light}"/>` +
		`<path fill="#${style.dark}" d="${modulePaths.join('')}"/>` +
		eyes.join('') +
		logo +
		`</svg>`
	);
}

function extractViewBox(svg: string): string {
	return /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24';
}

function extractInner(svg: string): string {
	const inner = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(svg)?.[1] ?? '';
	// Safety: no scripts inside user-provided logo svg before it's embedded server-side.
	return inner.replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

// ---------- Printable table card (SVG) ----------

export type CardOptions = {
	cafeName: string;
	cafeTagline: string | null;
	tableNumber: number;
	instruction: string;
};

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A6-landscape-like card, ready for browser print-to-PDF. */
export function buildTableCardSvg(
	card: CardOptions,
	qrSvg: string,
	dark: string,
	light: string,
	qrSize = 300,
	width = 900,
	height = 636
): string {
	const name = esc(card.cafeName);
	const tagline = card.cafeTagline ? esc(card.cafeTagline) : null;
	const instr = esc(card.instruction);
	// Embed the QR svg by rewriting its root size and dropping its xml prolog if any.
	const embeddedQr = qrSvg
		.replace(/<\?xml[^>]*\?>/, '')
		.replace('<svg', `<svg x="${round(width / 2 - qrSize / 2)}" y="190" width="${qrSize}" height="${qrSize}"`);
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Vazirmatn, Tahoma, sans-serif">` +
		`<rect width="${width}" height="${height}" fill="#${light}"/>` +
		`<rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="28" fill="none" stroke="#${dark}" stroke-width="3"/>` +
		`<text x="${width / 2}" y="112" text-anchor="middle" font-size="52" font-weight="700" fill="#${dark}">${name}</text>` +
		(tagline ? `<text x="${width / 2}" y="158" text-anchor="middle" font-size="24" fill="#${dark}" opacity="0.72">${tagline}</text>` : '') +
		embeddedQr +
		`<text x="${width / 2}" y="${190 + qrSize + 52}" text-anchor="middle" font-size="34" font-weight="700" fill="#${dark}">میز ${card.tableNumber}</text>` +
		`<text x="${width / 2}" y="${190 + qrSize + 92}" text-anchor="middle" font-size="22" fill="#${dark}" opacity="0.78">${instr}</text>` +
		`</svg>`
	);
}

export function cardDownloadName(tableNumber: number): string {
	return `table-${tableNumber}-card.svg`;
}

export async function svgToPng(svg: string, size: number): Promise<Buffer> {
	return sharp(Buffer.from(svg), { density: 300 }).resize(size, size, { fit: 'inside' }).png().toBuffer();
}

export function ensureQrText(text: string): void {
	if (!text.trim()) throw new HttpError(400, 'محتوای QR خالی است.');
	if (text.length > 600) throw new HttpError(400, 'محتوای QR بیش از حد بلند است.');
}
