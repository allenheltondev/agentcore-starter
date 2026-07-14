import type { ReactNode } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { RequireAuth, useAuth } from '@readysetcloud/ui/auth';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';

function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="font-semibold text-foreground">
          AgentCore Chatbot
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {user.email && <span>{user.email}</span>}
          <button className="btn-secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth fallback={<Navigate to="/signin" replace />}>
    <Shell>{children}</Shell>
  </RequireAuth>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/chat/:sessionId?" element={<Protected><ChatPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
