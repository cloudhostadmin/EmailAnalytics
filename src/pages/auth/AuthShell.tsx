import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { BASE } from '../../api/client';

export default function AuthShell({ children }: { children: ReactNode }) {
	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => { document.body.style.overflow = prev; };
	}, []);
	return (
		<div className="auth">
			<div className="auth-hero" aria-hidden="true">
				<div className="hero-quote">सत्यं वद · धर्मं चर</div>
				<div className="hero-sub">Gita Press, Gorakhpur. Serving humanity for truth and peace since 1923.</div>
			</div>
			<div className="auth-side">
				<div className="auth-card">
					<div className="auth-brand">
						<img className="logo" src={`${BASE}/brand/gitapress-logo.png`} alt="Gita Press" />
						<div className="name"><span>Gita</span> Mail</div>
						<div className="tag">Email intelligence for readers, orders, Kalyan and every conversation</div>
					</div>
					{children}
					<div className="auth-foot">Powered by <img src={`${BASE}/ravity-logo.svg`} alt="Ravity" /></div>
				</div>
			</div>
		</div>
	);
}
