import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MdReplay } from 'react-icons/md';
import { api, qs } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { Card, Segmented, Switch } from '../../components/ui';
import { COLORS } from '../../lib/format';

const isoDay = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const daysAgo = (days: number) => {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return isoDay(d);
};
const fmt = (v: number) => v.toLocaleString('en-IN');

/** Settings → Re-analyse emails: run the AI again on all conversations, or those with an email in a period. */
export default function ReanalyseCard({ provider }: { provider?: string }) {
	const toast = useToast();
	const qc = useQueryClient();
	const [mode, setMode] = useState<'period' | 'all'>('period');
	const [from, setFrom] = useState(daysAgo(30));
	const [to, setTo] = useState(isoDay(new Date()));
	const [onlyRules, setOnlyRules] = useState(false);
	// the AI in use, from the system status when the page does not pass it
	const sys = useQuery({ queryKey: ['system-status'], queryFn: () => api('/system/status'), enabled: !provider, staleTime: 30_000 });
	provider = provider ?? sys.data?.ai?.provider;

	const ai = provider === 'anthropic' ? 'Claude' : provider === 'gemini' ? 'Gemini' : 'the AI';
	const noAi = provider === 'heuristic';
	const badRange = mode === 'period' && (!from || !to || from > to);
	const scope = {
		from: mode === 'period' ? from : undefined,
		to: mode === 'period' ? to : undefined,
		onlyRulesEngine: onlyRules || undefined,
	};

	const preview = useQuery({
		queryKey: ['reanalyse-preview', scope],
		queryFn: () => api(`/system/reanalyse${qs(scope)}`),
		enabled: !badRange,
	});
	const run = useMutation({
		mutationFn: () => api('/system/reanalyse', { body: scope }),
		onSuccess: (r: any) => {
			qc.invalidateQueries({ queryKey: ['system-status'] });
			qc.invalidateQueries({ queryKey: ['reanalyse-preview'] });
			toast(r.queued ? `${fmt(r.queued)} conversations queued for re-analysis` : 'These conversations are already waiting for analysis');
		},
		onError: (e: any) => toast(e.message, 'error'),
	});

	const p: any = preview.data;
	const start = () => {
		if (!p?.toQueue) return;
		const calls = p.aiCalls ? ` This uses about ${fmt(p.aiCalls)} ${ai} calls.` : '';
		if (confirm(`Re-analyse ${fmt(p.toQueue)} conversations?${calls}`)) run.mutate();
	};

	let summary: ReactNode;
	if (noAi) summary = <div className="faint">Add an AI key first: without one, emails are sorted by the built-in rules.</div>;
	else if (badRange) summary = <div className="faint">Choose a start date on or before the end date.</div>;
	else if (!p) summary = <div className="faint">Counting conversations…</div>;
	else if (!p.conversations) summary = <div className="faint">No conversations in this selection.</div>;
	else
		summary = (
			<>
				<div>
					<b>{fmt(p.toQueue)}</b> conversations will be re-analysed
					{p.alreadyQueued ? `, and ${fmt(p.alreadyQueued)} more in this selection are already waiting` : ''}.
				</div>
				{p.toQueue > 0 && (
					<div className="muted">
						{fmt(p.aiCalls)} go to {ai}
						{p.automated ? `; ${fmt(p.automated)} automated emails are sorted by the rules engine at no cost` : ''}.
					</div>
				)}
				{p.toQueue > 0 && p.estInputTokens != null && (
					<div className="muted">
						Estimated use: about {fmt(p.estInputTokens)} input and {fmt(p.estOutputTokens)} output tokens, from the average of the last {fmt(p.sampleSize)} analyses.
					</div>
				)}
				<div className="faint">{ai} works through a few hundred an hour. The analysis queue under System status shows what is left.</div>
			</>
		);

	return (
		<Card
			title="Re-analyse emails"
			accent={COLORS.purple}
			sub={`Runs ${ai} again on conversations already in Gita Mail, for example after you update the reference information or reply templates. Replies someone has edited or sent are kept.`}
		>
			<div className="col gap-16">
				<Segmented value={mode} onChange={setMode} options={[{ v: 'period', l: 'Emails in a period' }, { v: 'all', l: 'All emails' }]} />
				{mode === 'period' && (
					<div className="col gap-12">
						<div className="grid g-2">
							<div className="field"><label>From</label><input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></div>
							<div className="field"><label>To</label><input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
						</div>
						<div className="row wrap">
							{[1, 7, 30, 90].map((d) => (
								<button key={d} type="button" className="btn ghost sm" onClick={() => { setFrom(daysAgo(d)); setTo(isoDay(new Date())); }}>{d === 1 ? 'Since yesterday' : `Last ${d} days`}</button>
							))}
						</div>
					</div>
				)}
				<Switch checked={onlyRules} onChange={setOnlyRules} label={`Only conversations the rules engine handled, not yet analysed by ${ai}`} />
				<div className="col small">{summary}</div>
				<div>
					<button className="btn primary" type="button" disabled={!provider || noAi || badRange || !p?.toQueue || run.isPending} onClick={start}>
						<MdReplay /> {run.isPending ? 'Queuing…' : p?.toQueue ? `Re-analyse ${fmt(p.toQueue)} conversations` : 'Re-analyse'}
					</button>
				</div>
			</div>
		</Card>
	);
}
