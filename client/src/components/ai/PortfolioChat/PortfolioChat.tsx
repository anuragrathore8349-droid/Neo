import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Loader2, X, Minimize2, Maximize2 } from 'lucide-react';
import aiService from '../../../services/ai.service';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
}

interface PortfolioChatProps {
  className?: string;
}

const PortfolioChat: React.FC<PortfolioChatProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const welcomeMessage: Message = {
    role: 'assistant',
    text: "Hi! I'm Neo, your AI portfolio advisor. I have real-time access to your holdings and market data. Ask me anything about your portfolio — performance, risk, rebalancing ideas, or market context.",
    timestamp: new Date().toISOString(),
    source: 'system',
  };
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [portfolioContext, setPortfolioContext] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history for multi-turn context (last 10 turns)
      const history = messages
        .filter(m => m.source !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role, text: m.text }));

      const result = await aiService.portfolioChat(trimmed, history);

      setPortfolioContext(result.portfolioContext);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: result.reply,
          timestamp: result.timestamp,
          source: result.source,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Sorry, I couldn't process that request. ${err?.message || 'Please try again.'}`,
          timestamp: new Date().toISOString(),
          source: 'error',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const resetChat = () => {
    setMessages([{ ...welcomeMessage, timestamp: new Date().toISOString() }]);
    setPortfolioContext(null);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    'How is my portfolio performing?',
    'Which assets are dragging returns?',
    'Am I too concentrated in crypto?',
    'Should I rebalance now?',
  ];

  // ─── Floating button when closed ──────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 
          bg-[#3D5AF1] hover:bg-[#2d4ae0] text-white rounded-full shadow-lg 
          transition-all duration-200 hover:scale-105 ${className}`}
      >
        <Bot size={20} />
        <span className="font-medium text-sm">Portfolio Chat</span>
      </button>
    );
  }

  // ─── Chat panel ───────────────────────────────────────────────────────────
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col 
        bg-[#12131A] border border-[#3D5AF1]/30 rounded-2xl shadow-2xl
        transition-all duration-200
        ${isMinimized ? 'h-14 w-80' : 'w-96 h-[560px]'}
        ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3D5AF1]/20 rounded-t-2xl bg-[#1A1B23]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#3D5AF1]/20 flex items-center justify-center">
            <Bot size={16} className="text-[#3D5AF1]" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Portfolio Chat</p>
            {portfolioContext && (
              <p className="text-[#3D5AF1] text-xs mt-0.5">
                ${portfolioContext.totalValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {portfolioContext.assetCount} assets
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetChat}
            className="px-2 py-1 text-xs text-[#C7D2FE] bg-[#2C3CE6]/10 hover:bg-[#2C3CE6]/15 rounded-lg transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setIsMinimized(v => !v)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3D5AF1]/30">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#3D5AF1]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={14} className="text-[#3D5AF1]" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-[#3D5AF1] text-white rounded-tr-sm'
                      : 'bg-[#1A1B23] text-gray-200 border border-[#3D5AF1]/10 rounded-tl-sm'
                    }`}
                >
                  {msg.text}
                  {msg.source && msg.source !== 'system' && msg.source !== 'error' && msg.role === 'assistant' && (
                    <span className={`block text-[10px] mt-1.5 opacity-50 ${msg.role === 'user' ? 'text-white' : 'text-gray-500'}`}>
                      {msg.source === 'gemini_2.5_flash' ? '✦ Gemini 2.5 Flash' : '⚡ Neo Reasoning Engine'}
                    </span>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-[#3D5AF1]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-[#3D5AF1]" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-[#3D5AF1]/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-[#3D5AF1]" />
                </div>
                <div className="bg-[#1A1B23] border border-[#3D5AF1]/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 size={16} className="text-[#3D5AF1] animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions — keep available throughout the chat */}
          <div className="px-4 pb-2">
            <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500 mb-2">Suggested questions</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-xs px-2.5 py-1 bg-[#3D5AF1]/10 hover:bg-[#3D5AF1]/20 
                    text-[#3D5AF1] border border-[#3D5AF1]/20 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-[#3D5AF1]/10">
            <div className="flex items-end gap-2 bg-[#1A1B23] rounded-xl border border-[#3D5AF1]/20 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your portfolio..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 
                  resize-none outline-none max-h-28 overflow-y-auto leading-relaxed"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="p-1.5 bg-[#3D5AF1] hover:bg-[#2d4ae0] disabled:opacity-40 
                  disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
              Not financial advice — AI can make mistakes
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default PortfolioChat;
