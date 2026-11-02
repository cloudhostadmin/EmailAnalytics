import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { BASE } from './api/client';
import { AuthProvider } from './contexts/AuthContext';
import { FilterProvider } from './contexts/FilterContext';
import { ToastProvider } from './contexts/ToastContext';
import App from './App';
import '@fontsource-variable/noto-sans';
import '@fontsource-variable/noto-sans-devanagari';
import './styles/global.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<BrowserRouter basename={BASE || '/'}>
				<ToastProvider>
					<AuthProvider>
						<FilterProvider>
							<App />
						</FilterProvider>
					</AuthProvider>
				</ToastProvider>
			</BrowserRouter>
		</QueryClientProvider>
	</React.StrictMode>,
);
