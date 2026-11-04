import { sha256 } from './crypto';

export const FREE_MAIL_DOMAINS = new Set([
	'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk',
	'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
	'rediffmail.com', 'msn.com', 'gmx.com', 'zoho.com', 'mail.com', 'btinternet.com', 'sky.com',
]);

/** Senders that are almost never customers — newsletters and system mail */
export const AUTOMATED_SENDER = /(^|[._-])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|newsletter|marketing|bounce|alerts?|news|updates|digest|calendar-notification)([._-]|@)/i;

export function domainOf(addr: string): string {
	const m = /@([^@>\s]+)\s*>?$/.exec(addr.trim().toLowerCase());
	return m ? m[1] : '';
}

export function normalizeAddress(addr: string): string {
	const m = /<([^>]+)>/.exec(addr);
	return (m ? m[1] : addr).trim().toLowerCase();
}

export function normalizeSubject(s: string): string {
	let out = (s || '').trim();
	// strip any chain of reply/forward prefixes (multi-language) and bracketed tags like [EXT]
	for (let i = 0; i < 6; i++) {
		const before = out;
		out = out
			.replace(/^\s*(re|fw|fwd|aw|wg|sv|vs|rif|tr|antw|odp|ynt)\s*(\[\d+\])?\s*:\s*/i, '')
			.replace(/^\s*\[(ext|external|external email|caution)[^\]]*\]\s*/i, '');
		if (out === before) break;
	}
	return out.replace(/\s+/g, ' ').toLowerCase().slice(0, 300);
}

export function htmlToText(html: string): string {
	return html
		.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/\n\s*\n\s*\n+/g, '\n\n')
		.trim();
}

const QUOTE_MARKERS: RegExp[] = [
	/^\s*On .{3,200}wrote:\s*$/im,
	/^\s*On .{3,120}\n.{0,120}wrote:\s*$/im,
	/^\s*-{2,}\s*Original Message\s*-{2,}/im,
	/^\s*-{2,}\s*Forwarded message\s*-{2,}/im,
	/^\s*From:\s.+\n\s*(Sent|Date):\s.+/im,
	/^\s*De\s?:\s.+\n\s*(Envoyé|Date)\s?:\s.+/im,
	/^\s*Von:\s.+\n\s*Gesendet:\s.+/im,
	/^_{10,}\s*$/m,
];

const SIGNATURE_MARKERS: RegExp[] = [
	/^\s*--\s*$/m,
	/^\s*(Kind|Best|Warm|Many)?\s*regards,?\s*$/im,
	/^\s*(Thanks|Thank you|Cheers|Sincerely)( and regards| again)?,?\s*$/im,
	/^\s*Sent from my (iPhone|iPad|Android|Samsung|mobile).*$/im,
	/^\s*Get Outlook for (iOS|Android).*$/im,
	/^\s*(DISCLAIMER|CONFIDENTIALITY NOTICE|This e-?mail (and any attachments )?(is|are) confidential).*$/im,
];

/** Remove quoted earlier messages so each email's analysed content is only what it newly says. */
export function stripQuoted(text: string): string {
	let body = text.replace(/\r\n/g, '\n');
	let cut = body.length;
	for (const re of QUOTE_MARKERS) {
		const m = re.exec(body);
		if (m && m.index > 0 && m.index < cut) cut = m.index;
	}
	body = body.slice(0, cut);
	body = body
		.split('\n')
		.filter((l) => !/^\s*>/.test(l))
		.join('\n');
	return body.trim();
}

/** Body without quotes and signature boilerplate — used for hashing and AI. */
export function cleanBody(text: string): string {
	let body = stripQuoted(text);
	let cut = body.length;
	for (const re of SIGNATURE_MARKERS) {
		const m = re.exec(body);
		// only treat as signature if it is in the latter part of the message
		if (m && m.index > body.length * 0.35 && m.index < cut) cut = m.index;
	}
	return body.slice(0, cut).replace(/\n{3,}/g, '\n\n').trim();
}

export function contentHash(fromAddr: string, subject: string, clean: string): string {
	const norm = clean.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 4000);
	return sha256(`${normalizeAddress(fromAddr)}|${normalizeSubject(subject)}|${norm}`);
}

/**
 * Dedup key. The RFC 5322 Message-ID is identical when the same email lands in several
 * monitored mailboxes (To/CC to several team members, shared mailboxes).
 */
export function dedupKey(internetMessageId: string | null | undefined, fromAddr: string, sentAt: Date, subject: string, clean: string) {
	if (internetMessageId) return `mid:${internetMessageId.trim().toLowerCase().replace(/^<|>$/g, '')}`;
	const minute = Math.floor(sentAt.getTime() / 60000);
	return `h:${sha256(`${normalizeAddress(fromAddr)}|${minute}|${normalizeSubject(subject)}|${clean.slice(0, 500)}`)}`;
}

const PII_PATTERNS: [RegExp, string][] = [
	[/\b(?:\d[ -]*?){13,19}\b/g, '[card-number]'],
	[/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '[iban]'],
	[/\b\d{2}-\d{2}-\d{2}\s?\d{8}\b/g, '[bank-account]'],
	[/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, '[ni-number]'],
	[/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[id-number]'],
	[/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[pan]'],
	[/(?:password|passcode|pwd)\s*[:=]\s*\S+/gi, 'password: [redacted]'],
];

/** Redact sensitive identifiers before text leaves our boundary (to the AI provider). */
export function redactPII(text: string): string {
	let out = text;
	for (const [re, rep] of PII_PATTERNS) out = out.replace(re, rep);
	return out;
}

export function snippet(text: string, n = 240): string {
	const s = text.replace(/\s+/g, ' ').trim();
	return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function titleCaseFromDomain(domain: string): string {
	const base = domain.split('.').filter((p) => !['co', 'com', 'org', 'net', 'ltd', 'uk', 'in', 'io', 'gov', 'ac'].includes(p))[0] || domain;
	return base
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

// ── Forwarded emails ─────────────────────────────────────────────────────────
// A staff member forwards a reader's email to another mailbox (for example from their own inbox to
// booksales@). The forwarded copy is read as the reader's own email: sender, date, subject and text
// come from the forwarded header block; the forwarder's note above it is kept separately.

const FWD_SUBJECT = /^\s*(fwd?|fw|tr|wg|rv|enc|doorst|vs|अग्रेषित)\s*(\[\d+\])?\s*:/i;
const FWD_SEPARATOR = /^\s*(-{3,}.*-{3,}|_{8,}|begin forwarded message:?|अग्रेषित संदेश.*)\s*$/i;
const LBL_FROM = /^(from|प्रेषक|भेजने वाला|से|von|de|van|da)$/i;
const LBL_DATE = /^(date|sent|दिनांक|तारीख|तिथि|भेजा गया|datum|gesendet|envoyé|enviado|fecha|data)$/i;
const LBL_SUBJECT = /^(subject|विषय|betreff|objet|asunto|oggetto|onderwerp)$/i;
const LBL_TO = /^(to|प्रति|को|an|à|a|para|aan)$/i;
const LBL_CC = /^(cc|प्रतिलिपि|kopie)$/i;
const HEADER_LINE = /^\s*\*?\s*([\p{L}\p{M} ]{1,24}?)\s*\*?\s*:\s*\*?\s*(.*?)\s*$/u;
const EMAIL_IN = /([A-Z0-9._%+'-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,})/i;

function parseAddressText(v: string): { address: string; name: string } | null {
	const m = EMAIL_IN.exec(v);
	if (!m) return null;
	const address = m[1].toLowerCase();
	const name = v
		.slice(0, m.index)
		.replace(/[<[(]\s*(mailto:)?\s*$/i, '')
		.replace(/^["'\s*]+|["'\s*]+$/g, '')
		.trim();
	return { address, name: name.includes('@') ? '' : name };
}

/** A forwarded header's date: "Mon, 3 Nov 2026 at 10:15", "Monday, November 3, 2026 10:15 AM", … */
export function parseLooseDate(v: string): Date | null {
	const s = v
		.replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*/i, '')
		.replace(/\s+at\s+/i, ' ')
		.replace(/\s*\(.*\)\s*$/, '')
		.trim();
	const t = Date.parse(s);
	return Number.isNaN(t) ? null : new Date(t);
}

interface FwdBlock { from: { address: string; name: string }; date: Date | null; subject: string; to: string[]; start: number; end: number }

/** the header block that starts at line i ("From:" with an address, then Date/Subject/To lines), if any */
function headerAt(lines: string[], i: number): FwdBlock | null {
	const first = HEADER_LINE.exec(lines[i] || '');
	if (!first || !LBL_FROM.test(first[1].trim())) return null;
	const from = parseAddressText(first[2]);
	if (!from) return null;
	const blk: FwdBlock = { from, date: null, subject: '', to: [], start: i, end: i + 1 };
	let fields = 1;
	for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
		const h = HEADER_LINE.exec(lines[j]);
		if (!h) {
			if (!lines[j].trim()) break;
			if (blk.to.length && EMAIL_IN.test(lines[j])) { blk.end = j + 1; continue; } // a To/Cc list wrapped onto the next line
			break;
		}
		const label = h[1].trim();
		if (LBL_DATE.test(label)) blk.date = parseLooseDate(h[2]);
		else if (LBL_SUBJECT.test(label)) blk.subject = h[2];
		else if (LBL_TO.test(label) || LBL_CC.test(label)) blk.to.push(...(h[2].match(new RegExp(EMAIL_IN.source, 'gi')) || []).map((a) => a.toLowerCase()));
		else break;
		fields++;
		blk.end = j + 1;
	}
	// a real forwarded header has at least a date or a subject next to the sender
	return fields >= 2 && (blk.date || blk.subject) ? blk : null;
}

export interface ForwardedOriginal {
	from: { address: string; name: string };
	sentAt: Date | null;
	subject: string;
	to: string[];
	/** the original email's text, without the forward headers */
	body: string;
	/** what the forwarder wrote above the forwarded email */
	note: string;
}

/**
 * The original email inside a forwarded one. `isInternal` decides which senders are staff: forwards
 * between staff are looked through, so a chain (reader → A → B → booksales@) yields the reader's email.
 */
export function parseForward(bodyText: string, subject: string, isInternal: (address: string) => boolean): ForwardedOriginal | null {
	const lines = (bodyText || '').replace(/\r\n/g, '\n').split('\n');
	const looksForwarded = FWD_SUBJECT.test(subject || '') || lines.some((l) => FWD_SEPARATOR.test(l) && /forward|अग्रेषित|weitergeleitet|transféré|reenviado|-{3,}/i.test(l));
	if (!looksForwarded) return null;
	let noteEnd = -1;
	for (let i = 0; i < lines.length; i++) {
		// inner blocks need a separator or a quote marker just above them, so a "From:" line in a normal email is not taken for one
		const prev = lines.slice(Math.max(0, i - 3), i).join('\n');
		const marked = FWD_SEPARATOR.test(prev.split('\n').filter((l) => l.trim()).pop() || '') || noteEnd < 0;
		if (!marked) continue;
		const blk = headerAt(lines, i);
		if (!blk) continue;
		if (noteEnd < 0) noteEnd = i;
		if (isInternal(blk.from.address)) continue; // a forward between staff: look further down
		let bodyLines = lines.slice(blk.end);
		while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
		const note = lines
			.slice(0, noteEnd)
			.filter((l) => !FWD_SEPARATOR.test(l))
			.join('\n')
			.trim();
		return {
			from: blk.from,
			sentAt: blk.date,
			subject: (blk.subject || subject || '').replace(FWD_SUBJECT, '').trim(),
			to: [...new Set(blk.to)],
			body: bodyLines.join('\n').trim(),
			note,
		};
	}
	return null;
}
