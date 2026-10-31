import { formatDistanceToNowStrict, format } from 'date-fns';

export const ago = (d?: string | Date | null) => (d ? `${formatDistanceToNowStrict(new Date(d))} ago` : 'never');
export const fmtDate = (d?: string | Date | null, f = 'd MMM yyyy') => (d ? format(new Date(d), f) : '');
export const fmtDateTime = (d?: string | Date | null) => (d ? format(new Date(d), 'd MMM yyyy, HH:mm') : '');
export const minutes = (m?: number | null) => {
	if (m === null || m === undefined) return 'n/a';
	if (m < 60) return `${m}m`;
	if (m < 60 * 48) return `${(m / 60).toFixed(m < 600 ? 1 : 0)}h`;
	return `${Math.round(m / 1440)}d`;
};
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const hoursSince = (d?: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 3600_000 : 0);

export const CATEGORY_LABELS: Record<string, string> = {
	service_failure: 'Service failure',
	delay: 'Delivery delay',
	not_received: 'Order or parcel not received',
	damage: 'Damaged or misprinted book',
	wrong_item: 'Wrong or missing item',
	billing: 'Invoice and GST',
	payment: 'Payment failed or deducted',
	refund: 'Refund or cancellation',
	pricing: 'Price and availability',
	out_of_stock: 'Out of stock',
	subscription: 'Kalyan subscription',
	address_change: 'Address change',
	tracking: 'Tracking and VPP status',
	website_app: 'Website, app and e-books',
	bulk_order: 'Bulk and distributor orders',
	language_edition: 'Language, edition and translation',
	content_query: 'Scripture and content question',
	communication: 'Poor communication',
	contract: 'Escalation and legal',
	complaint: 'General complaint',
	compliment: 'Compliment',
	enquiry: 'Enquiry',
};
export const catLabel = (c: string) => CATEGORY_LABELS[c] || c;
export const stateLabel = (s?: string | null) => (s ? s.replace('_', ' ').replace(/^./, (c) => c.toUpperCase()) : '');

export const COLORS = {
	pink: '#4F46E5',
	navy: '#0F172A',
	blue: '#2563EB',
	amber: '#F59E0B',
	purple: '#7C3AED',
	teal: '#0D9488',
	general: '#475569',
	green: '#16A34A',
	red: '#DC2626',
	grey: '#CBD5E1',
};
export const RAG_COLORS: Record<string, string> = { red: COLORS.red, amber: COLORS.amber, green: COLORS.green };
export const SENT_COLORS: Record<string, string> = { negative: COLORS.red, neutral: '#CBD5E1', positive: COLORS.green };

export const BUSINESS_LABELS: Record<string, string> = {
	customer_service: 'Reader and customer service',
	book_orders: 'Book orders and e-books',
	kalyan: 'Kalyan subscriptions',
	dispatch: 'Dispatch, VPP and delivery',
	sales_proposal: 'Bulk orders, distributors and quotes',
	publications: 'Publications, translations and editorial',
	billing_finance: 'Payments, refunds and accounts',
	vendor_partner: 'Printing, paper and suppliers',
	people_hr: 'Careers and staff',
	internal: 'Internal team',
	events_marketing: 'Events, media and newsletters',
	notifications: 'Automated notifications',
	other: 'Other',
};
export const BUSINESS_SHORT: Record<string, string> = {
	customer_service: 'Readers', book_orders: 'Orders', kalyan: 'Kalyan', dispatch: 'Dispatch', sales_proposal: 'Bulk orders',
	publications: 'Editorial', billing_finance: 'Payments', vendor_partner: 'Suppliers', people_hr: 'Staff',
	internal: 'Internal', events_marketing: 'Events', notifications: 'Notifications', other: 'Other',
};
export const BUSINESS_COLORS: Record<string, string> = {
	customer_service: '#6366F1', book_orders: '#0EA5E9', kalyan: '#8B5CF6', dispatch: '#14B8A6', sales_proposal: '#F59E0B',
	publications: '#EC4899', billing_finance: '#10B981', vendor_partner: '#64748B', people_hr: '#84CC16',
	internal: '#334155', events_marketing: '#F97316', notifications: '#CBD5E1', other: '#94A3B8',
};
export const bizLabel = (c?: string | null) => (c ? BUSINESS_LABELS[c] || c : '');
export const STAGE_LABELS: Record<string, string> = {
	request_received: 'Request received', in_preparation: 'In preparation', submitted: 'Submitted', negotiation: 'Negotiation',
	won: 'Won', lost: 'Lost', no_response: 'No response',
};
export const KIND_LABELS: Record<string, string> = { customer: 'Reader or customer', prospect: 'Bulk buyer or prospect', vendor: 'Supplier', partner: 'Distributor or partner', candidate: 'Candidate', other: 'Other' };
