/**
 * The footer added to every reply when it is sent: the Gita Press logo, the website link and an address.
 * The address is the Gita Press branch in the reader's city when one is on file, otherwise the head office
 * in Gorakhpur. Branch addresses are kept in Settings → Reply drafts; a city is used only once its address
 * is filled in, so a reader is never sent an incomplete or guessed address.
 */
import { one } from './db';
import { getOrg } from './settings';
import { merged } from './profiles';

export interface Branch { city: string; state: string; address: string; phone?: string; email?: string }

export const WEBSITE = 'https://www.gitapress.org';
/** From gitapress.org/contactUs */
export const HEAD_OFFICE: Branch = {
	city: 'Gorakhpur',
	state: 'Uttar Pradesh',
	address: 'Gita Press, P.O. Gita Press, Gorakhpur 273005, Uttar Pradesh, India',
	phone: 'Books +91 92354 00244 · Kalyan +91 92354 00242',
	email: 'booksales@gitapress.org',
};
/** Branch cities (Wikipedia, "Gita Press"); addresses to be filled in by Gita Press. */
export const BRANCH_CITIES: [string, string][] = [
	['Bengaluru', 'Karnataka'], ['Bhilwara', 'Rajasthan'], ['Chennai', 'Tamil Nadu'], ['Coimbatore', 'Tamil Nadu'], ['Cuttack', 'Odisha'], ['Delhi', 'Delhi'],
	['Haridwar', 'Uttarakhand'], ['Hyderabad', 'Telangana'], ['Indore', 'Madhya Pradesh'], ['Jalgaon', 'Maharashtra'], ['Kanpur', 'Uttar Pradesh'], ['Kathmandu', 'Nepal'],
	['Kolkata', 'West Bengal'], ['Mumbai', 'Maharashtra'], ['Nagpur', 'Maharashtra'], ['Patna', 'Bihar'], ['Raipur', 'Chhattisgarh'], ['Ranchi', 'Jharkhand'],
	['Rishikesh', 'Uttarakhand'], ['Surat', 'Gujarat'], ['Varanasi', 'Uttar Pradesh'],
];
const ALIASES: Record<string, string[]> = {
	bengaluru: ['bangalore', 'बेंगलुरु', 'बैंगलोर'], chennai: ['madras', 'चेन्नई'], delhi: ['new delhi', 'नई दिल्ली', 'दिल्ली'], kolkata: ['calcutta', 'कोलकाता', 'कलकत्ता'],
	mumbai: ['bombay', 'मुंबई'], varanasi: ['banaras', 'benares', 'kashi', 'वाराणसी', 'काशी'], kanpur: ['कानपुर'], patna: ['पटना'], haridwar: ['hardwar', 'हरिद्वार'],
	rishikesh: ['ऋषिकेश'], indore: ['इंदौर'], raipur: ['रायपुर'], ranchi: ['रांची'], nagpur: ['नागपुर'], surat: ['सूरत'], hyderabad: ['secunderabad', 'हैदराबाद'],
	cuttack: ['कटक'], kathmandu: ['काठमांडू'], gorakhpur: ['गोरखपुर'],
};

export function branches(saved?: Branch[]): Branch[] {
	const byCity = new Map((saved || []).map((b) => [b.city.toLowerCase(), b]));
	return BRANCH_CITIES.map(([city, state]) => ({ city, state, address: '', phone: '', email: '', ...(byCity.get(city.toLowerCase()) || {}) }));
}

/** The branch in the reader's city (address on file), else the head office. */
export function pickBranch(list: Branch[], place: { city?: string; address?: string }): { branch: Branch; why: string } {
	const hay = ` ${`${place.city || ''} ${place.address || ''}`.toLowerCase()} `;
	for (const b of list) {
		if (!b.address.trim()) continue;
		const names = [b.city.toLowerCase(), ...(ALIASES[b.city.toLowerCase()] || [])];
		if (names.some((n) => hay.includes(` ${n} `) || hay.includes(` ${n},`) || hay.includes(`,${n} `) || (place.city || '').toLowerCase() === n)) return { branch: b, why: `the reader is in ${b.city}` };
	}
	const known = place.city ? `no branch address is on file for ${place.city}` : 'the reader\'s city is not known';
	return { branch: HEAD_OFFICE, why: `${known}, so the head office is used` };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function footerParts(b: Branch, orgName = 'Gita Press, Gorakhpur') {
	const title = b === HEAD_OFFICE || b.city === 'Gorakhpur' ? orgName : `Gita Press, ${b.city} branch`;
	const text = ['', '--', title, b.address, b.phone ? `Phone: ${b.phone}` : '', b.email ? `Email: ${b.email}` : '', WEBSITE].filter((x, i) => i < 2 || x).join('\n');
	const html = `<table cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:12px;font-family:Arial,'Noto Sans','Noto Sans Devanagari',sans-serif;font-size:12.5px;line-height:1.5;color:#475569"><tr>
<td style="padding-right:12px;vertical-align:top"><img src="cid:gitapress-logo" width="48" height="46" alt="Gita Press" style="display:block"></td>
<td style="vertical-align:top"><b style="color:#0f172a;font-size:13.5px">${esc(title)}</b><br>${esc(b.address)}${b.phone ? `<br>Phone: ${esc(b.phone)}` : ''}${b.email ? `<br>Email: <a href="mailto:${esc(b.email)}" style="color:#4f46e5">${esc(b.email)}</a>` : ''}<br><a href="${WEBSITE}" style="color:#4f46e5">www.gitapress.org</a></td>
</tr></table>`;
	return { title, text, html };
}

/** The footer for a draft, chosen from the customer's city or address. */
export async function footerForConversation(orgId: number, conversationId: number) {
	const org = await getOrg(orgId);
	if ((org.settings as any).replyFooter === false) return null;
	const cu = await one<any>('select cu.profile, cu.profile_manual from conversations c left join customers cu on cu.id=c.customer_id where c.id=$1', [conversationId]);
	const p = cu ? merged(cu) : {};
	const { branch, why } = pickBranch(branches((org.settings as any).branches), { city: p.city, address: p.address });
	return { branch, why, ...footerParts(branch, org.name) };
}
