/**
 * Edits an AI-drafted reply. Facts the AI could not know appear as yellow [[provide: …]] placeholders;
 * click one and type over it. Nothing is sent until Send is pressed, and Send stays disabled while any
 * yellow item remains. Sending goes through Gmail as a reply in the same thread.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MdSend, MdSave, MdRefresh, MdClose, MdContentCopy, MdArrowForward, MdInfoOutline, MdAutoAwesome, MdEditNote, MdAttachFile } from 'react-icons/md';
import { api, BASE, getToken } from '../api/client';
import { Switch } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ago } from '../lib/format';

const PH = /\[\[\s*provide\s*:(.*?)\]\](?!\])/gis;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** text → HTML with yellow, clickable placeholders */
function toHtml(text: string) {
	return esc(text).replace(PH, (_m, p) => `<mark class="ph" data-ph="${esc(p.trim())}">${esc(p.trim())}</mark>`);
}
/** editor DOM → text; an untouched placeholder is written back as [[provide: …]] */
function fromDom(el: HTMLElement): string {
	let out = '';
	const walk = (n: Node) => {
		if (n.nodeType === Node.TEXT_NODE) { out += n.textContent || ''; return; }
		if (!(n instanceof HTMLElement)) return;
		if (n.tagName === 'BR') { out += '\n'; return; }
		if (n.tagName === 'MARK' && n.dataset.ph !== undefined) {
			const t = n.textContent || '';
			out += t === n.dataset.ph ? `[[provide: ${t}]]` : t;
			return;
		}
		const block = n.tagName === 'DIV' || n.tagName === 'P';
		if (block && out && !out.endsWith('\n')) out += '\n';
		n.childNodes.forEach(walk);
	};
	el.childNodes.forEach(walk);
	return out;
}

const MAX_FILE_MB = 10;
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const readBase64 = (f: File) =>
	new Promise<string>((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
		r.onerror = () => reject(new Error(`Could not read ${f.name}`));
		r.readAsDataURL(f);
	});
/** open a stored file (downloads need the sign-in token, so not a plain link) */
async function openFile(id: number, filename: string) {
	const res = await fetch(`${BASE}/api/attachments/${id}/file`, { headers: { authorization: `Bearer ${getToken()}` } });
	if (!res.ok) throw new Error('The file could not be opened');
	const url = URL.createObjectURL(await res.blob());
	const a = document.createElement('a');
	a.href = url;
	a.target = '_blank';
	a.rel = 'noopener';
	if (!/^(image\/|application\/pdf)/.test(res.headers.get('content-type') || '')) a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const countPlaceholders = (body: string) => (body.match(PH) || []).length;
/** the distinct yellow items in a draft, in order */
export const placeholderList = (body: string) => [...new Set([...body.matchAll(PH)].map((m) => m[1].trim()))];

export default function DraftEditor({ draft, onDone, compact }: { draft: any; onDone?: () => void; compact?: boolean }) {
	const { can } = useAuth();
	const toast = useToast();
	const qc = useQueryClient();
	const ref = useRef<HTMLDivElement>(null);
	const [body, setBody] = useState<string>(draft.body);
	const [to, setTo] = useState<string>((draft.to_addresses || []).join(', '));
	const [cc, setCc] = useState<string>((draft.cc_addresses || []).join(', '));
	const [subject, setSubject] = useState<string>(draft.subject || '');
	const [dirty, setDirty] = useState(false);
	const [senderId, setSenderId] = useState<number | null>(draft.send_mailbox_id ?? null);
	const [quoteOn, setQuoteOn] = useState<boolean>(draft.quote_original !== false);
	const [files, setFiles] = useState<any[]>(draft.attachments || []);
	const [uploading, setUploading] = useState(0);
	const sent = draft.status === 'sent';
	const editable = can('analyst') && !sent;

	// load a different draft (or a regenerated one) into the editor
	useEffect(() => {
		setBody(draft.body);
		setTo((draft.to_addresses || []).join(', '));
		setCc((draft.cc_addresses || []).join(', '));
		setSubject(draft.subject || '');
		setSenderId(draft.send_mailbox_id ?? null);
		setQuoteOn(draft.quote_original !== false);
		setFiles(draft.attachments || []);
		setDirty(false);
		if (ref.current) ref.current.innerHTML = toHtml(draft.body);
	}, [draft.id, draft.body, draft.updated_at]);

	// the mailboxes this reply can go from, the reader's email quoted under it, and the saved files
	const sendersQ = useQuery({ queryKey: ['draft-senders', draft.id], queryFn: () => api(`/drafts/${draft.id}/senders`), enabled: editable, staleTime: 60_000 });
	const quoteQ = useQuery({ queryKey: ['draft-quote', draft.id, draft.updated_at], queryFn: () => api(`/drafts/${draft.id}/quote`), staleTime: 60_000 });
	const savedQ = useQuery({ queryKey: ['saved-attachments'], queryFn: () => api('/attachments/saved'), enabled: editable, staleTime: 300_000 });
	const senders: any[] = sendersQ.data?.options || [];
	const chosen = senders.find((o) => o.id === senderId);
	const quote = quoteQ.data?.quote;

	const footerQ = useQuery({ queryKey: ['draft-footer', draft.id], queryFn: () => api(`/drafts/${draft.id}/footer`), staleTime: 300_000, enabled: draft.status !== 'sent' });
	const open = useMemo(() => countPlaceholders(body), [body]);
	const items = useMemo(() => placeholderList(body), [body]);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	useEffect(() => setAnswers({}), [draft.id]);
	const typed = items.filter((i) => answers[i]?.trim()).length;
	const refresh = () => { qc.invalidateQueries({ queryKey: ['drafts'] }); qc.invalidateQueries({ queryKey: ['draft'] }); qc.invalidateQueries({ queryKey: ['conversation'] }); qc.invalidateQueries({ queryKey: ['nav-drafts'] }); };
	const payload = () => ({ body: ref.current ? fromDom(ref.current) : body, to, cc, subject, sendMailboxId: senderId, quoteOriginal: quoteOn });

	const addFiles = async (list: FileList | null) => {
		for (const f of Array.from(list || [])) {
			if (f.size > MAX_FILE_MB * 1024 * 1024) { toast(`${f.name} is larger than ${MAX_FILE_MB} MB`, 'error'); continue; }
			setUploading((n) => n + 1);
			try {
				const r = await api(`/drafts/${draft.id}/attachments`, { body: { filename: f.name, contentType: f.type, base64: await readBase64(f) } });
				setFiles(r.attachments);
			} catch (e: any) {
				toast(e.message, 'error');
			} finally {
				setUploading((n) => n - 1);
			}
		}
	};
	const addSaved = async (id: number) => {
		try { setFiles((await api(`/drafts/${draft.id}/attachments`, { body: { savedId: id } })).attachments); }
		catch (e: any) { toast(e.message, 'error'); }
	};
	const removeFile = async (id: number) => {
		try { setFiles((await api(`/drafts/${draft.id}/attachments/${id}`, { method: 'DELETE' })).attachments); }
		catch (e: any) { toast(e.message, 'error'); }
	};
	const canSend = !!draft.sendEnabled && !!senderId;

	const save = useMutation({ mutationFn: () => api(`/drafts/${draft.id}`, { method: 'PUT', body: payload() }), onSuccess: () => { setDirty(false); refresh(); toast('Draft saved'); }, onError: (e: any) => toast(e.message, 'error') });
	const send = useMutation({
		mutationFn: () => api(`/drafts/${draft.id}/send`, { body: payload() }),
		onSuccess: (r) => { refresh(); toast(`Sent from ${r.from}`); onDone?.(); },
		onError: (e: any) => { refresh(); toast(e.message, 'error'); },
	});
	const regen = useMutation({ mutationFn: () => api(`/drafts/${draft.id}/regenerate`, { body: {} }), onSuccess: () => { refresh(); toast('A new draft was written'); }, onError: (e: any) => toast(e.message, 'error') });
	const fill = useMutation({
		mutationFn: async (rewrite: boolean) => {
			if (dirty) await api(`/drafts/${draft.id}`, { method: 'PUT', body: payload() });
			return api(`/drafts/${draft.id}/fill`, { body: { rewrite, answers: items.filter((i) => answers[i]?.trim()).map((i) => ({ item: i, value: answers[i] })) } });
		},
		onSuccess: (r: any) => {
			setAnswers({});
			setDirty(false);
			refresh();
			toast(`${r.how === 'rewritten by AI' ? 'Email rewritten with your answers' : 'Answers added to the email'}${r.remaining ? `; ${r.remaining} item${r.remaining > 1 ? 's' : ''} still to fill in` : '; ready to send'}`);
		},
		onError: (e: any) => toast(e.message, 'error'),
	});
	const dismiss = useMutation({ mutationFn: () => api(`/drafts/${draft.id}/dismiss`, { body: {} }), onSuccess: () => { refresh(); toast('Draft dismissed'); onDone?.(); } });

	const onInput = () => { if (ref.current) { setBody(fromDom(ref.current)); setDirty(true); } };
	const nextPlaceholder = () => {
		const m = ref.current?.querySelector('mark.ph') as HTMLElement | null;
		if (!m) return;
		m.scrollIntoView({ block: 'center' });
		const r = document.createRange();
		r.selectNodeContents(m);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
		ref.current?.focus();
	};
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
	};
	const onPaste = (e: React.ClipboardEvent) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); };

	return (
		<div className="draft-editor">
			{!compact && draft.summary && <div className="small muted mb-8">{draft.summary}</div>}
			<div className="draft-fields">
				<label htmlFor={`fr-${draft.id}`}>From</label>
				{editable && senders.length > 0 ? (
					<div>
						<select id={`fr-${draft.id}`} className="input" value={senderId ?? ''} onChange={(e) => { setSenderId(Number(e.target.value)); setDirty(true); }}>
							{senderId == null && <option value="">Choose a mailbox</option>}
							{senders.map((o) => (
								<option key={o.id} value={o.id}>{o.label}{o.forwardedBy ? ' (forwarded here)' : o.received ? ' (received here)' : ''}</option>
							))}
						</select>
						{chosen && (
							<div className="xs faint mt-4">
								{chosen.forwardedBy
									? `${chosen.forwardedBy} forwarded the reader's email to this mailbox.`
									: chosen.received
										? "The reader's email arrived in this mailbox; the reply joins the same thread."
										: "The reader's email is not in this mailbox; the reply goes to them as a new email from it."}
							</div>
						)}
					</div>
				) : (
					<div className="mono small">{draft.send_from || <span className="faint">No connected Gmail mailbox received this email</span>}</div>
				)}
				<label htmlFor={`to-${draft.id}`}>To</label><input id={`to-${draft.id}`} className="input" value={to} disabled={!editable} onChange={(e) => { setTo(e.target.value); setDirty(true); }} />
				<label htmlFor={`cc-${draft.id}`}>Cc</label><input id={`cc-${draft.id}`} className="input" value={cc} disabled={!editable} placeholder="Optional" onChange={(e) => { setCc(e.target.value); setDirty(true); }} />
				<label htmlFor={`su-${draft.id}`}>Subject</label><input id={`su-${draft.id}`} className="input" value={subject} disabled={!editable} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} />
			</div>
			{open > 0 && editable && (
				<div className="info-needed mt-8">
					<div className="row-between">
						<b className="row" style={{ gap: 6 }}><MdEditNote /> Information needed ({items.length})</b>
						<button className="btn ghost sm" onClick={nextPlaceholder} title="Jump to the next yellow item in the email">Show in email <MdArrowForward /></button>
					</div>
					<div className="xs faint">Type each answer in its box, in Hindi or English. Then press <b>Add and rewrite</b>: the email is rewritten so your answers read naturally, in the reader's language.</div>
					<div className="info-items">
						{items.map((it, k) => (
							<label key={it} className="info-item">
								<span>{k + 1}. {it}</span>
								<textarea className="input" rows={1} value={answers[it] || ''} placeholder="Type the answer"
									onChange={(e) => setAnswers({ ...answers, [it]: e.target.value })}
									onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && typed) fill.mutate(true); }} />
							</label>
						))}
					</div>
					<div className="row wrap" style={{ gap: 8 }}>
						<button className="btn primary sm" disabled={!typed || fill.isPending} onClick={() => fill.mutate(true)}>
							<MdAutoAwesome /> {fill.isPending ? 'Rewriting…' : `Add and rewrite${typed && typed < items.length ? ` (${typed} of ${items.length})` : ''}`}
						</button>
						<button className="btn ghost sm" disabled={!typed || fill.isPending} onClick={() => fill.mutate(false)} title="Put the answers in exactly as typed, without rewriting">Insert as typed</button>
						<span className="xs faint">You can answer some now and the rest later. Ctrl+Enter also submits.</span>
					</div>
				</div>
			)}
			<div
				ref={ref}
				className={`draft-body ${editable ? '' : 'readonly'}`}
				contentEditable={editable}
				suppressContentEditableWarning
				onInput={onInput}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				aria-label="Reply text"
				role="textbox"
				aria-multiline="true"
			/>
			{footerQ.data?.footer && (
				<div className="draft-footer" title="Added automatically when the reply is sent">
					<div dangerouslySetInnerHTML={{ __html: footerQ.data.footer.html.replace('cid:gitapress-logo', `${BASE}/brand/gitapress-logo.png`) }} />
					<div className="xs faint mt-8">Added when sent. Address: {footerQ.data.footer.branch.city === 'Gorakhpur' ? 'head office' : `${footerQ.data.footer.branch.city} branch`}, because {footerQ.data.footer.why}. Branch addresses are in Settings → Reply drafts.</div>
				</div>
			)}
			{(files.length > 0 || editable) && (
				<div className="draft-files">
					{files.map((f) => (
						<span key={f.id} className="file">
							<MdAttachFile />
							<button type="button" className="name" title={`Open ${f.filename}`} onClick={() => openFile(f.id, f.filename).catch((e) => toast(e.message, 'error'))}>{f.filename}</button>
							<span className="faint">{fmtSize(f.size)}</span>
							{editable && <button type="button" className="btn ghost icon sm" aria-label={`Remove ${f.filename}`} onClick={() => removeFile(f.id)}><MdClose /></button>}
						</span>
					))}
					{editable && (
						<>
							<label className="btn ghost sm" style={{ cursor: 'pointer' }}>
								<MdAttachFile /> {uploading ? 'Attaching…' : 'Attach files'}
								<input type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
							</label>
							{(savedQ.data?.attachments || []).filter((s: any) => !files.some((f) => f.id === s.id)).length > 0 && (
								<select className="input sm" value="" aria-label="Attach a saved file" onChange={(e) => e.target.value && addSaved(Number(e.target.value))}>
									<option value="">Attach a saved file…</option>
									{(savedQ.data?.attachments || []).filter((s: any) => !files.some((f) => f.id === s.id)).map((s: any) => (
										<option key={s.id} value={s.id}>{s.name} ({fmtSize(s.size)})</option>
									))}
								</select>
							)}
						</>
					)}
				</div>
			)}
			{quote && (
				<div className="draft-quote">
					{editable && <Switch checked={quoteOn} onChange={(v) => { setQuoteOn(v); setDirty(true); }} label="Include the reader's email below the reply" />}
					{(quoteOn || !editable) && (
						<>
							<div className="xs faint mt-8">{quote.head}</div>
							<div className="q-body">{quote.body}{quote.truncated ? '\n…' : ''}</div>
							{quote.forwardedBy && (
								<div className="xs faint mt-4">
									Forwarded in by {quote.forwardedBy}{quote.forwardedTo ? ` to ${quote.forwardedTo}` : ''}. Only the reader's own email is quoted; the forward and any note on it stay internal.
								</div>
							)}
						</>
					)}
				</div>
			)}
			{draft.last_error && !sent && <div className="notice error small mt-8"><MdInfoOutline /><span>Last send failed: {draft.last_error}</span></div>}
			<div className="row wrap mt-8" style={{ gap: 8 }}>
				{sent ? (
					<span className="badge green">Sent {ago(draft.sent_at)}{draft.sent_by_name ? ` by ${draft.sent_by_name}` : ''} from {draft.send_from}</span>
				) : editable ? (
					<>
						<button className="btn primary" disabled={open > 0 || send.isPending || !canSend || uploading > 0 || !to.trim()} title={open > 0 ? 'Fill in the highlighted items first' : !draft.sendEnabled ? 'Sending through Gmail is switched off' : !senderId ? 'Choose the mailbox to send from' : 'Send through Gmail'} onClick={() => send.mutate()}>
							<MdSend /> {send.isPending ? 'Sending…' : 'Send'}
						</button>
						<button className="btn" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><MdSave /> Save draft</button>
						<button className="btn ghost" disabled={regen.isPending} onClick={() => (!draft.edited && !dirty) || confirm('Replace your edits with a newly written draft?') ? regen.mutate() : null}><MdRefresh /> {regen.isPending ? 'Writing…' : 'Rewrite'}</button>
						<button className="btn ghost" onClick={() => { navigator.clipboard.writeText(payload().body); toast('Copied'); }}><MdContentCopy /> Copy</button>
						<button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => dismiss.mutate()}><MdClose /> No reply needed</button>
					</>
				) : <span className="small faint">Viewers can read drafts but not send them.</span>}
			</div>
			<div className="xs faint mt-8">
				Drafted {ago(draft.generated_at)}{draft.model ? ` by ${draft.model}` : ''}{draft.edited ? ` · edited${draft.updated_by_name ? ` by ${draft.updated_by_name}` : ''}` : ''}. Nothing is sent until you press Send; it then goes through Gmail from the mailbox shown in From.
			</div>
		</div>
	);
}
