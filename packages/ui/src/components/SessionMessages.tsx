import { useRef, useEffect, useState } from 'react';
import { sendWsMessage } from '../hooks/useWebSocket';
import ChatMessage from './ChatMessage';
import { Send } from 'lucide-react';
import type { Session, ChatMessage as ChatMessageType } from '@ccui/shared';

interface Props {
  session: Session;
  isRunning: boolean;
  messages: ChatMessageType[];
  streaming: string;
  appendMessage: (sessionId: string, msg: ChatMessageType) => void;
  onClearDone: () => void;
}

export default function SessionMessages({ session, isRunning, messages: sessionMessages, streaming, appendMessage, onClearDone }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages, streaming]);

  const handleSend = () => {
    if (!input.trim()) return;
    onClearDone();
    appendMessage(session.id, {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });
    sendWsMessage({ type: 'chat:input', sessionId: session.id, content: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-950/50 min-h-0">
        {sessionMessages.length === 0 && !streaming && (
          <div className="text-center text-gray-600 text-sm py-8">
            {session.status !== 'terminated' ? 'Send a message to start.' : 'No messages.'}
          </div>
        )}
        {sessionMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {streaming && (
          <ChatMessage
            message={{
              id: 'streaming',
              sessionId: session.id,
              role: 'assistant',
              content: streaming,
              timestamp: new Date().toISOString(),
            }}
            streaming
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      {session.status !== 'terminated' && (
        <div className="border-t border-gray-800 p-3 bg-gray-900/30 shrink-0">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRunning ? 'Claude is working...' : 'Type a message... (Shift+Enter for newline)'}
              rows={1}
              disabled={isRunning}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 rounded-lg transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
