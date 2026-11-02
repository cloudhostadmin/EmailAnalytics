/**
 * Production server for self-hosting (Windows Server behind IIS, or any Linux box / container).
 * One Node process does what Netlify did:
 *   - serves the built app from dist/ (single-page app fallback to index.html)
 *   - serves the REST API under /api
 *   - runs the background worker every 5 minutes (mailbox sync, AI analysis, alerts, reports, digests)
 *
 * Start:   npm run build:web   then   npm start
 *          (npm start = node --env-file=.env --import tsx scripts/serve.ts)
 *
 * The app can live in a sub-folder: BASE_PATH=/emailanalytics/ in .env. Requests may arrive with the
 * prefix (proxy passes the full path) or without it (IIS sub-application strips it); both work.
 * Listens on 127.0.0.1 only by default, so it is reachable through IIS and not directly from outside.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../server/api';
import { runTick } from '../server/worker';

// "Sync now" runs in the background in this process (kickWorker in server/api.ts) and the request returns at
// once, so IIS/ARR can keep its default proxy time-out and no server-wide setting has to change.
process.env.SELF_HOSTED = 'true';

const port = Number(process.env.PORT || 8888);
const host = process.env.HOST || '127.0.0.1';
const sub = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const prefix = sub ? `/${sub}` : '';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MAX_BODY = 30 * 1024 * 1024;

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
};

// Same headers netlify.toml set. HSTS is left to the IIS site so it never spreads to other sites on the domain.
const SECURITY: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function stripPrefix(p: string): string {
	if (prefix && (p === prefix || p.startsWith(`${prefix}/`))) return p.slice(prefix.length) || '/';
	return p;
}

async function sendFile(res: http.ServerResponse, file: string, size: number, head: boolean, cache: string) {
	res.writeHead(200, {
		...SECURITY,
		'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
		'Content-Length': size,
		'Cache-Control': cache,
	});
	if (head) return res.end();
	createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

async function serveStatic(pathname: string, req: http.IncomingMessage, res: http.ServerResponse) {
	let rel: string;
	try {
		rel = decodeURIComponent(pathname);
	} catch {
		res.writeHead(400, SECURITY).end('Bad request');
		return;
	}
	const head = req.method === 'HEAD';
	const file = path.join(dist, rel);
	if (file.startsWith(dist + path.sep) && rel !== '/') {
		const s = await stat(file).catch(() => null);
		if (s?.isFile()) {
			const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
			return sendFile(res, file, s.size, head, cache);
		}
		// a missing file (has an extension) is a real 404; anything else is an app route
		if (path.extname(rel)) {
			res.writeHead(404, { ...SECURITY, 'Content-Type': 'text/plain' }).end('Not found');
			return;
		}
	}
	const index = path.join(dist, 'index.html');
	const s = await stat(index).catch(() => null);
	if (!s) {
		res.writeHead(503, { ...SECURITY, 'Content-Type': 'text/plain' }).end('App not built yet: run "npm run build:web" and restart.');
		return;
	}
	return sendFile(res, index, s.size, head, 'no-cache');
}

async function serveApi(pathname: string, search: string, req: http.IncomingMessage, res: http.ServerResponse) {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const c of req) {
		size += (c as Buffer).length;
		if (size > MAX_BODY) {
			res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Request too large' }));
			req.destroy();
			return;
		}
		chunks.push(c as Buffer);
	}
	const method = req.method || 'GET';
	const request = new Request(`http://localhost:${port}${pathname}${search}`, {
		method,
		headers: req.headers as any,
		body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks),
	});
	const response = await handle(request);
	res.writeHead(response.status, { ...SECURITY, ...Object.fromEntries((response.headers as any).entries()) });
	res.end(method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url || '/', 'http://localhost');
		const pathname = stripPrefix(url.pathname);
		if (pathname === '/api' || pathname.startsWith('/api/')) return await serveApi(pathname, url.search, req, res);
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			res.writeHead(405, SECURITY).end('Method not allowed');
			return;
		}
		await serveStatic(pathname, req, res);
	} catch (e: any) {
		console.error('[serve]', req.method, req.url, e?.message || e);
		if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Something went wrong. Please try again.' }));
	}
});

server.listen(port, host, () => {
	console.log(`[serve] Gita Mail on http://${host}:${port}${prefix || ''}/  (public URL: ${process.env.APP_URL || 'APP_URL not set'})`);
});

// ── Background worker: stands in for the Netlify scheduler + background function ──
if (process.env.WORKER_ENABLED !== 'false') {
	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		const started = Date.now();
		try {
			const log = await runTick({ budgetMs: 10 * 60_000 });
			console.log('[worker] done in', Date.now() - started, 'ms', JSON.stringify(log).slice(0, 1000));
		} catch (e: any) {
			console.error('[worker]', e?.message || e);
		} finally {
			running = false;
		}
	};
	setTimeout(tick, 30_000);
	setInterval(tick, 5 * 60_000);
}

const stop = () => {
	console.log('[serve] stopping');
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
