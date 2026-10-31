/** Pipeline self-test against a throwaway database: npm test (needs DATABASE_URL to an empty test DB) */
import assert from 'node:assert/strict';
import { ensureSchema, getPool, q, one } from '../server/db';
import { defaultOrgId } from '../server/auth';
import { getOrg } from '../server/settings';
import { ingestMessages } from '../server/ingest';
import { analysePending, backfillSubcategories } from '../server/analyze';
import { SUBCATEGORIES, normaliseSubcategory } from '../server/ai/taxonomy';
import { DEFAULT_TEMPLATES, listTemplates, templatesForGroup } from '../server/templates';
import { importCsv, matchReference, parseCsv } from '../server/reference';
import { categoryReport } from '../server/views';
import { heuristicAnalyse } from '../server/ai/heuristic';
import { cleanBody, normalizeSubject, redactPII } from '../server/text';
import { placeholders, sendDraft, bodyToHtml, fillDraft } from '../server/drafts';
import { buildMime } from '../server/connectors/gmail';

assert.equal(normalizeSubject('RE: Fwd: [EXT] Late delivery'), 'late delivery');
assert.match(cleanBody('Thanks, done.\n\nOn Mon, 1 Jan 2026 at 10:00, Bob <b@x.com> wrote:\n> old text'), /^Thanks, done\.$/);
assert.equal(redactPII('card 4111 1111 1111 1111'), 'card [card-number]');

const msg = (body: string, subject = 'Order') => ({ index: 0, emailId: 1, direction: 'inbound' as const, from: 'r@gmail.com', fromName: 'Ramesh Sharma', sentAt: new Date().toISOString(), subject, body });
const input = (body: string, subject?: string) => ({ conversationId: 1, customerName: 'Ramesh Sharma', customerTier: 'standard', orgName: 'Gita Press', isInternal: false, isAutomated: false, replySignature: 'Regards,\nGita Press', messages: [msg(body, subject)] });

// legal escalation → red
const a = heuristicAnalyse(input('This is my third email and nobody has answered. This is very disappointing. I will file a complaint in the consumer forum.'));
assert.equal(a.sentiment, 'negative');
assert.equal(a.rag_suggestion, 'red');
assert.ok(a.legal_or_churn_signal);

// bulk request: categorised, and the draft asks the team to decide instead of guessing
const bulk = heuristicAnalyse(input('Our trust needs 5,000 copies of the Shrimad Bhagavad Gita within 2 months. Please confirm whether this can be supplied and the price with trade discount.', 'Requirement of 5,000 copies'));
assert.equal(bulk.business_category, 'sales_proposal');
assert.ok(bulk.categories.includes('bulk_order'));
assert.ok(bulk.requires_reply);
const ph = placeholders(bulk.suggested_reply);
assert.ok(ph.some((p) => /5,000/.test(p) && /yes \/ no/i.test(p)), `draft must ask whether 5,000 copies can be supplied: ${ph.join(' | ')}`);
assert.ok(bulk.suggested_reply.includes('Regards,\nGita Press'), 'signature added');

// Hindi complaint: categorised, negative, and the draft is written in Hindi
const hi = heuristicAnalyse(input('आदरणीय महोदय, मुझे गीता की प्रति मिली परंतु उसके पृष्ठ फटे हुए हैं। कृपया नई प्रति भेजें।', 'पुस्तक के पृष्ठ फटे हुए हैं'));
assert.ok(hi.categories.includes('damage'), `Hindi damage detected: ${hi.categories}`);
assert.equal(hi.sentiment, 'negative');
assert.match(hi.suggested_reply, /आदरणीय महोदय\/महोदया/);
assert.ok(placeholders(hi.suggested_reply).length >= 1);

// Kalyan subscription
const kal = heuristicAnalyse(input('मेरी कल्याण ग्राहक संख्या SUB-74013 है। इस माह का अंक अभी तक नहीं मिला है।', 'कल्याण का अंक'));
assert.equal(kal.business_category, 'kalyan');

// subgroups: every analysis gets one that belongs to its group
assert.equal(bulk.subcategory, 'institution_order');
assert.equal(hi.subcategory, 'damaged_book');
assert.equal(kal.subcategory, 'issue_not_received');
assert.equal(normaliseSubcategory('kalyan', 'nonsense'), 'renewal');
for (const [g, list] of Object.entries(DEFAULT_TEMPLATES))
	for (const sub of Object.keys(list)) assert.ok(SUBCATEGORIES[g as keyof typeof SUBCATEGORIES].some((x) => x.key === sub), `template ${g}/${sub} matches a subgroup`);
for (const [g, list] of Object.entries(SUBCATEGORIES))
	for (const sg of list) if (sg.replies) assert.ok(DEFAULT_TEMPLATES[g]?.[sg.key], `subgroup ${g}/${sg.key} has a default template`);
assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\n'), [['a', 'b'], ['x, y', 'he said "hi"']]);

// outgoing email: Hindi subject encoded, threaded headers present, placeholders highlighted in HTML
const mime = buildMime({ from: 'orders@gitapress.org', to: ['r@gmail.com'], cc: [], subject: 'Re: पुस्तक', text: 'धन्यवाद', html: '<p>धन्यवाद</p>', inReplyTo: '<a@b>', references: ['<a@b>'] });
assert.match(mime, /Subject: =\?UTF-8\?B\?/);
assert.match(mime, /In-Reply-To: <a@b>/);
assert.match(bodyToHtml('Yes [[provide: date]]'), /background:#fff176/);

await ensureSchema();
const orgId = await defaultOrgId();
await q(`update organisations set internal_domains='{gitapress.org}' where id=$1`, [orgId]);
const org = await getOrg(orgId, true);
const mk = async (addr: string) => one<any>(`insert into mailboxes (org_id, provider, address) values ($1,'demo',$2) on conflict (org_id, provider, lower(address)) do update set status='active' returning *`, [orgId, addr]);
const m1 = await mk('orders@gitapress.org');
const m2 = await mk('info@gitapress.org');
const base = { threadId: null, inReplyTo: null, references: [], cc: [], hasAttachments: false, importance: null, webLink: null, folder: 'inbox' as const, isAutomated: false };
const email = { ...base, providerMessageId: 'p1', internetMessageId: '<abc@gmail.com>', from: { address: 'jo@gmail.com', name: 'Jyoti' }, to: [{ address: 'orders@gitapress.org', name: '' }], subject: 'Damaged book received', bodyText: 'The Gita I received has torn pages. Please send a new copy.', sentAt: new Date() };
const r1 = await ingestMessages(org, m1, [email]);
const r2 = await ingestMessages(org, m2, [{ ...email, providerMessageId: 'p2' }]);
assert.equal(r1.inserted, 1);
assert.equal(r2.duplicates, 1, 'same Message-ID in a second mailbox must be a duplicate');
const reply = { ...base, providerMessageId: 'p3', internetMessageId: '<r1@gitapress.org>', inReplyTo: '<abc@gmail.com>', from: { address: 'neha.dubey@gitapress.org', name: 'Neha' }, to: [{ address: 'jo@gmail.com', name: '' }], subject: 'RE: Damaged book received', bodyText: 'Sorry, we will send a new copy by Friday.', sentAt: new Date(Date.now() + 60_000), folder: 'sent' as const };
await ingestMessages(org, m1, [reply]);
const conv = await one<any>(`select * from conversations where normalized_subject='damaged book received'`);
assert.equal(conv.message_count, 2);
assert.equal(conv.duplicate_count, 1);
assert.equal(conv.awaiting_reply, false);

// a reader waiting on an answer gets a stored draft
const ask = { ...base, providerMessageId: 'p4', internetMessageId: '<ask@gmail.com>', from: { address: 'meena@gmail.com', name: 'Meena' }, to: [{ address: 'orders@gitapress.org', name: '' }], subject: 'Order GP-2610444 not received', bodyText: 'I placed order GP-2610444 three weeks ago and have not received it. Please tell me when it will arrive.', sentAt: new Date() };
await ingestMessages(org, m1, [ask]);
await analysePending(orgId, 10);
const acts = await q<any>('select * from action_items where conversation_id=$1', [conv.id]);
assert.ok(acts.some((x) => x.is_commitment && x.due_date), 'commitment with due date extracted');
const waiting = await one<any>(`select * from conversations where normalized_subject like 'order gp-2610444%'`);
const draft = await one<any>('select * from reply_drafts where conversation_id=$1', [waiting.id]);
assert.ok(draft, 'draft created for a conversation awaiting reply');
assert.equal(draft.status, 'draft');
assert.deepEqual(draft.to_addresses, ['meena@gmail.com']);
assert.ok(placeholders(draft.body).length > 0, 'draft has items to fill in');
assert.ok(!(await one('select 1 from reply_drafts where conversation_id=$1', [conv.id])), 'no draft once the team has replied');
// Send is refused while yellow items remain
const admin = await one<any>(`insert into users (org_id, email, full_name, role) values ($1,'t@gitapress.org','Test','admin') returning id`, [orgId]);
await assert.rejects(sendDraft({}, { id: admin.id, orgId } as any, draft.id, {}), /Fill in the/);
// answers typed in the small boxes go into the email; without the AI they are inserted as typed
const items = [...new Set(placeholders(draft.body))];
const filled = await fillDraft({ id: admin.id, orgId } as any, draft.id, [{ item: items[0], value: '3 November 2026' }]);
assert.equal(filled.filled, 1);
assert.ok(filled.draft.body.includes('3 November 2026'));
assert.equal(placeholders(filled.draft.body).length, placeholders(draft.body).length - placeholders(draft.body).filter((p) => p === items[0]).length, 'every occurrence of that item answered');
await assert.rejects(fillDraft({ id: admin.id, orgId } as any, draft.id, [{ item: 'not in the draft', value: 'x' }]), /no longer in the draft/);
assert.ok(waiting.subcategory && SUBCATEGORIES[waiting.business_category as keyof typeof SUBCATEGORIES].some((x) => x.key === waiting.subcategory), `subgroup stored: ${waiting.business_category}/${waiting.subcategory}`);
assert.match(draft.body, /^Respected Meena ji,/, 'rules-engine draft follows the default template');

// templates are seeded, editable and given to the AI for the likely group
const tpls = await listTemplates(orgId);
assert.equal(tpls.length, Object.values(DEFAULT_TEMPLATES).reduce((n, l) => n + Object.keys(l).length, 0), 'every default template seeded');
const forKalyan = await templatesForGroup(orgId, 'kalyan', 'issue_not_received');
assert.equal(forKalyan[0].subgroup, 'issue_not_received');

// reference data: catalogue upload and matching against an email
const imp = await importCsv(orgId, 'book', 'code,title,language,price,in_stock\nGP-17,Shrimad Bhagavad Gita Tattva Vivechani,Hindi,250,yes\nGP-18,Ramcharitmanas,Hindi,300,no\n', true);
assert.equal(imp.added, 2);
assert.equal((await importCsv(orgId, 'book', 'code,title,price\nGP-18,Ramcharitmanas,320\n', false)).updated, 1);
await importCsv(orgId, 'faq', 'question,answer,keywords\nHow long does dispatch take?,Within 3 to 5 working days.,dispatch time;how long\n', true);
const mt = await matchReference(orgId, 'Please send 20 copies of Shrimad Bhagavad Gita Tattva Vivechani. How long does dispatch take?');
assert.ok(mt.some((m) => /Tattva Vivechani/.test(m.title) && /₹250/.test(m.text)), `book matched: ${JSON.stringify(mt)}`);
assert.ok(mt.some((m) => m.kind === 'faq'), 'faq matched');
assert.ok(!mt.some((m) => /Ramcharitmanas/.test(m.title)), 'unrelated book not matched');
await importCsv(orgId, 'book', 'code,title,language,price,in_stock,author,binding\n26,Shrimad Bhagavat Mahapuran Part 1,Hindi,450,yes,Vedvyas,Hardbound\n', false);
const byCode = await matchReference(orgId, 'Shrimad Bhagwat Mahapuran khand dono code 26 bhejiye');
assert.ok(byCode.some((m) => /Mahapuran/.test(m.title) && /binding Hardbound/.test(m.text)), `short book code and extra columns: ${JSON.stringify(byCode)}`);
assert.ok((await matchReference(orgId, 'पुस्तक कोड 26 उपलब्ध है?')).some((m) => /Mahapuran/.test(m.title)), 'Hindi code cited');

// customer database: the rules engine reads phone, address, PIN, subscriber number and language
const { rulesProfile, buildProfile, listCustomerDb } = await import('../server/profiles');
const rp = rulesProfile(['Kalyan issue missing\nमेरी ग्राहक संख्या 74013 है। अक्टूबर का अंक नहीं मिला।\nRamesh Sharma\n12, Gandhi Nagar, Near Hanuman Mandir\nJaipur, Rajasthan 302015\nMob 98290 12345'], { orders: ['GP-2610444'], books: [] }, 'r@gmail.com');
assert.equal(rp.pin, '302015');
assert.deepEqual(rp.phones, ['9829012345']);
assert.equal(rp.state, 'Rajasthan');
assert.ok(rp.address?.includes('Gandhi Nagar'), `address: ${rp.address}`);
assert.deepEqual(rp.subscriber_numbers, ['74013']);
assert.equal(rp.language, 'Hindi');
const anyCustomer = await one<any>('select customer_id from conversations where customer_id is not null limit 1');
const bp = await buildProfile(anyCustomer.customer_id, false);
assert.equal(bp.source, 'rules');
const db = await listCustomerDb(orgId, new URLSearchParams({ q: '' }));
assert.ok(db.totals.total >= 1 && db.rows[0].p);

// cold marketing is not waiting for a reply
const promo = heuristicAnalyse(input('Grow your business with our digital marketing and SEO services. Free listing for your books. Click to unsubscribe.', "Don't Just Advertise. Create Opportunities for Growth."));
assert.equal(promo.requires_reply, false);

// threads analysed before subgroups existed are back-filled; the report has headings and subheadings
await q('update conversations set subcategory=null where id=$1', [waiting.id]);
assert.ok((await backfillSubcategories(orgId)) >= 1);
assert.ok((await one<any>('select subcategory from conversations where id=$1', [waiting.id])).subcategory);
const rep = await categoryReport({ id: admin.id, orgId, email: 't@gitapress.org', role: 'admin', allMailboxes: true } as any, new URLSearchParams({ audience: 'all', to: new Date(Date.now() + 86400_000).toISOString() }));
const g = rep.groups.find((x: any) => x.conversations > 0)!;
assert.ok(g.label && g.subgroups.length, 'report group has subgroups');
assert.equal(rep.totals.conversations, rep.groups.reduce((n: number, x: any) => n + x.conversations, 0));
console.log('All pipeline tests passed');
await getPool().end();
