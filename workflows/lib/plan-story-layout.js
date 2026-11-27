// Plan where each part of the story image goes. The Edit Image nodes after this node read `layout`.
const settings = $('Settings').first().json;
const post = $('Finish caption').first().json;
const item = $input.first();

if (!item.binary?.data || !item.binary?.photo) {
	throw new Error(`Image download failed for "${post.title}". Check photoUrl and backdropUrl in data.`);
}

const W = Math.round(Number(settings.imageWidth) || 1080);
const H = Math.round(Number(settings.imageHeight) || 1920);
const u = W / 1080;
const px = (value) => Math.round(value * u);

// Impact advance widths in thousandths of the font size. Another headline font uses them as an estimate.
const GLYPH_WIDTHS = {
	168: ',‘’',
	176: ' ',
	185: "'.",
	202: ':;',
	270: '!',
	288: 'IÍ',
	294: '-',
	313: '()',
	331: 'J',
	345: '“”',
	370: '"',
	380: 'L',
	381: '1',
	392: '7',
	396: '/',
	397: 'ZŽ',
	398: 'F',
	416: 'EÈÉÊË',
	461: 'T',
	473: 'Y',
	482: 'X',
	500: '4–',
	502: '2P',
	508: 'AÀÁÂÃÄÅ',
	517: 'SŠ',
	523: 'V',
	525: '?',
	530: '3',
	533: '+',
	535: '8',
	536: '0',
	537: '5K',
	539: 'R',
	542: '69NÑ',
	546: 'OQÓÔÕÖØ',
	547: '$UÚÜ',
	551: 'G',
	552: 'B',
	553: 'D…',
	554: 'CÇĆČ',
	555: 'H',
	576: '&',
	626: '#',
	693: '%',
	717: 'M',
	814: 'W',
	1000: '—',
};
const CAP_HEIGHT = 0.797;
const glyphWidth = new Map();
for (const [width, glyphs] of Object.entries(GLYPH_WIDTHS)) {
	for (const glyph of glyphs) glyphWidth.set(glyph, Number(width));
}
const textWidth = (text, size) =>
	([...text].reduce((sum, glyph) => sum + (glyphWidth.get(glyph) ?? 560), 0) * size) / 1000;

function wrap(text, size, maxWidth) {
	const lines = [];
	let line = '';
	for (const word of text.split(' ')) {
		const next = line ? `${line} ${word}` : word;
		if (line && textWidth(next, size) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

// Narrow the lines while the line count stays the same, so the last line is not one lonely word.
function balance(text, size, maxWidth) {
	let best = wrap(text, size, maxWidth);
	for (let width = maxWidth - 12; width > maxWidth / 2; width -= 12) {
		const lines = wrap(text, size, width);
		if (lines.length !== best.length) break;
		best = lines;
	}
	return best;
}

const display = (text) =>
	String(text ?? '')
		.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();

const margin = px(64);
const textWidthMax = W - margin * 2;
const headlineText = display(post.title);

// Phone apps cover the top and the bottom of a tall image, so the content stays between them.
const tall = H / W > 1.6;
const safeTop = Math.round(H * (tall ? 0.13 : 0.045));
const safeBottom = Math.round(H * (tall ? 0.17 : 0.045));
const zone = H - safeTop - safeBottom;

const logoSize = Math.round((W * Number(settings.logoMarkScale || 12)) / 100);
const labelSize = px(38);
const pillHeight = px(62);
const barHeight = px(10);
const gapHeader = px(28);
const gapPhoto = px(48);
const gapPill = px(40);
const fixedHeight = logoSize + gapHeader + barHeight + gapPhoto + pillHeight + gapPill;

const sourceWidth = Number(item.json?.size?.width) || W;
const sourceHeight = Number(item.json?.size?.height) || Math.round(W * 0.5625);
const naturalHeight = Math.round((sourceHeight * W) / sourceWidth);
// A wide photo stays whole. A tall photo is cut to this height when the headline needs the room.
const photoKeep = Math.min(naturalHeight, Math.round(W * 0.62));
const photoFloor = Math.min(naturalHeight, px(400));

const MAX_LINES = 5;
let headline;
for (let size = 96; size >= 60; size -= 4) {
	const fontSize = px(size);
	const lines = wrap(headlineText, fontSize, textWidthMax);
	const leading = Math.round(fontSize * 1.14);
	const blockHeight = Math.round(fontSize * CAP_HEIGHT) + (lines.length - 1) * leading;
	const photoRoom = zone - fixedHeight - blockHeight;
	headline = { fontSize, lines, leading, blockHeight, photoRoom };
	if (lines.length <= 4 && photoRoom >= photoKeep) break;
}
if (headline.lines.length > MAX_LINES) {
	const kept = headline.lines.slice(0, MAX_LINES);
	let last = kept[MAX_LINES - 1];
	while (last.includes(' ') && textWidth(`${last}…`, headline.fontSize) > textWidthMax) {
		last = last.slice(0, last.lastIndexOf(' '));
	}
	kept[MAX_LINES - 1] = `${last}…`;
	headline.lines = kept;
	headline.blockHeight =
		Math.round(headline.fontSize * CAP_HEIGHT) + (MAX_LINES - 1) * headline.leading;
	headline.photoRoom = zone - fixedHeight - headline.blockHeight;
} else {
	headline.lines = balance(headlineText, headline.fontSize, textWidthMax);
}

const photoHeight = Math.max(photoFloor, Math.min(naturalHeight, headline.photoRoom));
const stackHeight = fixedHeight + photoHeight + headline.blockHeight;
const top = Math.max(px(40), safeTop + Math.round((zone - stackHeight) / 2));

const logoY = top;
const photoY = logoY + logoSize + gapHeader;
const barY = photoY + photoHeight;
const pillY = barY + barHeight + gapPhoto;
const headlineY = pillY + pillHeight + gapPill + Math.round(headline.fontSize * CAP_HEIGHT);

const label = display(settings.postLabel || 'UFC NEWS');
const pillPad = px(22);
const pillWidth = Math.round(textWidth(label, labelSize)) + pillPad * 2;

const layout = {
	width: W,
	height: H,
	logo: {
		size: logoSize,
		// The logo file has an empty border. Shift it so the mark lines up with the text.
		x: margin - Math.round(logoSize * 0.1),
		y: logoY,
	},
	source: {
		text: `VIA ${display(post.source)}`,
		fontSize: px(30),
		right: margin,
		y: logoY + Math.round(logoSize / 2) + px(11),
	},
	photo: {
		y: photoY,
		width: W,
		height: photoHeight,
		fullHeight: naturalHeight,
		// Cut more from the bottom than from the top, because faces are near the top.
		cropY: Math.round((naturalHeight - photoHeight) * 0.25),
	},
	bar: { y1: barY, y2: barY + barHeight },
	pill: {
		x1: margin,
		y1: pillY,
		x2: margin + pillWidth,
		y2: pillY + pillHeight,
		radius: px(8),
		text: label,
		fontSize: labelSize,
		textX: margin + pillPad,
		textY: pillY + Math.round((pillHeight + labelSize * CAP_HEIGHT) / 2),
	},
	headline: {
		fontSize: headline.fontSize,
		x: margin,
		lines: Array.from({ length: MAX_LINES }, (_, i) => headline.lines[i] ?? ''),
		y: Array.from({ length: MAX_LINES }, (_, i) => headlineY + i * headline.leading),
	},
};

return [{ json: { ...post, layout }, binary: item.binary }];
