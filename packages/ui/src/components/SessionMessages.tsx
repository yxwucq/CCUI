import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import type { Session, ChatMessage as ChatMessageType } from '@ccui/shared';

interface Props {
  session: Session;
  messages: ChatMessageType[];
}

export default function SessionMessages({ session, messages: sessionMessages }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-cc-border">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {sessionMessages.length === 0 && (
          <div className="text-center text-cc-text-muted text-sm py-8">
            No messages yet. Interact via the terminal — history will appear here.
          </div>
        )}
        {sessionMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
