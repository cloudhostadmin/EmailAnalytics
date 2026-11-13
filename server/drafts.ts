/**
 * Reply drafts. Every conversation waiting on an answer gets a complete AI-drafted reply that stays
 * in the app. Facts the AI cannot know are written as [[provide: …]] placeholders (shown in yellow).
 * Nothing leaves the app until a person presses Send; then it goes through Gmail, in the same thread,
 * from the mailbox the customer wrote to.
 */
import { one, q } from './db';
import { HttpError } from './http';
import { audit } from './audit';
import type { SessionUser } from './auth';
import { getOrg } from './settings';
import { gmailSendReply, gmailSendEnabled } from './connectors/gmail';
import { footerForConversation } from './branding';
import { GITAPRESS_LOGO_PNG_BASE64 } from './assets';
import type { MailboxRow } from './connectors/types';
import { mailboxScope } from './auth';
import { attachmentsForSend } from './attachments';

export const PLACEHOLDER = /\[\[\s*provide\s*:(.*?)\]\](?!\])/gis;
export const placeholders = (body: string) => [...body.matchAll(PLACEHOLDER)].map((m) => m[1].trim());

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const bodyToHtml = (body: string) =>
	`<div style="font-family:Arial,'Noto Sans','Noto Sans Devanagari',sans-serif;font-size:14px;line-height:1.55;color:#1e1205">${esc(body)
		.replace(PLACEHOLDER, (_m, p) => `<span style="background:#fff176">[provide: ${p.trim()}]</span>`)
		.replace(/\r?\n/g, '<br>')}</div>`;

// copies of one reader's email in several mailboxes: the same message, a recognised duplicate, or a copy a
// staff member forwarded in (same reader, same time, same conversation). Parameters $2..$6: id, dedup_key,
// conversation_id, from_address, sent_at of the email.
const SAME_MESSAGE = `(e.id=$2 or e.duplicate_of=$2 or e.dedup_key=$3
	or (e.conversation_id=$4 and e.direction='inbound' and lower(e.from_address)=lower($5) and abs(extract(epoch from e.sent_at - $6::timestamptz)) < 120))`;

/** The latest inbound message, the mailbox to answer from, and who to address. */
async function replyContext(conversationId: number) {
	const last = await one<any>(
		`select e.* from emails e where e.conversation_id=$1 and e.direction='inbound' and not e.is_duplicate order by e.sent_at desc limit 1`,
		[conversationId],
	);
	if (!last) return null;
	// every copy of that message (it may have arrived in several mailboxes): prefer the mailbox a staff member
	// forwarded it to (the latest forward), then a shared mailbox, then a personal Gmail
	const copies = await q<any>(
		`select e.id, e.mailbox_id, e.provider_thread_id, e.forwarded_by, m.provider, m.address, m.status
		   from emails e join mailboxes m on m.id=e.mailbox_id
		  where e.org_id=$1 and ${SAME_MESSAGE}
		    and m.provider in ('gmail_app','gmail') and m.status <> 'paused'
		  order by case when e.forwarded_by is not null and lower(m.address) <> e.forwarded_by then 0 else 1 end,
		           case m.provider when 'gmail_app' then 0 else 1 end, e.created_at desc, e.id`,
		[last.org_id, last.id, last.dedup_key, last.conversation_id, last.from_address, last.sent_at],
	);
	const via = copies[0] || null;
	const ours = new Set<string>((await q<any>('select lower(address) a from mailboxes where org_id=$1', [last.org_id])).map((r) => r.a));
	const to = [last.from_address].filter(Boolean);
	const cc = [...new Set([...(last.to_addresses || []), ...(last.cc_addresses || [])].map((a: string) => a.toLowerCase()))]
		.filter((a) => a && !ours.has(a) && !to.includes(a))
		.slice(0, 10);
	return { last, via, to, cc };
}

const reSubject = (s: string) => (/^\s*re:/i.test(s || '') ? s : `Re: ${s || ''}`.trim());

/** Called after each analysis. Keeps a person's edits; refreshes untouched drafts; clears drafts no longer needed. */
export async function upsertDraft(conv: any, needsReply: boolean, body: string, model: string, autoFiles: number[] = []) {
	const org = await getOrg(conv.org_id);
	const existing = await one<any>('select * from reply_drafts where conversation_id=$1', [conv.id]);
	if (!needsReply || !body?.trim() || !org.settings.autoDrafts) {
		// answered from Gmail directly, or nothing to answer
		if (existing?.status === 'draft') {
			if (existing.edited) await q(`update reply_drafts set status='replied_elsewhere', updated_at=now() where id=$1`, [existing.id]);
			else await q('delete from reply_drafts where id=$1', [existing.id]);
		}
		return;
	}
	const ctx = await replyContext(conv.id);
	if (!ctx) return;
	if (existing) {
		const newMailSinceDone = existing.status !== 'draft' && ctx.last.id !== existing.reply_to_email_id;
		if (existing.status === 'draft' && existing.edited && ctx.last.id === existing.reply_to_email_id) return; // keep the person's edits
		if (existing.status !== 'draft' && !newMailSinceDone) return;
		await q(
			`update reply_drafts set body=$2, generated_body=$2, model=$3, edited=false, status='draft', to_addresses=$4, cc_addresses=$5, subject=$6,
			   reply_to_email_id=$7, send_mailbox_id = case when sender_chosen and send_mailbox_id is not null then send_mailbox_id else $8 end,
			   -- files: a new reply after one was sent starts with the automatic ones; a draft keeps its files and gains them
			   attachment_ids = case when $9 then $10::bigint[] else (select array(select distinct unnest(attachment_ids || $10::bigint[]))) end,
			   generated_at=now(), updated_at=now(), last_error=null where id=$1`,
			[existing.id, body, model, ctx.to, ctx.cc, reSubject(conv.subject), ctx.last.id, ctx.via?.mailbox_id ?? null, existing.status !== 'draft', autoFiles],
		);
		return;
	}
	await q(
		`insert into reply_drafts (org_id, conversation_id, body, generated_body, model, to_addresses, cc_addresses, subject, reply_to_email_id, send_mailbox_id, attachment_ids)
		 values ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (conversation_id) do nothing`,
		[conv.org_id, conv.id, body, model, ctx.to, ctx.cc, reSubject(conv.subject), ctx.last.id, ctx.via?.mailbox_id ?? null, autoFiles],
	);
}

const DRAFT_COLS = `d.id, d.conversation_id, d.body, d.edited, d.status, d.to_addresses, d.cc_addresses, d.subject, d.model, d.generated_at, d.updated_at,
	d.sent_at, d.last_error, d.send_mailbox_id, m.address as send_from, m.provider as send_provider, d.quote_original, d.sender_chosen,
	(select coalesce(json_agg(json_build_object('id', a.id, 'name', a.name, 'filename', a.filename, 'content_type', a.content_type, 'size', a.size, 'saved', a.saved)
	   order by array_position(d.attachment_ids, a.id)), '[]') from attachments a where a.id = any(d.attachment_ids)) as attachments,
	c.subject as conv_subject, c.rag, c.urgency, c.sentiment, c.summary, c.last_inbound_at, c.business_category, c.subcategory, c.awaiting_reply,
cu.name as customer_name, cu.tier as customer_tier, cu.buyer_tier, su.full_name as sent_by_name, uu.full_name as updated_by_name`;
const DRAFT_JOIN = `from reply_drafts d join conversations c on c.id=d.conversation_id left join customers cu on cu.id=c.customer_id
	left join mailboxes m on m.id=d.send_mailbox_id left join users su on su.id=d.sent_by left join users uu on uu.id=d.updated_by`;

const withMeta = (d: any) => d && { ...d, placeholders: placeholders(d.body), canSend: gmailSendEnabled() && !!d.send_mailbox_id, sendEnabled: gmailSendEnabled() };

/** Emails from Platinum and Gold customers come first in every order of the list (not in Sent). */
const IMPORTANT = `case coalesce(cu.buyer_tier, 'regular') when 'platinum' then 0 when 'gold' then 1 else 2 end`;
const DRAFT_SORTS: Record<string, string> = {
	priority: `${IMPORTANT}, case c.rag when 'red' then 0 when 'amber' then 1 else 2 end, c.last_inbound_at desc nulls last`,
	newest: `${IMPORTANT}, c.last_inbound_at desc nulls last`,
	oldest: `${IMPORTANT}, c.last_inbound_at asc nulls last`,
	ready: `${IMPORTANT}, case when d.body ~* '\\[\\[\\s*provide\\s*:' then 1 else 0 end, c.last_inbound_at desc nulls last`,
	sent: 'd.sent_at desc nulls last',
};
export async function listDrafts(where: string, params: unknown[], status: string, sort = 'priority') {
	const order = status === 'sent' ? DRAFT_SORTS.sent : DRAFT_SORTS[sort] || DRAFT_SORTS.priority;
	const rows = await q<any>(
		`select ${DRAFT_COLS}, c.urgency as conv_urgency, c.mailbox_ids ${DRAFT_JOIN} where ${where} and d.status = $${params.length + 1}
		 order by ${order} limit 200`,
		[...params, status],
	);
	return rows.map(withMeta);
}

export async function getDraft(id: number, orgId: number) {
	return withMeta(await one<any>(`select ${DRAFT_COLS} ${DRAFT_JOIN} where d.id=$1 and d.org_id=$2`, [id, orgId]));
}
export async function getDraftForConversation(conversationId: number, orgId: number) {
	return withMeta(await one<any>(`select ${DRAFT_COLS} ${DRAFT_JOIN} where d.conversation_id=$1 and d.org_id=$2`, [conversationId, orgId]));
}

const cleanList = (v: unknown) =>
	(Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/)).map((a) => String(a).trim().toLowerCase()).filter((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)).slice(0, 20);

export interface DraftEdits { body?: string; to?: unknown; cc?: unknown; subject?: string; sendMailboxId?: number | null; quoteOriginal?: boolean }

export async function saveDraft(user: SessionUser, id: number, input: DraftEdits) {
	const d = await one<any>('select * from reply_drafts where id=$1 and org_id=$2', [id, user.orgId]);
	if (!d) throw new HttpError(404, 'Draft not found');
	if (d.status === 'sent') throw new HttpError(400, 'This reply has already been sent');
	// the mailbox to send from, chosen by the person: only one they may send from
	if (input.sendMailboxId !== undefined && input.sendMailboxId !== null && Number(input.sendMailboxId) !== Number(d.send_mailbox_id)) {
		const opts = await senderOptions(user, id);
		if (!opts.options.some((o) => o.id === Number(input.sendMailboxId))) throw new HttpError(400, 'You cannot send from that mailbox');
		await q('update reply_drafts set send_mailbox_id=$2, sender_chosen=true, updated_at=now(), updated_by=$3 where id=$1', [id, Number(input.sendMailboxId), user.id]);
	}
	if (typeof input.quoteOriginal === 'boolean') await q('update reply_drafts set quote_original=$2 where id=$1', [id, input.quoteOriginal]);
	await q(
		`update reply_drafts set body=coalesce($2, body), to_addresses=coalesce($3, to_addresses), cc_addresses=coalesce($4, cc_addresses),
		   subject=coalesce($5, subject), edited = edited or ($2 is not null and $2 <> generated_body), status='draft', updated_at=now(), updated_by=$6 where id=$1`,
		[id, input.body ?? null, input.to !== undefined ? cleanList(input.to) : null, input.cc !== undefined ? cleanList(input.cc) : null, input.subject ?? null, user.id],
	);
	return getDraft(id, user.orgId);
}

export async function sendDraft(ctx: any, user: SessionUser, id: number, edits: DraftEdits) {
	if (edits && Object.values(edits).some((v) => v !== undefined)) await saveDraft(user, id, edits);
	const d = await one<any>('select * from reply_drafts where id=$1 and org_id=$2', [id, user.orgId]);
	if (!d) throw new HttpError(404, 'Draft not found');
	if (d.status === 'sent') throw new HttpError(400, 'This reply has already been sent');
	const open = placeholders(d.body);
	if (open.length) throw new HttpError(400, `Fill in the ${open.length} highlighted item${open.length > 1 ? 's' : ''} before sending: ${open.slice(0, 3).join('; ')}`);
	if (!d.to_addresses?.length) throw new HttpError(400, 'Add at least one recipient');
	if (!d.body.trim()) throw new HttpError(400, 'The reply is empty');
	const mb = d.send_mailbox_id ? await one<MailboxRow>('select * from mailboxes where id=$1', [d.send_mailbox_id]) : null;
	if (!mb) throw new HttpError(400, 'No connected Gmail mailbox received this email, so it cannot be answered from here');
	const src = d.reply_to_email_id ? await one<any>('select e.* from emails e where e.id=$1', [d.reply_to_email_id]) : null;
	// the same Gmail thread when this mailbox holds the reader's email itself (a forwarded copy sits in the staff thread instead)
	const copy = src
		? await one<any>(`select provider_thread_id from emails where mailbox_id=$1 and (id=$2 or dedup_key=$3) and forwarded_by is null limit 1`, [mb.id, src.id, src.dedup_key])
		: null;
	// a forwarded copy's Message-ID is the forward's, which the reader never had
	const originalId = src && !src.forwarded_by ? src.internet_message_id : null;
	const sender = await one<any>('select full_name, timezone from users where id=$1', [user.id]);
	// the footer: logo, website and the branch address for the reader's city (or the head office)
	const footer = await footerForConversation(user.orgId, d.conversation_id).catch(() => null);
	// the reader's email, quoted under the reply (their own text, never the internal forward)
	const quote = d.quote_original && src ? quoteOf(src, sender?.timezone) : null;
	const files = await attachmentsForSend(d.attachment_ids || []);
	const html = bodyToHtml(d.body).replace(/<\/div>$/, `${footer ? footer.html : ''}${quote ? quote.html : ''}</div>`);
	try {
		const res = await gmailSendReply(mb, {
			from: mb.address,
			fromName: mb.provider === 'gmail_app' ? (mb as any).display_name || undefined : sender?.full_name || undefined,
			to: d.to_addresses,
			cc: d.cc_addresses || [],
			subject: d.subject,
			text: `${d.body}${footer ? `\n${footer.text}` : ''}${quote ? quote.text : ''}`,
			html,
			inline: footer ? [{ cid: 'gitapress-logo', contentType: 'image/png', base64: GITAPRESS_LOGO_PNG_BASE64, filename: 'gitapress-logo.png' }] : [],
			attachments: files,
			threadId: copy?.provider_thread_id || null,
			inReplyTo: originalId,
			references: originalId ? [src?.in_reply_to, originalId].filter(Boolean) : [],
		});
		await q(`update reply_drafts set status='sent', sent_at=now(), sent_by=$2, provider_message_id=$3, last_error=null, updated_at=now() where id=$1`, [id, user.id, res.id]);
		await q(`update conversations set awaiting_reply=false, status=case when status='open' then 'in_progress' else status end, updated_at=now() where id=$1`, [d.conversation_id]);
		await audit(ctx, 'reply.sent', 'conversation', d.conversation_id, { draftId: id, from: mb.address, to: d.to_addresses, cc: d.cc_addresses, files: files.map((f) => f.filename) });
		return { success: true, mailboxId: mb.id, from: mb.address };
	} catch (e: any) {
		await q('update reply_drafts set last_error=$2, updated_at=now() where id=$1', [id, String(e.message).slice(0, 500)]);
		throw new HttpError(502, e.message);
	}
}

const validTz = (tz?: string | null) => {
	try {
		if (tz) new Intl.DateTimeFormat('en-GB', { timeZone: tz });
		return tz || 'Asia/Kolkata';
	} catch {
		return 'Asia/Kolkata';
	}
};

/** "On 3 Nov 2026, 10:15, Ramesh Kumar <ramesh@…> wrote:" and the reader's own text, quoted under the reply. */
export function quoteOf(src: any, tz?: string | null) {
	const when = new Intl.DateTimeFormat('en-GB', { timeZone: validTz(tz), dateStyle: 'medium', timeStyle: 'short' }).format(new Date(src.sent_at));
	const who = src.from_name ? `${src.from_name} <${src.from_address}>` : src.from_address;
	const head = `On ${when}, ${who} wrote:`;
	const body = String(src.body_text || src.body_clean || '').replace(/\r\n/g, '\n').trim().slice(0, 30_000);
	return {
		head,
		body,
		text: `\n\n${head}\n${body.split('\n').map((l) => `> ${l}`).join('\n')}\n`,
		html: `<br><div class="gmail_quote"><div class="gmail_attr" style="color:#555">${esc(head)}<br></div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${esc(body).replace(/\n/g, '<br>')}</blockquote></div>`,
	};
}

/** What the editor shows under the reply: the reader's email that will be quoted, and whether it was forwarded in. */
export async function quotePreview(user: SessionUser, draftId: number) {
	const d = await one<any>('select reply_to_email_id, quote_original from reply_drafts where id=$1 and org_id=$2', [draftId, user.orgId]);
	if (!d?.reply_to_email_id) return { quote: null };
	const src = await one<any>('select * from emails where id=$1', [d.reply_to_email_id]);
	if (!src) return { quote: null };
	// was a copy of it forwarded in by a colleague?
	const fwd = await one<any>(
		`select e.forwarded_by, e.forward_note, m.address as forwarded_to from emails e join mailboxes m on m.id=e.mailbox_id
		  where e.org_id=$1 and ${SAME_MESSAGE} and e.forwarded_by is not null order by e.created_at desc limit 1`,
		[user.orgId, src.id, src.dedup_key, src.conversation_id, src.from_address, src.sent_at],
	);
	const tz = (await one<any>('select timezone from users where id=$1', [user.id]))?.timezone;
	const q1 = quoteOf(src, tz);
	return { quote: { head: q1.head, body: q1.body.slice(0, 6000), truncated: q1.body.length > 6000, included: d.quote_original, forwardedBy: fwd?.forwarded_by || null, forwardedTo: fwd?.forwarded_to || null, forwardNote: fwd?.forward_note || null } };
}

export interface SenderOption { id: number; address: string; label: string; provider: string; received: boolean; forwardedBy: string | null }

/**
 * Mailboxes this person may send the reply from: the shared Gmail mailboxes they can see, their own
 * connected Gmail, and the one already chosen. Each says whether the reader's email is in it.
 */
export async function senderOptions(user: SessionUser, draftId: number): Promise<{ options: SenderOption[]; selected: number | null }> {
	const d = await one<any>('select id, send_mailbox_id, reply_to_email_id from reply_drafts where id=$1 and org_id=$2', [draftId, user.orgId]);
	if (!d) throw new HttpError(404, 'Draft not found');
	const scope = await mailboxScope(user);
	const rows = await q<any>(
		`select id, address, display_name, provider, created_by from mailboxes
		  where org_id=$1 and provider in ('gmail_app','gmail') and status <> 'paused' order by provider desc, lower(address)`,
		[user.orgId],
	);
	const src = d.reply_to_email_id ? await one<any>('select id, dedup_key, conversation_id, from_address, sent_at from emails where id=$1', [d.reply_to_email_id]) : null;
	const copies = src
		? await q<any>(`select e.mailbox_id, e.forwarded_by from emails e where e.org_id=$1 and ${SAME_MESSAGE}`, [user.orgId, src.id, src.dedup_key, src.conversation_id, src.from_address, src.sent_at])
		: [];
	const options = rows
		.filter((m) => Number(m.id) === Number(d.send_mailbox_id) || (m.provider === 'gmail_app' ? !scope || scope.includes(Number(m.id)) : Number(m.created_by) === user.id))
		.map((m) => {
			const here = copies.filter((c) => Number(c.mailbox_id) === Number(m.id));
			return {
				id: Number(m.id),
				address: m.address,
				label: m.display_name && m.display_name.toLowerCase() !== m.address.toLowerCase() ? `${m.display_name} <${m.address}>` : m.address,
				provider: m.provider,
				received: here.length > 0,
				forwardedBy: here.find((c) => c.forwarded_by && c.forwarded_by !== m.address.toLowerCase())?.forwarded_by || null,
			};
		});
	return { options, selected: d.send_mailbox_id ? Number(d.send_mailbox_id) : null };
}

export async function dismissDraft(ctx: any, user: SessionUser, id: number) {
	await q(`update reply_drafts set status='dismissed', updated_at=now(), updated_by=$3 where id=$1 and org_id=$2 and status='draft'`, [id, user.orgId, user.id]);
	await audit(ctx, 'reply.dismissed', 'reply_draft', id);
	return { success: true };
}

/**
 * Staff answer the yellow items in small boxes; the answers go into the draft and the AI rewrites the
 * email so it reads naturally (in the reader's language), keeping anything still unanswered as yellow.
 * Without the AI, the answers are put in place as typed.
 */
export async function fillDraft(user: SessionUser, id: number, answers: { item: string; value: string }[], rewrite = true) {
	const d = await one<any>('select * from reply_drafts where id=$1 and org_id=$2', [id, user.orgId]);
	if (!d) throw new HttpError(404, 'Draft not found');
	if (d.status === 'sent') throw new HttpError(400, 'This reply has already been sent');
	const given = (answers || []).map((a) => ({ item: String(a.item || '').trim(), value: String(a.value || '').trim().slice(0, 2000) })).filter((a) => a.item && a.value);
	if (!given.length) throw new HttpError(400, 'Type at least one answer');
	// 1. put each answer where its yellow item was
	const used = new Set<number>();
	let body: string = d.body.replace(PLACEHOLDER, (m: string, p: string) => {
		const i = given.findIndex((a) => a.item.toLowerCase() === p.trim().toLowerCase());
		if (i < 0) return m;
		used.add(i);
		return given[i].value;
	});
	if (!used.size) throw new HttpError(400, 'Those items are no longer in the draft. Reload and try again.');
	const stillOpen = placeholders(body).length;
	let model = 'inserted as typed';
	// 2. let the AI smooth it into a finished email
	if (rewrite) {
		try {
			const { askLLM, aiPaused } = await import('./ai/llm');
			if (!(await aiPaused())) {
				const conv = await one<any>('select subject, summary from conversations where id=$1', [d.conversation_id]);
				const last = d.reply_to_email_id ? await one<any>('select from_name, body_clean, body_text from emails where id=$1', [d.reply_to_email_id]) : null;
				const org = await getOrg(user.orgId);
				const system = `You edit email replies for ${org.name}. Rewrite the draft reply below into a finished, courteous email that includes the facts the team has just supplied, so the sentences around each fact read naturally.
Rules:
- Keep the same language and script as the draft (Hindi stays Hindi in Devanagari; translate a supplied fact if it was typed in another language).
- Keep the greeting, the overall structure and the signature block exactly as they are.
- Use only facts in the draft, the supplied answers and the reader's email. Do not add promises, dates, prices or policies.
- Keep every remaining [[provide: …]] item exactly as written, character for character.
- If a supplied answer makes a sentence unnecessary (for example "not applicable"), remove that sentence.
- Return only the email text: no preamble, no quotation marks, no markdown.`;
				const prompt = [
					`Subject: ${conv?.subject || d.subject}`,
					last ? `Reader's latest email (from ${last.from_name || 'the reader'}):\n${String(last.body_clean || last.body_text || '').slice(0, 2500)}` : '',
					`Facts supplied by the team:\n${given.filter((_a, k) => used.has(k)).map((a) => `- ${a.item}: ${a.value}`).join('\n')}`,
					`Draft with the facts already inserted:\n${body}`,
				].filter(Boolean).join('\n\n');
				const out = (await askLLM(user.orgId, system, prompt))?.trim().replace(/^```[a-z]*\n?|```$/g, '').trim();
				// accept only a plausible rewrite that kept the unanswered items
				if (out && out.length > body.length * 0.4 && out.length < body.length * 3 && placeholders(out).length === stillOpen) {
					body = out;
					model = 'rewritten by AI';
				}
			}
		} catch (e: any) {
			console.error('[drafts] rewrite failed, keeping the answers as typed:', e.message);
		}
	}
	await q(`update reply_drafts set body=$2, edited=true, status='draft', updated_at=now(), updated_by=$3 where id=$1`, [id, body, user.id]);
	return { draft: await getDraft(id, user.orgId), filled: used.size, remaining: stillOpen, how: model };
}
