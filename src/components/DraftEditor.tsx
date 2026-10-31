/**
 * Edits an AI-drafted reply. Facts the AI could not know appear as yellow [[provide: …]] placeholders;
 * click one and type over it. Nothing is sent until Send is pressed, and Send stays disabled while any
 * yellow item remains. Sending goes through Gmail as a reply in the same thread.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MdSend, MdSave, MdRefresh, MdClose, MdContentCopy, MdArrowForward, MdInfoOutline } from 'react-icons/md';
import { api } from '../api/client';
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

export const countPlaceholders = (body: string) => (body.match(PH) || []).length;

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
	const sent = draft.status === 'sent';
	const editable = can('analyst') && !sent;

	// load a different draft (or a regenerated one) into the editor
	useEffect(() => {
		setBody(draft.body);
		setTo((draft.to_addresses || []).join(', '));
		setCc((draft.cc_addresses || []).join(', '));
		setSubject(draft.subject || '');
		setDirty(false);
		if (ref.current) ref.current.innerHTML = toHtml(draft.body);
	}, [draft.id, draft.body, draft.updated_at]);

	const open = useMemo(() => countPlaceholders(body), [body]);
	const refresh = () => { qc.invalidateQueries({ queryKey: ['drafts'] }); qc.invalidateQueries({ queryKey: ['draft'] }); qc.invalidateQueries({ queryKey: ['conversation'] }); qc.invalidateQueries({ queryKey: ['nav-drafts'] }); };
	const payload = () => ({ body: ref.current ? fromDom(ref.current) : body, to, cc, subject });

	const save = useMutation({ mutationFn: () => api(`/drafts/${draft.id}`, { method: 'PUT', body: payload() }), onSuccess: () => { setDirty(false); refresh(); toast('Draft saved'); }, onError: (e: any) => toast(e.message, 'error') });
	const send = useMutation({
		mutationFn: () => api(`/drafts/${draft.id}/send`, { body: payload() }),
		onSuccess: (r) => { refresh(); toast(`Sent from ${r.from}`); onDone?.(); },
		onError: (e: any) => { refresh(); toast(e.message, 'error'); },
	});
	const regen = useMutation({ mutationFn: () => api(`/drafts/${draft.id}/regenerate`, { body: {} }), onSuccess: () => { refresh(); toast('A new draft was written'); }, onError: (e: any) => toast(e.message, 'error') });
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
				<label>From</label><div className="mono small">{draft.send_from || <span className="faint">No connected Gmail mailbox received this email</span>}</div>
				<label htmlFor={`to-${draft.id}`}>To</label><input id={`to-${draft.id}`} className="input" value={to} disabled={!editable} onChange={(e) => { setTo(e.target.value); setDirty(true); }} />
				<label htmlFor={`cc-${draft.id}`}>Cc</label><input id={`cc-${draft.id}`} className="input" value={cc} disabled={!editable} placeholder="Optional" onChange={(e) => { setCc(e.target.value); setDirty(true); }} />
				<label htmlFor={`su-${draft.id}`}>Subject</label><input id={`su-${draft.id}`} className="input" value={subject} disabled={!editable} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} />
			</div>
			{open > 0 && editable && (
				<div className="notice warn small mt-8">
					<MdInfoOutline />
					<span><b>{open} item{open > 1 ? 's' : ''} to fill in.</b> The highlighted text is information the AI does not have. Click it and type the answer.</span>
					<button className="btn sm" style={{ marginLeft: 'auto' }} onClick={nextPlaceholder}>Next <MdArrowForward /></button>
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
			{draft.last_error && !sent && <div className="notice error small mt-8"><MdInfoOutline /><span>Last send failed: {draft.last_error}</span></div>}
			<div className="row wrap mt-8" style={{ gap: 8 }}>
				{sent ? (
					<span className="badge green">Sent {ago(draft.sent_at)}{draft.sent_by_name ? ` by ${draft.sent_by_name}` : ''} from {draft.send_from}</span>
				) : editable ? (
					<>
						<button className="btn primary" disabled={open > 0 || send.isPending || !draft.canSend || !to.trim()} title={open > 0 ? 'Fill in the highlighted items first' : !draft.canSend ? 'This email did not arrive in a connected Gmail mailbox' : 'Send through Gmail'} onClick={() => send.mutate()}>
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
				Drafted {ago(draft.generated_at)}{draft.model ? ` by ${draft.model}` : ''}{draft.edited ? ` · edited${draft.updated_by_name ? ` by ${draft.updated_by_name}` : ''}` : ''}. Nothing is sent until you press Send; it then goes from Gmail as a reply in the same thread.
			</div>
		</div>
	);
}
