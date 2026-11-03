/**
 * Re-analyse conversations that are already in Gita Mail (Settings → Re-analyse emails).
 * Conversations are only queued here; the worker then runs them through the AI again, newest first,
 * a few hundred an hour. Reply drafts that someone has edited or sent are kept (see upsertDraft).
 */
import { one } from './db';

export interface ReanalyseScope {
	/** YYYY-MM-DD: conversations with at least one email on or after this day */
	from?: string | null;
	/** YYYY-MM-DD: conversations with at least one email on or before this day */
	to?: string | null;
	/** only conversations the rules engine handled, not yet analysed by the AI */
	onlyRulesEngine?: boolean;
}

// a real calendar day in YYYY-MM-DD form, otherwise ignored
const day = (v?: string | null) => {
	if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
	const d = new Date(`${v}T00:00:00Z`);
	return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
};

function filter(orgId: number, s: ReanalyseScope) {
	const params: unknown[] = [orgId];
	const conds = ['c.org_id = $1', 'c.message_count > 0'];
	const from = day(s.from);
	const to = day(s.to);
	if (from || to) {
		const inPeriod = ['e.conversation_id = c.id'];
		if (from) {
			params.push(from);
			inPeriod.push(`e.sent_at >= $${params.length}::date`);
		}
		if (to) {
			params.push(to);
			inPeriod.push(`e.sent_at < $${params.length}::date + 1`);
		}
		conds.push(`exists (select 1 from emails e where ${inPeriod.join(' and ')})`);
	}
	if (s.onlyRulesEngine)
		conds.push(`(c.analysed_at is null or c.analysis_model like 'remail-heuristic%' or c.analysis_model like '%(fallback)%')`);
	return { where: conds.join(' and '), params };
}

/** How many conversations a re-analysis would cover, and roughly what it would use. */
export async function reanalysePreview(orgId: number, s: ReanalyseScope) {
	const { where, params } = filter(orgId, s);
	// conversations already waiting are analysed anyway, so the estimate counts only the newly queued ones
	const c = await one<any>(
		`select count(*)::int total,
		        count(*) filter (where c.needs_analysis)::int queued,
		        count(*) filter (where not c.needs_analysis and c.is_automated)::int automated
		   from conversations c where ${where}`,
		params,
	);
	// average size of recent AI analyses, to estimate the tokens this would use
	const avg = await one<any>(
		`select count(*)::int n, coalesce(avg(input_tokens), 0)::int input, coalesce(avg(output_tokens), 0)::int output
		   from ai_usage where org_id = $1 and purpose = 'analysis' and created_at > now() - interval '30 days'`,
		[orgId],
	);
	const total = c?.total || 0;
	const queued = c?.queued || 0;
	const automated = c?.automated || 0;
	const toQueue = total - queued;
	// automated notifications never go to the AI: the rules engine sorts them at no cost
	const aiCalls = Math.max(0, toQueue - automated);
	return {
		conversations: total,
		alreadyQueued: queued,
		toQueue,
		automated,
		aiCalls,
		sampleSize: avg?.n || 0,
		estInputTokens: avg?.n ? aiCalls * avg.input : null,
		estOutputTokens: avg?.n ? aiCalls * avg.output : null,
	};
}

/** Queue the conversations for the worker; returns how many were newly queued. */
export async function queueReanalysis(orgId: number, s: ReanalyseScope) {
	const { where, params } = filter(orgId, s);
	const r = await one<{ n: number }>(
		`with u as (update conversations c set needs_analysis = true where ${where} and not c.needs_analysis returning 1)
		 select count(*)::int n from u`,
		params,
	);
	return r?.n || 0;
}
