import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

// Landing page: a single prompt box that starts a new chat, passing the first
// message along so the chat auto-sends it once connected.
export default function Home() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  const start = () => {
    const text = prompt.trim();
    const sessionId = crypto.randomUUID();
    navigate(`/chat/${sessionId}`, { state: text ? { initialQuery: text } : undefined });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      start();
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">What can I help you with?</h1>
      <textarea
        className="input w-full resize-none"
        rows={3}
        placeholder="Ask me anything…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className="btn-primary" onClick={start}>
        Start chatting
      </button>
    </div>
  );
}
