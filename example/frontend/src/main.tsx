import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@readysetcloud/ui/auth';
import { ToastProvider } from '@readysetcloud/ui';
import '@readysetcloud/ui/styles.css';
import '@readysetcloud/ui/fonts.css';
import './auth/config'; // side effect: configureAuth() before anything renders
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
