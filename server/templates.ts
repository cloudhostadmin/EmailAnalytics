/**
 * Default reply templates, one per subgroup that normally needs an answer. They are seeded into
 * reply_templates for each organisation and can be edited by admins in Help → Reply templates.
 *
 * Fields filled from the email: {{name}}, {{order_ref}}, {{book}}, {{signature}}.
 * [[provide: …]] is information only the team knows; it shows in yellow and blocks Send until filled.
 * The AI follows the template and translates it when the reader wrote in Hindi or another language.
 */
import { one, q } from './db';
import { HttpError } from './http';
import { SUBCATEGORIES, subgroupOf } from './ai/taxonomy';
import { BUSINESS_LABELS, type BusinessCategory } from './ai/types';

const T = (title: string, body: string, guidance = '') => ({ title, body: body.trim(), guidance });
const OPEN = 'Respected {{name}},\n\nThank you for writing to Gita Press.';
const CLOSE = 'Please write to us if you need any further help.\n\n{{signature}}';
const SORRY = 'Respected {{name}},\n\nThank you for writing to us, and please accept our sincere apologies for the inconvenience.';

export const DEFAULT_TEMPLATES: Record<string, Record<string, ReturnType<typeof T>>> = {
	customer_service: {
		damaged_book: T('Damaged or misprinted book', `${SORRY}

We are sorry that your copy of {{book}}{{order_ref}} reached you damaged. [[provide: replacement decision: a new copy will be sent on (date), or other resolution]].

[[provide: whether the reader needs to return the damaged copy, and how]]. A photograph of the damaged pages helps us improve our packing.

${CLOSE}`, 'Always offer a replacement. Ask for a photo only if none was attached.'),
		wrong_item: T('Wrong or missing item', `${SORRY}

We have checked your order{{order_ref}} and are sorry that it did not match what you ordered. [[provide: what will be sent (correct title, language or missing copies) and the dispatch date]].

[[provide: whether the wrong item should be returned, kept or given to someone who can use it]].

${CLOSE}`),
		not_received: T('Order not received', `${SORRY}

We have checked your order{{order_ref}}. It was dispatched on [[provide: dispatch date]] by [[provide: VPP / India Post / courier]] with tracking number [[provide: tracking number]]. You can track it at https://www.indiapost.gov.in.

[[provide: if not yet dispatched, the expected dispatch date; if lost, whether a replacement will be sent]].

${CLOSE}`),
		complaint_service: T('Complaint about service', `${SORRY}

We have shared your message with [[provide: department or person responsible]] and they are looking into it. [[provide: what has been done or will be done, and by when]].

Your feedback helps us serve readers better.

${CLOSE}`, 'Acknowledge the specific complaint in one sentence before the template text.'),
		general_query: T('General question', `${OPEN}

[[provide: answer to the reader's question]].

You can also browse our books at https://www.gitapress.org.

${CLOSE}`),
		feedback: T('Feedback and appreciation', `${OPEN} Your kind words mean a great deal to everyone at Gita Press.

[[provide: optional: response to any suggestion made]].

With regards and best wishes,
{{signature}}`, 'Short and warm. Remove the placeholder line if there was no suggestion.'),
	},
	book_orders: {
		new_order: T('New order', `${OPEN}

You can order books directly at https://www.gitapress.org or through our mobile app, which shows current prices and stock. [[provide: if ordering by email is accepted: total amount including postage for the listed titles, and how to pay]].

[[provide: any titles from the list that are not available at present]].

${CLOSE}`),
		order_status: T('Order status', `${OPEN}

We have checked your order{{order_ref}}. [[provide: current status: being packed / dispatched on (date) by (VPP / India Post / courier) with tracking number (number)]].

[[provide: expected delivery date]].

${CLOSE}`),
		payment_issue: T('Payment problem', `${SORRY}

We have checked the payment you mentioned{{order_ref}}. [[provide: payment status: order confirmed, or no payment received by us]].

If the amount was deducted but the order was not placed, it is normally returned to your account automatically within [[provide: refund timeline, e.g. 5 to 7 working days]]. [[provide: refund reference number if one has been raised]].

${CLOSE}`),
		cancellation: T('Change or cancel order', `${OPEN}

We have received your request to [[provide: change / cancel]] order{{order_ref}}. [[provide: whether the change or cancellation is possible (yes, or no because the order has already been dispatched)]].

[[provide: refund amount and timeline if cancelled]].

${CLOSE}`),
		ebook_app: T('E-books, website and app', `${OPEN}

We are sorry for the trouble with [[provide: website / app / e-book]]. [[provide: steps to fix the problem, or confirmation that the technical team is looking into it]].

If the problem continues, please send a screenshot and the phone or browser you are using.

${CLOSE}`),
		availability: T('Availability and price', `${OPEN}

{{book}} is [[provide: available / not available at present]] in [[provide: language and edition]], priced at [[provide: price]] plus postage.

You can order it at https://www.gitapress.org, through our app, or from any Gita Press branch or bookseller.

${CLOSE}`),
	},
	kalyan: {
		new_subscription: T('New Kalyan subscription', `${OPEN} We are glad you wish to subscribe to Kalyan.

The annual subscription is [[provide: current annual fee, the fee for longer terms, and whether the special issue is included]].[[provide: how to subscribe: website link, money order or branch]].

Your subscription starts from [[provide: the issue it will start from]].

${CLOSE}`),
		renewal: T('Kalyan renewal', `${OPEN}

Your Kalyan subscription{{order_ref}} [[provide: is valid until (month and year) / has expired in (month)]]. The renewal fee is [[provide: renewal fee]] and you can renew at [[provide: how to renew]].

Please quote your subscriber number when renewing.

${CLOSE}`),
		issue_not_received: T('Kalyan issue not received', `${SORRY}

We have checked your subscription{{order_ref}}. The [[provide: month]] issue was posted on [[provide: posting date]]. [[provide: whether a duplicate copy will be sent, and when]].

Please confirm your full postal address with PIN code so we can make sure future issues reach you.

${CLOSE}`),
		address_change: T('Kalyan address change', `${OPEN}

We have noted your new address for subscription{{order_ref}}. [[provide: confirm the address is updated, and from which issue it applies]].

${CLOSE}`, 'Repeat the new address back to the subscriber so they can check it.'),
		back_issues: T('Back issues and special issues', `${OPEN}

[[provide: whether the requested issue or special issue (visheshank) is available, its price, and how to order it]].

${CLOSE}`),
	},
	dispatch: {
		tracking: T('Tracking request', `${OPEN}

Your order{{order_ref}} was dispatched on [[provide: dispatch date]] by [[provide: VPP / India Post / courier]]. The tracking number is [[provide: tracking number]], and you can follow it at https://www.indiapost.gov.in.

${CLOSE}`),
		delivery_delay: T('Delivery delayed', `${SORRY}

Your parcel{{order_ref}} was dispatched on [[provide: dispatch date]] with tracking number [[provide: tracking number]]. [[provide: current status from tracking and what we are doing about it]].

[[provide: expected delivery date, or when a replacement will be sent if it is lost]].

${CLOSE}`),
		vpp_return: T('VPP returned or refused', `${OPEN}

Our records show that the VPP parcel{{order_ref}} was [[provide: returned / refused / not collected]] on [[provide: date]]. [[provide: whether it can be sent again, and the amount payable]].

${CLOSE}`),
		courier_damage: T('Damaged in transit', `${SORRY}

We are sorry that the parcel{{order_ref}} was damaged on the way. [[provide: replacement decision and dispatch date]].

A photograph of the parcel and the books will help us take this up with the postal department.

${CLOSE}`),
		address_problem: T('Address problem', `${OPEN}

The parcel{{order_ref}} could not be delivered because [[provide: reason: incomplete address, wrong PIN code, addressee not found]]. Please send your complete address with PIN code and phone number, and we will [[provide: re-send on (date) / next step]].

${CLOSE}`),
	},
	sales_proposal: {
		quote_request: T('Quote or price list request', `${OPEN} Thank you for your interest in our books.

[[provide: quote or price list for the requested titles and quantities, including trade discount]]. Postage or freight is [[provide: delivery charges]] and payment terms are [[provide: payment terms]].

Please confirm the titles, languages and quantities, and we will process your order.

${CLOSE}`),
		institution_order: T('Temple, school or institution order', `${OPEN} It is a joy to know that our books will be distributed through your [[provide: institution / event]].

[[provide: confirm whether the requested quantity can be supplied by the requested date (yes / no / partial)]]. [[provide: price, discount for this quantity, delivery charges and payment terms]].

[[provide: how to place the order and whom to contact]].

${CLOSE}`, 'Never confirm quantity or dates without the team.'),
		dealership: T('Dealership and bookseller enquiry', `${OPEN} Thank you for your interest in selling Gita Press books.

[[provide: dealership terms: minimum order, trade discount, deposit or documents needed]]. [[provide: the branch or person who handles new booksellers in the enquirer's area]].

${CLOSE}`),
		distributor_order: T('Distributor repeat order', `${OPEN}

We have received your order{{order_ref}}. [[provide: confirmation of titles and quantities that can be supplied, and any items out of stock]].

[[provide: invoice amount, expected dispatch date and transport]].

${CLOSE}`),
		negotiation: T('Quote follow-up', `${OPEN}

Regarding our quotation{{order_ref}}: [[provide: response to the request (revised discount, delivery time or terms), or the final offer]].

${CLOSE}`),
		international: T('International order', `${OPEN}

[[provide: how readers outside India can order: website with international shipping, overseas distributor, or email order]]. [[provide: shipping charges and delivery time to the reader's country]].

${CLOSE}`),
	},
	publications: {
		translation_request: T('Translation or new language', `${OPEN}

[[provide: whether {{book}} is available in the requested language; if not, whether a translation is planned]].

[[provide: if the writer offers to translate: the department to contact and what to send]].

${CLOSE}`),
		errata: T('Error reported in a book', `${OPEN} Thank you for taking the trouble to point this out.

We have passed the details to our editorial department, who will check [[provide: book, page and error reported]]. [[provide: correction will be made in the next reprint / it is correct as printed, with the reason]].

${CLOSE}`),
		permission: T('Permission to reproduce', `${OPEN}

[[provide: decision on the request to reproduce, quote, record or publish Gita Press content, and any conditions]].

${CLOSE}`, 'Permission decisions always need the editorial department.'),
		content_question: T('Scripture or content question', `${OPEN}

[[provide: answer to the question, or the book and chapter where it is explained]].

${CLOSE}`, 'Do not interpret scripture; the editorial team answers.'),
		manuscript: T('Manuscript or article submission', `${OPEN} Thank you for sending your [[provide: article / manuscript]].

[[provide: whether Gita Press accepts outside submissions for this, and what happens next]].

${CLOSE}`),
	},
	billing_finance: {
		refund_status: T('Refund status', `${OPEN}

Your refund{{order_ref}} of [[provide: amount]] was [[provide: initiated on (date) with reference (number) / not yet initiated because (reason)]]. Refunds usually reach the bank account within [[provide: refund timeline]].

${CLOSE}`),
		invoice_gst: T('Invoice and GST', `${OPEN}

[[provide: the invoice is attached / the corrected invoice will be sent by (date)]]. [[provide: GST details used on the invoice]].

${CLOSE}`, 'Attach the invoice in Gmail if the reply says it is attached.'),
		payment_confirmation: T('Payment confirmation', `${OPEN}

[[provide: confirmation that payment of (amount) on (date) was received and applied to (order or subscription), or that it has not been received yet]].

${CLOSE}`),
		bank_details: T('Bank details and payment methods', `${OPEN}

You can pay by [[provide: accepted payment methods]]. [[provide: bank or UPI details, only from the official reference information]].

Please send the transaction reference after payment so we can match it to your order.

${CLOSE}`, 'Never type bank details from memory; use the reference data.'),
	},
	vendor_partner: {
		rate_revision: T('Supplier rate revision', `Dear {{name}},

Thank you for your letter about the revised rates. [[provide: our response: accepted from (date), under review, or counter-proposal]].

{{signature}}`),
		purchase_order: T('Purchase order', `Dear {{name}},

[[provide: purchase order details or confirmation, delivery date and delivery address]].

{{signature}}`),
		supplier_invoice: T('Supplier invoice and payment', `Dear {{name}},

We have received your invoice{{order_ref}}. [[provide: payment status and expected payment date]].

{{signature}}`),
		new_vendor: T('New supplier offer', `Dear {{name}},

Thank you for your offer. [[provide: whether we are interested; if so, what to send (samples, rates, references) and to whom]].

{{signature}}`),
	},
	people_hr: {
		job_application: T('Job application', `Respected {{name}},

Thank you for your interest in working with Gita Press. [[provide: whether a suitable vacancy is open, and the next step or the department to contact]].

{{signature}}`),
	},
	events_marketing: {
		book_fair: T('Book fair and exhibition', `${OPEN} Thank you for the invitation.

[[provide: whether Gita Press will take part, and the contact person for the stall arrangements]].

${CLOSE}`),
		media_request: T('Media and interview request', `${OPEN}

[[provide: response to the media request, and the person who handles media]].

${CLOSE}`),
	},
	other: {
		other: T('General reply', `${OPEN}

[[provide: answer to the message]].

${CLOSE}`),
	},
};

export interface TemplateRow {
	id: number;
	group_key: BusinessCategory;
	subgroup_key: string;
	title: string;
	body: string;
	guidance: string;
	is_active: boolean;
	is_default: boolean;
	updated_at: string;
}

const seeded = new Set<number>();
/** Insert any missing default templates (never overwrites an edited one). */
export async function ensureTemplates(orgId: number) {
	if (seeded.has(orgId)) return;
	for (const [g, list] of Object.entries(DEFAULT_TEMPLATES))
		for (const [sub, t] of Object.entries(list))
			await q(
				`insert into reply_templates (org_id, group_key, subgroup_key, title, body, guidance) values ($1,$2,$3,$4,$5,$6)
				 on conflict (org_id, group_key, subgroup_key) do nothing`,
				[orgId, g, sub, t.title, t.body, t.guidance],
			);
	seeded.add(orgId);
}

export async function listTemplates(orgId: number): Promise<TemplateRow[]> {
	await ensureTemplates(orgId);
	const rows = await q<TemplateRow>('select * from reply_templates where org_id=$1', [orgId]);
	// keep the taxonomy order
	const order = Object.entries(SUBCATEGORIES).flatMap(([g, l]) => l.map((x) => `${g}/${x.key}`));
	return rows.sort((a, b) => order.indexOf(`${a.group_key}/${a.subgroup_key}`) - order.indexOf(`${b.group_key}/${b.subgroup_key}`));
}

/** Active templates for one group, for the AI prompt. */
export async function templatesForGroup(orgId: number, group: BusinessCategory, firstSub?: string) {
	await ensureTemplates(orgId);
	const rows = await q<TemplateRow>('select * from reply_templates where org_id=$1 and group_key=$2 and is_active', [orgId, group]);
	rows.sort((a, b) => (a.subgroup_key === firstSub ? -1 : b.subgroup_key === firstSub ? 1 : 0));
	return rows.map((t) => ({
		group: group,
		subgroup: t.subgroup_key,
		label: subgroupOf(group, t.subgroup_key)?.label || t.title,
		body: t.guidance ? `${t.body}\n(Guidance for the writer: ${t.guidance})` : t.body,
	}));
}

export async function getTemplate(orgId: number, group: string, sub: string) {
	await ensureTemplates(orgId);
	return one<TemplateRow>('select * from reply_templates where org_id=$1 and group_key=$2 and subgroup_key=$3 and is_active', [orgId, group, sub]);
}

export async function updateTemplate(orgId: number, userId: number, id: number, input: { title?: string; body?: string; guidance?: string; is_active?: boolean }) {
	const t = await one<TemplateRow>('select * from reply_templates where id=$1 and org_id=$2', [id, orgId]);
	if (!t) throw new HttpError(404, 'Template not found');
	if (input.body !== undefined && !String(input.body).trim()) throw new HttpError(400, 'The template cannot be empty');
	await q(
		`update reply_templates set title=coalesce($3,title), body=coalesce($4,body), guidance=coalesce($5,guidance), is_active=coalesce($6,is_active),
		   is_default=false, updated_at=now(), updated_by=$7 where id=$1 and org_id=$2`,
		[id, orgId, input.title?.slice(0, 120) ?? null, input.body?.slice(0, 6000) ?? null, input.guidance?.slice(0, 1000) ?? null, input.is_active ?? null, userId],
	);
	return one<TemplateRow>('select * from reply_templates where id=$1', [id]);
}

export async function resetTemplate(orgId: number, id: number) {
	const t = await one<TemplateRow>('select * from reply_templates where id=$1 and org_id=$2', [id, orgId]);
	if (!t) throw new HttpError(404, 'Template not found');
	const d = DEFAULT_TEMPLATES[t.group_key]?.[t.subgroup_key];
	if (!d) throw new HttpError(400, 'This template has no built-in default');
	await q('update reply_templates set title=$2, body=$3, guidance=$4, is_active=true, is_default=true, updated_at=now() where id=$1', [id, d.title, d.body, d.guidance]);
	return one<TemplateRow>('select * from reply_templates where id=$1', [id]);
}

/** Fill a template's {{fields}} for the rules engine (the AI does this itself). */
export function renderTemplate(body: string, f: { name?: string; orderRef?: string; book?: string; signature: string }) {
	return body
		.replace(/\{\{\s*name\s*\}\}/g, f.name ? `${f.name} ji` : 'Sir/Madam')
		.replace(/\{\{\s*order_ref\s*\}\}/g, f.orderRef ? ` ${f.orderRef}` : '')
		.replace(/\{\{\s*book\s*\}\}/g, f.book || '[[provide: book title]]')
		.replace(/\{\{\s*signature\s*\}\}/g, f.signature)
		.replace(/\n(?:\(Guidance[^\n]*\))$/, '');
}

export const groupLabel = (g: string) => BUSINESS_LABELS[g as BusinessCategory] || g;
