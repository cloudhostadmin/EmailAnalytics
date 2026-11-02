import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
	// BASE_PATH (in .env) serves the app from a sub-folder, e.g. /emailanalytics/ on gitapress.in. Empty = domain root.
	const sub = (loadEnv(mode, process.cwd(), '').BASE_PATH || '').replace(/^\/+|\/+$/g, '');
	const base = sub ? `/${sub}/` : '/';
	return {
		base,
		plugins: [react()],
		server: {
			port: 5173,
			proxy: { [`${base}api`]: { target: 'http://localhost:8888', rewrite: (p: string) => p.slice(base.length - 1) } },
		},
		build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1500 },
	};
});
