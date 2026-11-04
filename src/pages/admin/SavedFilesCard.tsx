import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MdAttachFile, MdDeleteOutline, MdUpload } from 'react-icons/md';
import { api, BASE, getToken } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui';
import { COLORS } from '../../lib/format';

const MAX_FILE_MB = 10;
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Settings → Saved files: files the team attaches to replies often, such as the bank details for payment. */
export default function SavedFilesCard() {
	const toast = useToast();
	const qc = useQueryClient();
	const list = useQuery({ queryKey: ['saved-attachments'], queryFn: () => api('/attachments/saved') });
	const [name, setName] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const rows: any[] = list.data?.attachments || [];

	const save = async () => {
		if (!file) return;
		if (file.size > MAX_FILE_MB * 1024 * 1024) return toast(`${file.name} is larger than ${MAX_FILE_MB} MB`, 'error');
		setBusy(true);
		try {
			const base64 = await new Promise<string>((resolve, reject) => {
				const r = new FileReader();
				r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
				r.onerror = () => reject(new Error(`Could not read ${file.name}`));
				r.readAsDataURL(file);
			});
			await api('/attachments/saved', { body: { name: name.trim(), filename: file.name, contentType: file.type, base64 } });
			qc.invalidateQueries({ queryKey: ['saved-attachments'] });
			toast('File saved');
			setName('');
			setFile(null);
			if (input.current) input.current.value = '';
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			setBusy(false);
		}
	};
	const remove = async (r: any) => {
		if (!confirm(`Remove ${r.name} from the saved files? Replies that already carry it keep it.`)) return;
		try {
			await api(`/attachments/saved/${r.id}`, { method: 'DELETE' });
			qc.invalidateQueries({ queryKey: ['saved-attachments'] });
			toast('File removed');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	};
	const open = async (r: any) => {
		const res = await fetch(`${BASE}/api/attachments/${r.id}/file`, { headers: { authorization: `Bearer ${getToken()}` } });
		if (!res.ok) return toast('The file could not be opened', 'error');
		const url = URL.createObjectURL(await res.blob());
		window.open(url, '_blank', 'noopener');
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	};

	return (
		<Card title="Saved files" accent={COLORS.teal} sub="Files the team often sends with replies, such as the bank details for payment or a catalogue. Anyone answering email can attach them with one click.">
			<div className="col gap-16">
				{rows.length === 0 ? (
					<div className="small faint">No saved files yet.</div>
				) : (
					<div className="col gap-8">
						{rows.map((r) => (
							<div key={r.id} className="row-between">
								<button type="button" className="btn ghost sm" style={{ justifyContent: 'flex-start', minWidth: 0 }} onClick={() => open(r)} title={`Open ${r.filename}`}>
									<MdAttachFile /> <span className="ellipsis"><b>{r.name}</b> <span className="faint">{r.filename} · {fmtSize(r.size)}</span></span>
								</button>
								<button type="button" className="btn ghost icon sm" aria-label={`Remove ${r.name}`} onClick={() => remove(r)}><MdDeleteOutline /></button>
							</div>
						))}
					</div>
				)}
				<div className="grid g-2">
					<div className="field"><label>Name shown to the team</label><input className="input" value={name} placeholder="For example: Bank details for payment" onChange={(e) => setName(e.target.value)} /></div>
					<div className="field"><label>File (up to {MAX_FILE_MB} MB)</label><input ref={input} className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
				</div>
				<div><button type="button" className="btn primary" disabled={!file || busy} onClick={save}><MdUpload /> {busy ? 'Saving…' : 'Save file'}</button></div>
			</div>
		</Card>
	);
}
