import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdOpenInNew } from 'react-icons/md';
import { api, qs } from '../api/client';
import { useFilters } from '../contexts/FilterContext';
import DraftEditor, { countPlaceholders } from '../components/DraftEditor';
import { Card, Empty, Loader, PageHead, RagDot, Segmented } from '../components/ui';
import { COLORS, ago, bizLabel } from '../lib/format';

export default function Drafts() {
	const { params } = useFilters();
	const [status, setStatus] = useState<'draft' | 'sent' | 'dismissed'>('draft');
	const { data, isLoading } = useQuery({
		queryKey: ['drafts', params.view, params.mailbox, status],
		queryFn: () => api(`/drafts${qs({ view: params.view, mailbox: params.mailbox, status })}`),
		refetchInterval: 60_000,
	});
	const rows: any[] = data?.rows || [];
	const [sel, setSel] = useState<number | null>(null);
	useEffect(() => {
		if (!rows.length) setSel(null);
		else if (!rows.some((r) => r.id === sel)) setSel(rows[0].id);
	}, [rows, sel]);
	const cur = rows.find((r) => r.id === sel);

	return (
		<>
			<PageHead kw="Replies" rest="to send"
				sub="A complete reply is drafted for every email waiting on an answer. Fill in the yellow items, check it, and press Send: it goes from Gmail, in the same thread." />
			<div className="row mb-16">
				<Segmented value={status} onChange={setStatus} options={[{ v: 'draft', l: `To send${data?.counts?.draft ? ` (${data.counts.draft})` : ''}` }, { v: 'sent', l: 'Sent' }, { v: 'dismissed', l: 'Dismissed' }]} />
				{data?.counts?.sent_week > 0 && <span className="small muted">{data.counts.sent_week} sent in the last 7 days</span>}
			</div>
			{isLoading ? <Loader /> : !rows.length ? (
				<Card><Empty text={status === 'draft' ? 'Nothing waiting. New drafts appear here as soon as an email needs a reply.' : 'Nothing here yet.'} /></Card>
			) : (
				<div className="drafts-layout">
					<Card flush className="drafts-list">
						{rows.map((r) => {
							const n = countPlaceholders(r.body);
							return (
								<button key={r.id} className={`draft-item ${r.id === sel ? 'on' : ''}`} onClick={() => setSel(r.id)}>
									<div className="row" style={{ gap: 8 }}>
										<RagDot rag={r.rag} />
										<b className="truncate grow">{r.customer_name || r.to_addresses?.[0]}</b>
										<span className="xs faint">{ago(status === 'sent' ? r.sent_at : r.last_inbound_at)}</span>
									</div>
									<div className="small truncate">{r.conv_subject}</div>
									<div className="row xs" style={{ gap: 6, marginTop: 4 }}>
										<span className="chip">{bizLabel(r.business_category)}</span>
										{status === 'draft' && (n > 0 ? <span className="badge amber">{n} to fill in</span> : <span className="badge green">Ready to send</span>)}
									</div>
								</button>
							);
						})}
					</Card>
					{cur && (
						<Card title={cur.conv_subject} accent={COLORS.pink}
							sub={<span>{cur.customer_name || cur.to_addresses?.[0]} · waiting {ago(cur.last_inbound_at)}</span>}
							actions={<Link className="btn sm ghost" to={`/conversations/${cur.conversation_id}`}><MdOpenInNew /> Open thread</Link>}>
							<DraftEditor key={cur.id} draft={cur} />
						</Card>
					)}
				</div>
			)}
		</>
	);
}
