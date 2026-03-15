import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '@ccui/shared';
import { User, Bot, AlertCircle } from 'lucide-react';

interface Props {
  message: ChatMessageType;
  streaming?: boolean;
}

export default function ChatMessage({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div data-msg-id={message.id} className="flex justify-center">
        <div className="flex items-center gap-2 text-xs text-cc-text-muted bg-cc-bg rounded-lg px-3 py-1.5">
          <AlertCircle size={12} />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div data-msg-id={message.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-cc-accent' : 'bg-cc-purple-text'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[75%] rounded-lg px-4 py-2 ${
        isUser ? 'bg-cc-accent-muted border border-cc-blue-border' : 'bg-cc-bg-surface border border-cc-border'
      }`}>
        <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-cc-bg [&_pre]:rounded [&_pre]:p-3 [&_code]:text-cc-blue-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-cc-text-secondary animate-pulse ml-0.5" />
        )}
        <div className="mt-1 text-xs text-cc-text-muted">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
