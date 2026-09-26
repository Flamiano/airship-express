'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
  X, 
  MoreVertical, 
  PanelRightClose, 
  FileText, 
  Lightbulb, 
  ListTree, 
  Plus, 
  SlidersHorizontal, 
  SendHorizontal, 
  ChevronDown,
  MessageSquare,
  ExternalLink,
  Settings,
  Image as ImageIcon,
  Link as LinkIcon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles } from 'lucide-react';

interface AiConversationSplitProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export function AiConversationSplit({ isOpen, onClose, initialQuery }: AiConversationSplitProps) {
  const { profile } = useAuth();
  const pathname = usePathname() || '';
  const userName = profile?.full_name?.split(' ')[0] || 'Cane';

  const pathSegment = pathname.split('/').pop() || '';
  let pageName = 'Dashboard';
  if (pathSegment && pathSegment !== 'workforce-management-dashboard') {
    pageName = pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1);
  }

  const [messages, setMessages] = useState<Message[]>(
    initialQuery
      ? [
          { id: '1', role: 'user', content: initialQuery },
          { id: '2', role: 'ai', content: 'I can certainly help with that. Looking into the records now...' },
        ]
      : []
  );
  
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now().toString(), role: 'user', content: input }]);
    setInput('');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'This is a mock response from the AI. The system is currently in prototype mode.',
        },
      ]);
    }, 1000);
  };

  const handleSuggestionClick = (text: string) => {
    setMessages([...messages, { id: Date.now().toString(), role: 'user', content: text }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'Here is some information regarding your request...',
        },
      ]);
    }, 1000);
  };

  return (
    <div 
      className={`flex-shrink-0 border-l border-line bg-paper flex flex-col h-full overflow-hidden transition-[width,transform,opacity] duration-300 ease-out shadow-xl text-ink font-sans ${
        isOpen ? 'w-[380px] lg:w-[420px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10'
      }`}
    >
      
      {/* Header */}
      <div className="flex items-center justify-end px-3 py-3 relative min-w-[380px]">
        <div className="flex items-center gap-1">
          <div className="relative" ref={historyRef}>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 rounded-full hover:bg-ink/5 dark:hover:bg-paper/10 transition-colors text-muted hover:text-ink"
            >
              <MoreVertical size={18} />
            </button>

            {/* History Dropdown Menu */}
            {showHistory && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-paper border border-line rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden pb-2">
                <div className="p-4 pb-2">
                  <span className="text-[13px] font-medium text-ink">Recent chats</span>
                </div>
                <div className="max-h-60 overflow-y-auto px-2 space-y-0.5">
                  {[
                    'Understanding Life Without Internal Monol...', 
                    'Refactoring React to FastAPI', 
                    'True Crime Editing Project Kickoff', 
                    'Dedicated Subtitling Software Alternatives',
                    'Apps for Live Animatic Storyboarding'
                  ].map((chat, idx) => (
                    <button key={idx} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink/10 transition-colors text-[13.5px] text-ink">
                      <MessageSquare size={16} className="text-muted shrink-0" />
                      <span className="truncate">{chat}</span>
                    </button>
                  ))}
                  <button className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-ink/10 transition-colors text-[13.5px] text-ink">
                    <div className="flex items-center gap-3">
                      <MoreVertical size={16} className="text-transparent shrink-0" />
                      <span>More</span>
                    </div>
                    <ChevronDown size={14} className="text-muted" />
                  </button>
                </div>
                <div className="border-t border-line mt-1 pt-1 px-2">
                  <button className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink/10 transition-colors text-[13.5px] text-muted cursor-not-allowed">
                    <ExternalLink size={16} className="shrink-0" />
                    Continue chat in new tab
                  </button>
                  <button className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-ink/10 transition-colors text-[13.5px] text-ink">
                    <div className="flex items-center gap-3">
                      <Settings size={16} className="text-muted shrink-0" />
                      <span>Settings & Help</span>
                    </div>
                    <ChevronDown size={14} className="text-muted" />
                  </button>
                </div>
              </div>
            )}
          </div>


          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-ink/5 dark:hover:bg-paper/10 transition-colors text-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col min-w-[380px]">
        {messages.length === 0 ? (
          /* Empty State Greeting */
          <div className="flex flex-col h-full">
            <div className="mt-8 mb-6">
              <h1 className="text-3xl font-medium tracking-tight text-accent">
                Hello, {userName}
              </h1>
              <h2 className="text-3xl font-medium tracking-tight text-ink/70 dark:text-paper/70 mt-1">
                How can I help you today?
              </h2>
            </div>
            
            <div className="space-y-2 mt-4">
              <button 
                onClick={() => handleSuggestionClick('Explain driver performance rating criteria')}
                className="w-full sm:w-auto text-left flex items-center gap-3 bg-ink/5 hover:bg-ink/10 transition-colors border border-transparent rounded-2xl px-4 py-3 text-sm text-ink font-medium"
              >
                <FileText size={16} className="text-accent" />
                Explain driver performance rating criteria
              </button>
              
              <button 
                onClick={() => handleSuggestionClick('Help me come up with new ideas')}
                className="w-full sm:w-auto text-left flex items-center gap-3 bg-ink/5 hover:bg-ink/10 transition-colors border border-transparent rounded-2xl px-4 py-3 text-sm text-ink font-medium"
              >
                <Lightbulb size={16} className="text-accent" />
                Help me come up with new ideas
              </button>
              
              <button 
                onClick={() => handleSuggestionClick('Get more perspectives on a topic')}
                className="w-full sm:w-auto text-left flex items-center gap-3 bg-ink/5 hover:bg-ink/10 transition-colors border border-transparent rounded-2xl px-4 py-3 text-sm text-ink font-medium"
              >
                <ListTree size={16} className="text-accent" />
                Get more perspectives on a topic
              </button>
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] px-4 py-2.5 rounded-3xl bg-ink/10 text-ink text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%] text-ink text-sm leading-relaxed">
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles size={16} className="text-accent" />
                    </div>
                    <p>{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 pb-5 pt-2 relative min-w-[380px]">
        
        {showAttachments && (
          <div className="absolute bottom-[calc(100%-0.5rem)] left-4 flex gap-2 p-2 bg-paper rounded-2xl border border-line shadow-lg z-50">
            <button className="flex flex-col items-center justify-center w-16 h-16 rounded-xl hover:bg-ink/10 transition-colors text-muted hover:text-ink">
              <FileText size={20} className="mb-1" />
              <span className="text-[10px] font-medium">Upload file</span>
            </button>
            <button className="flex flex-col items-center justify-center w-16 h-16 rounded-xl hover:bg-ink/10 transition-colors text-muted hover:text-ink">
              <ImageIcon size={20} className="mb-1" />
              <span className="text-[10px] font-medium">Attach image</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between bg-ink/5 rounded-xl px-4 py-2.5 mb-2 mx-auto max-w-full">
          <div className="flex items-center gap-2 text-xs font-medium text-ink">
            Looking at {pageName}
          </div>
        </div>

        <div className="bg-ink/5 rounded-[24px] p-2 flex flex-col focus-within:bg-ink/10 transition-colors border border-transparent focus-within:border-accent/20">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything..."
            className="w-full bg-transparent border-none px-3 pt-3 pb-2 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-0 resize-none max-h-32 min-h-[44px]"
            rows={1}
          />
          
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-1 text-muted">
              <button 
                onClick={() => setShowAttachments(!showAttachments)}
                className="p-2 rounded-full hover:bg-ink/10 transition-colors hover:text-ink"
              >
                <Plus size={20} />
              </button>
              <button className="p-2 rounded-full hover:bg-ink/10 transition-colors hover:text-ink">
                <SlidersHorizontal size={18} />
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-ink/10 transition-colors text-[13px] font-medium text-ink">
                Flash-Lite <ChevronDown size={14} className="text-muted" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                  input.trim() ? 'bg-ink text-paper' : 'bg-transparent text-muted'
                }`}
              >
                <SendHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
