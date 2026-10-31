/**
 * Email groups (headings) and subgroups (subheadings). Every analysed conversation gets one group
 * (business_category) and one subgroup (subcategory). The same structure drives the category report,
 * the Help section and the default reply templates.
 */
import type { BusinessCategory } from './types';

export interface Subgroup {
	key: string;
	label: string;
	description: string;
	/** true when the subgroup normally needs an answer, so it gets a default reply template */
	replies: boolean;
}

export const GROUP_DESCRIPTIONS: Record<BusinessCategory, string> = {
	customer_service: 'Readers and customers raising a problem, complaint, question or feedback about books or service.',
	book_orders: 'Placing, changing or asking about a book or e-book order from the website, app, phone or post.',
	kalyan: 'Kalyan and Kalyana-Kalpataru magazine subscriptions, renewals and issues.',
	dispatch: 'Parcels, VPP, India Post and courier tracking, delivery and returns.',
	sales_proposal: 'Bulk orders, booksellers, distributors, temples, schools and institutions asking for quotes, trade terms or dealership.',
	publications: 'Editorial matters: translations, editions, errata, permissions and content questions.',
	billing_finance: 'Invoices, GST, payments, refunds and bank details.',
	vendor_partner: 'Printing, paper, ink, binding, logistics and software suppliers.',
	people_hr: 'Careers, applications and staff matters.',
	internal: 'Gita Press staff talking to each other.',
	events_marketing: 'Book fairs, exhibitions, media and newsletters.',
	notifications: 'Automated messages from payment gateways, couriers and systems.',
	other: 'Anything that fits no other group.',
};

const s = (key: string, label: string, description: string, replies = true): Subgroup => ({ key, label, description, replies });

export const SUBCATEGORIES: Record<BusinessCategory, Subgroup[]> = {
	customer_service: [
		s('damaged_book', 'Damaged or misprinted book', 'Torn, wet, misprinted or missing pages; asks for a replacement.'),
		s('wrong_item', 'Wrong or missing item', 'Received a different book, language or edition, or fewer copies than ordered.'),
		s('not_received', 'Order not received', 'Paid or ordered but nothing has arrived.'),
		s('complaint_service', 'Complaint about service', 'Unhappy with response times, staff or how a problem was handled.'),
		s('general_query', 'General question', 'Questions about books, availability, timings or how to order.'),
		s('feedback', 'Feedback and appreciation', 'Thanks, blessings or suggestions; usually a short acknowledgement.'),
	],
	book_orders: [
		s('new_order', 'New order', 'Wants to buy books by email, or sends a list of titles.'),
		s('order_status', 'Order status', 'Asks where an existing order is or when it will be dispatched.'),
		s('payment_issue', 'Payment problem', 'Money deducted but order not confirmed, or payment failed.'),
		s('cancellation', 'Change or cancel order', 'Wants to change titles, quantity or address, or cancel.'),
		s('ebook_app', 'E-books, website and app', 'Problems with the website, mobile app, login or e-book access.'),
		s('availability', 'Availability and price', 'Asks whether a title, language or edition is available, and its price.'),
	],
	kalyan: [
		s('new_subscription', 'New subscription', 'Wants to subscribe to Kalyan or Kalyana-Kalpataru.'),
		s('renewal', 'Renewal', 'Renewing, or asking about renewal fees and dates.'),
		s('issue_not_received', 'Issue not received', 'A monthly issue or the annual special issue has not arrived.'),
		s('address_change', 'Address change', 'Change of postal address for the subscription.'),
		s('back_issues', 'Back issues and special issues', 'Wants old issues or a particular special issue (visheshank).'),
	],
	dispatch: [
		s('tracking', 'Tracking request', 'Asks for the India Post or courier tracking number.'),
		s('delivery_delay', 'Delivery delayed', 'Dispatched but late or stuck in transit.'),
		s('vpp_return', 'VPP returned or refused', 'VPP parcel returned, refused or not collected.'),
		s('courier_damage', 'Damaged in transit', 'Parcel arrived damaged or opened.'),
		s('address_problem', 'Address problem', 'Wrong or incomplete address, or parcel undeliverable.'),
	],
	sales_proposal: [
		s('quote_request', 'Quote or price list request', 'Asks for a quotation, price list or trade discount.'),
		s('institution_order', 'Temple, school or institution order', 'Large order for distribution, events, schools or temples.'),
		s('dealership', 'Dealership and bookseller enquiry', 'Wants to become a dealer, bookseller or stockist.'),
		s('distributor_order', 'Distributor repeat order', 'An existing distributor or dealer placing a repeat order.'),
		s('negotiation', 'Negotiation and follow-up', 'Follow-up on a quote: discount, delivery time or terms.'),
		s('international', 'International order', 'Orders or enquiries from outside India.'),
	],
	publications: [
		s('translation_request', 'Translation or new language', 'Asks for a book in another language, or offers to translate.'),
		s('errata', 'Errors in a book', 'Reports a printing or textual error.'),
		s('permission', 'Permission to reproduce', 'Asks to quote, reprint, record or publish Gita Press content.'),
		s('content_question', 'Scripture or content question', 'A question about the meaning of a text or a passage.'),
		s('manuscript', 'Manuscript or article submission', 'Sends an article, manuscript or proposal for publication.'),
	],
	billing_finance: [
		s('refund_status', 'Refund status', 'Asks when a refund will arrive.'),
		s('invoice_gst', 'Invoice and GST', 'Needs an invoice, GST bill or correction.'),
		s('payment_confirmation', 'Payment confirmation', 'Sends proof of payment or asks whether money was received.'),
		s('bank_details', 'Bank details and payment methods', 'Asks how or where to pay.'),
	],
	vendor_partner: [
		s('rate_revision', 'Rate revision', 'A supplier changing prices or terms.'),
		s('purchase_order', 'Purchase order', 'Purchase orders and their confirmations.'),
		s('supplier_invoice', 'Supplier invoice and payment', 'A supplier invoice, or a supplier chasing payment.'),
		s('new_vendor', 'New supplier offer', 'A supplier offering products or services.'),
	],
	people_hr: [
		s('job_application', 'Job application', 'A CV, application or question about vacancies.'),
		s('staff_matter', 'Staff matter', 'Leave, payroll or other staff matters.', false),
	],
	internal: [
		s('internal_coordination', 'Team coordination', 'Staff coordinating work between departments.', false),
		s('stock_reprint', 'Stock and reprint', 'Stock levels, reprints and production planning.', false),
	],
	events_marketing: [
		s('book_fair', 'Book fair and exhibition', 'Invitations to or arrangements for book fairs and stalls.'),
		s('media_request', 'Media and interview request', 'Journalists, documentaries and interviews.'),
		s('newsletter', 'Newsletter and promotion', 'Newsletters and promotions sent to us.', false),
	],
	notifications: [
		s('payment_gateway', 'Payment gateway', 'Settlement and transaction notices.', false),
		s('courier_updates', 'Courier updates', 'Automatic India Post or courier status messages.', false),
		s('system', 'System message', 'Other automated messages.', false),
	],
	other: [s('other', 'Other', 'Does not fit any subgroup.')],
};

export const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flatMap((l) => l.map((x) => x.key));
const BY_KEY = new Map<string, Subgroup & { group: BusinessCategory }>();
for (const [g, list] of Object.entries(SUBCATEGORIES)) for (const x of list) if (!BY_KEY.has(x.key)) BY_KEY.set(x.key, { ...x, group: g as BusinessCategory });

/** key is unique per group; some keys (wrong_item, not_received, address_change) are shared by meaning across groups */
export const subgroupOf = (group: BusinessCategory, key: string | null | undefined) =>
	SUBCATEGORIES[group]?.find((x) => x.key === key) || null;

export const subcategoryLabel = (key: string | null | undefined) => (key && BY_KEY.get(key)?.label) || 'Not set';

/** The subgroup used when nothing more specific fits. */
const FALLBACK: Partial<Record<BusinessCategory, string>> = {
	customer_service: 'general_query',
	book_orders: 'new_order',
	kalyan: 'renewal',
	dispatch: 'tracking',
	sales_proposal: 'quote_request',
	publications: 'content_question',
	billing_finance: 'payment_confirmation',
	vendor_partner: 'new_vendor',
	notifications: 'system',
};

/** Make sure a subgroup belongs to its group; otherwise pick the group's first. */
export function normaliseSubcategory(group: BusinessCategory, key: unknown): string {
	const list = SUBCATEGORIES[group] || SUBCATEGORIES.other;
	const k = String(key || '').trim().toLowerCase();
	return list.find((x) => x.key === k)?.key || FALLBACK[group] || list[0].key;
}

/** For the prompt: one line per group with its subgroups. */
export function taxonomyForPrompt(): string {
	return Object.entries(SUBCATEGORIES)
		.map(([g, list]) => `${g}: ${list.map((x) => `${x.key} (${x.label})`).join(', ')}`)
		.join('\n');
}

export function taxonomyTree() {
	return (Object.keys(SUBCATEGORIES) as BusinessCategory[]).map((g) => ({
		key: g,
		description: GROUP_DESCRIPTIONS[g],
		subgroups: SUBCATEGORIES[g],
	}));
}
