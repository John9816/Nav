import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Image as ImageIcon, MessageSquare, 
  Trash2, Bot, Sparkles, StopCircle, Copy, Check, 
  Eraser, Sparkle, Zap, Plus, Clock, MessageCircle,
  ChevronDown, Cpu, Box
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types';
import { sendMessageStream } from '../services/geminiService';
import { generateImage } from '../services/imageService';
import { useAuth } from '../contexts/AuthContext';
import { saveSpark } from '../services/sparkService';
import { createSession, getSessions, saveMessage, getMessages, ChatSession, deleteSession, deleteMessage } from '../services/chatService';

interface AIStudioProps {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  imageHistory: ChatMessage[];
  setImageHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentSessionId: string | null;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

type Mode = 'chat' | 'image';

const MODELS = [
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', icon: <Zap size={14} className="text-blue-500" /> },
  { id: 'LongCat-Flash-Chat', name: 'LongCat Flash', icon: <Cpu size={14} className="text-rose-500" /> },
  { id: 'LongCat-Flash-Thinking', name: 'LongCat Thinking', icon: <Bot size={14} className="text-purple-500" /> },
  { id: 'LongCat-Flash-Thinking-2601', name: 'LongCat Thinking 2601', icon: <Sparkles size={14} className="text-orange-500" /> },
];

const MessageItem: React.FC<{ msg: ChatMessage; mode: Mode; onDelete: (id: string) => void }> = ({ msg, mode, onDelete }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { user } = useAuth();

  const handleCopy = async () => {
    try {
      if (msg.imageUrl) {
        const response = await fetch(msg.imageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      } else {
        await navigator.clipboard.writeText(msg.text || '');
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
      if (msg.imageUrl) {
         try {
           await navigator.clipboard.writeText(msg.imageUrl);
           setIsCopied(true);
           setTimeout(() => setIsCopied(false), 2000);
         } catch(e) { console.error("Fallback copy failed", e); }
      }
    }
  };

  const handleSaveSpark = async () => {
    if (!user) {
        alert("请先登录后收藏灵感");
        return;
    }
    try {
        const type = msg.imageUrl ? 'image' : 'text';
        const content = msg.imageUrl ? msg.imageUrl : (msg.text || '');
        await saveSpark(user.id, type, content);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
        console.error("Failed to save spark", error);
        alert("收藏失败，请重试");
    }
  };

  const isUser = msg.role === 'user';
  const isModel = msg.role === 'model';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up group/item`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] lg:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 md:gap-4`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1 transition-transform hover:scale-105
          ${isUser 
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/20' 
            : mode === 'image' 
              ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-purple-500/20' 
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 shadow-sm'
          }
        `}>
          {isUser ? (
             <div className="text-[10px] font-bold tracking-tighter">ME</div>
          ) : (
             mode === 'image' ? <Sparkles size={18} /> : <Bot size={20} />
          )}
        </div>

        {/* Bubble */}
        <div className={`relative group/bubble p-4 md:p-5 rounded-2xl shadow-sm text-[15px] leading-relaxed overflow-hidden transition-all duration-300
          ${isUser 
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-blue-500/10' 
            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 rounded-tl-sm hover:shadow-md dark:hover:shadow-slate-900/20'
          }
        `}>
          
          {/* Image Content */}
          {msg.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 min-h-[200px] flex items-center justify-center relative group/image">
              <img 
                src={msg.imageUrl} 
                alt="AI Generated" 
                className="max-w-full h-auto object-contain transition-transform duration-700 group-hover/image:scale-[1.02]" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100 pointer-events-none">
              </div>
              <a 
                 href={msg.imageUrl} 
                 target="_blank" 
                 rel="noreferrer"
                 className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/80 text-slate-900 dark:text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-auto hover:bg-white"
              >
                 查看原图
              </a>
            </div>
          )}

          {/* Text Content */}
          <div className={`min-w-[20px] ${isUser ? 'text-white/95' : ''}`}>
             {msg.role === 'model' ? (
                <div className="prose prose-slate dark:prose-invert max-w-none break-words prose-p:my-1 prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900 prose-pre:border dark:prose-pre:border-slate-700 prose-pre:rounded-xl">
                  <ReactMarkdown>{msg.text || ''}</ReactMarkdown>
                </div>
             ) : (
               <div className="whitespace-pre-wrap break-words">{msg.text || ''}</div>
             )}
          </div>

          {/* Loading Indicator */}
          {msg.isLoading && !msg.text && (
             <div className="flex space-x-1.5 py-1">
                <div className="w-2 h-2 bg-slate-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-slate-400/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-400/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          )}

          {/* Action Buttons */}
          {!msg.isLoading && (
            <div className={`absolute bottom-2 right-2 flex gap-1.5 transition-all duration-300 transform translate-y-2 opacity-0 group-hover/bubble:translate-y-0 group-hover/bubble:opacity-100`}>
                <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-500 hover:text-blue-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-400 dark:hover:text-blue-300 shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"
                    title="复制"
                >
                    {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                
                {isModel && (
                    <button
                        onClick={handleSaveSpark}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-500 hover:text-yellow-500 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-400 dark:hover:text-yellow-400 shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"
                        title="收藏灵感"
                    >
                        {isSaved ? <Check size={14} className="text-green-500" /> : <Zap size={14} />}
                    </button>
                )}

                <button
                    onClick={() => onDelete(msg.id)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-500 hover:text-red-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-400 dark:hover:text-red-400 shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"
                    title="删除此消息"
                >
                    <Trash2 size={14} />
                </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const AIStudio: React.FC<AIStudioProps> = ({ 
  chatHistory, 
  setChatHistory, 
  imageHistory, 
  setImageHistory,
  currentSessionId,
  setCurrentSessionId
}) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('chat');
  const [input, setInput] = useState('');
  
  const [isTyping, setIsTyping] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Model Selection
  const [currentModel, setCurrentModel] = useState(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = mode === 'chat' ? chatHistory : imageHistory;
  const activeModel = MODELS.find(m => m.id === currentModel) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLoadSession = async (session: ChatSession) => {
    if (session.id === currentSessionId) return;
    try {
        setChatHistory([]); // Clear current view
        const msgs = await getMessages(session.id);
        if (msgs && msgs.length > 0) {
            setChatHistory(msgs);
        } else {
            setChatHistory([{ id: 'empty', role: 'model', text: '此会话暂无消息。' }]);
        }
        setCurrentSessionId(session.id);
        setMode('chat');
    } catch (e) {
        console.error("Failed to load session", e);
    }
  };

  const loadSessionList = async () => {
    if (!user) return;
    setIsLoadingSessions(true);
    try {
        const data = await getSessions(user.id);
        setSessions(data || []);
        
        // Auto-load latest session if none selected and exists (Data Echo)
        if (!currentSessionId && data && data.length > 0) {
            handleLoadSession(data[0]);
        }
    } catch (e: any) {
        console.error("Failed to load sessions", e.message || e);
        setSessions([]);
    } finally {
        setIsLoadingSessions(false);
    }
  };

  // Load sessions on mount or user change
  useEffect(() => {
    if (user) {
        loadSessionList();
    }
  }, [user]);

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, mode]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setChatHistory([{ id: 'init-' + Date.now(), role: 'model', text: '你好！我是你的 AI 智能助手。有什么我可以帮你的吗？' }]);
    setMode('chat');
  };
  
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定删除此会话吗？")) return;
    try {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
            handleNewChat();
        }
    } catch(e) {
        console.error("Delete failed", e);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm("确定删除此消息吗？")) return;

    // Optimistically remove from UI
    if (mode === 'chat') {
        setChatHistory(prev => prev.filter(m => m.id !== msgId));
    } else {
        setImageHistory(prev => prev.filter(m => m.id !== msgId));
    }

    // If logged in, delete from DB
    // Only attempt DB delete if it's NOT a temporary/init message
    if (user && currentSessionId && msgId !== 'empty' && !msgId.startsWith('init-') && !msgId.startsWith('temp-')) {
         try {
             await deleteMessage(msgId);
         } catch (e) {
             console.error("Failed to delete message", e);
         }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const currentMode = mode;
    const userText = input;
    
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);
    
    // 1. Add User Message to UI
    const tempUserMsgId = 'temp-' + Date.now();
    const userMessage: ChatMessage = { id: tempUserMsgId, role: 'user', text: userText };
    if (currentMode === 'chat') setChatHistory(prev => [...prev, userMessage]);
    else setImageHistory(prev => [...prev, userMessage]);

    // 2. Persist User Message (Chat Only)
    let activeSessionId = currentSessionId;
    if (currentMode === 'chat' && user) {
        if (!activeSessionId) {
            try {
                const title = userText.slice(0, 20) + (userText.length > 20 ? '...' : '');
                const newSession = await createSession(user.id, title);
                activeSessionId = newSession.id;
                setCurrentSessionId(activeSessionId);
                // We reload session list to show the new one
                const data = await getSessions(user.id);
                setSessions(data || []); 
            } catch (e: any) { 
                console.error("Create session failed", e.message || e); 
            }
        }
        if (activeSessionId) {
            // Save user message with user.id for RLS and update local ID with DB ID
            saveMessage(activeSessionId, user.id, 'user', userText)
                .then((savedMsg) => {
                    if (savedMsg) {
                        setChatHistory(prev => prev.map(m => m.id === tempUserMsgId ? { ...m, id: savedMsg.id } : m));
                    }
                    loadSessionList();
                })
                .catch(e => console.error("Save user msg failed", e.message || e));
        }
    }

    const botMessageId = 'temp-' + (Date.now() + 1);

    // 3. Process AI
    try {
        if (currentMode === 'image') {
            setImageHistory(prev => [...prev, { id: botMessageId, role: 'model', text: '正在构思...', isLoading: true }]);
            const imageUrl = await generateImage(userText);
            setImageHistory(prev => prev.map(m => m.id === botMessageId ? { ...m, text: '绘制完成！', imageUrl, isLoading: false } : m));
        } else {
            // Chat
            setChatHistory(prev => [...prev, { id: botMessageId, role: 'model', text: '', isLoading: true }]);
            const historyForApi = [...chatHistory, userMessage].filter(m => !m.imageUrl);
            
            // Pass the current selected model
            const stream = sendMessageStream(historyForApi, currentModel);
            
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setChatHistory(prev => prev.map(m => m.id === botMessageId ? { ...m, text: fullText, isLoading: false } : m));
            }
            
            // Persist Model Message
            if (currentMode === 'chat' && user && activeSessionId && fullText) {
                try {
                    // Save model message with user.id for RLS
                    const savedMsg = await saveMessage(activeSessionId, user.id, 'model', fullText);
                    if (savedMsg) {
                         setChatHistory(prev => prev.map(m => m.id === botMessageId ? { ...m, id: savedMsg.id } : m));
                    }
                    // Refresh session list to update the timestamp
                    const data = await getSessions(user.id);
                    setSessions(data || []);
                } catch (e: any) {
                    console.error("Save model msg failed", e.message || e);
                }
            }
        }
    } catch (error: any) {
        // Display specific error message from API if available
        const errMsg = error.message || "抱歉，出错了，请重试。";
        console.error("AI Generation Error", error);
        if (currentMode === 'chat') setChatHistory(prev => prev.map(m => m.id === botMessageId ? { ...m, text: `错误: ${errMsg}`, isLoading: false } : m));
        else setImageHistory(prev => prev.map(m => m.id === botMessageId ? { ...m, text: `错误: ${errMsg}`, isLoading: false } : m));
    } finally {
        setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    if (confirm(`确定要清空当前${mode === 'chat' ? '对话' : '绘画'}历史吗？`)) {
      if (mode === 'chat') {
        setChatHistory([{ id: 'init-' + Date.now(), role: 'model', text: '历史已清空，我们重新开始吧。' }]);
        setCurrentSessionId(null);
      } else {
        setImageHistory([{ id: 'init-' + Date.now(), role: 'model', text: '历史已清空，请描述新画面。' }]);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 font-sans animate-fade-in overflow-hidden">
      
      {/* Mobile Top Navigation */}
      <div className="md:hidden shrink-0 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 z-20">
         <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setMode('chat')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                ${mode === 'chat' 
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
            >
              <MessageSquare size={16} /> 对话
            </button>
            <button 
              onClick={() => setMode('image')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                ${mode === 'image' 
                  ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
            >
              <ImageIcon size={16} /> 绘画
            </button>
         </div>
         <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <button onClick={handleNewChat} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
               <Plus size={20} />
            </button>
         </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 bg-white dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800/60 flex-col p-6 z-20 shrink-0 h-full overflow-hidden pb-36">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 shrink-0">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                <Sparkle size={24} fill="currentColor" className="opacity-90" />
             </div>
             <div>
                <h3 className="font-bold text-lg leading-tight text-slate-800 dark:text-slate-100">AI Studio</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">智能创作中心</p>
             </div>
        </div>

        {/* New Chat Button */}
        <button 
             onClick={handleNewChat}
             className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 mb-6 shrink-0 font-medium"
        >
             <Plus size={18} />
             <span>开启新对话</span>
        </button>
           
        {/* Mode Selection */}
        <div className="space-y-2 mb-6 shrink-0">
             <div className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">模式选择</div>
             
             <button 
               onClick={() => setMode('chat')}
               className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-sm font-medium
                 ${mode === 'chat' 
                   ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
                   : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                 }`}
             >
                <MessageSquare size={18} className={mode === 'chat' ? 'text-blue-500' : ''} />
                <span>智能对话</span>
             </button>

             <button 
               onClick={() => setMode('image')}
               className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-sm font-medium
                 ${mode === 'image' 
                   ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
                   : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                 }`}
             >
                <ImageIcon size={18} className={mode === 'image' ? 'text-purple-500' : ''} />
                <span>AI 绘画</span>
             </button>
        </div>

        {/* Chat History List */}
        {mode === 'chat' && user && (
            <div className="flex-1 flex flex-col min-h-0">
                <div className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">历史对话</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-1">
                    {sessions.map(session => (
                        <div 
                            key={session.id}
                            onClick={() => handleLoadSession(session)}
                            className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-sm
                                ${currentSessionId === session.id 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <MessageCircle size={14} className="shrink-0 opacity-70" />
                                <span className="truncate">{session.title || '新对话'}</span>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteSession(e, session.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400">
                            暂无历史记录
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Footer Actions */}
        <div className="mt-auto pt-4 shrink-0 border-t border-slate-100 dark:border-slate-800">
           {!user && (
               <div className="text-xs text-center text-slate-400 mb-2">
                   登录后可保存对话记录
               </div>
           )}
           <button 
            onClick={clearHistory}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs"
          >
            <Eraser size={14} />
            <span>清空当前屏幕</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Increased padding to avoid music player obstruction */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-slate-50/50 dark:bg-slate-900/50 pb-36">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 space-y-6 md:space-y-8 scroll-smooth custom-scrollbar">
          {messages.map((msg) => (
            <MessageItem key={msg.id} msg={msg} mode={mode} onDelete={handleDeleteMessage} />
          ))}
          {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 opacity-50 animate-fade-in">
                {mode === 'chat' ? <Bot size={48} /> : <Sparkles size={48} />}
                <p>开始你的 {mode === 'chat' ? '对话' : '创作'} 吧...</p>
             </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* Input Area (Docked at Bottom) */}
        <div className="shrink-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-10 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            <div className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col p-2 transition-all duration-300
               ${isTyping ? 'ring-2 ring-blue-500/10 border-blue-500/30 dark:border-blue-500/30' : 'hover:border-slate-300 dark:hover:border-slate-600'}
            `}>
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'chat' ? "有什么可以帮你的吗..." : "描述你想要生成的画面..."}
                className="w-full max-h-[160px] bg-transparent border-none focus:ring-0 resize-none py-3 px-3 text-slate-700 dark:text-slate-100 placeholder-slate-400 text-[15px] leading-relaxed mb-2"
                rows={1}
              />

              <div className="flex items-center justify-between pl-1 pr-1">
                 {/* Left: Model Switcher (Chat Mode Only) */}
                 <div className="relative">
                    {mode === 'chat' && (
                        <div ref={modelMenuRef}>
                            <button 
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                {activeModel.icon}
                                <span>{activeModel.name}</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isModelMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                    <div className="p-1">
                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">选择模型</div>
                                        {MODELS.map((model) => (
                                            <button
                                                key={model.id}
                                                onClick={() => {
                                                    setCurrentModel(model.id);
                                                    setIsModelMenuOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2
                                                    ${currentModel === model.id 
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }
                                                `}
                                            >
                                                {model.icon}
                                                <span>{model.name}</span>
                                                {currentModel === model.id && <Check size={12} className="ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {mode === 'image' && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-400">
                             <ImageIcon size={12} />
                             <span>Z-Image Turbo</span>
                        </div>
                    )}
                 </div>

                 {/* Right: Actions */}
                 <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 hidden sm:inline-block select-none">
                        Enter 发送
                    </span>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className={`p-2 rounded-lg text-white transition-all duration-300 flex items-center justify-center transform active:scale-95
                            ${!input.trim() || isTyping ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : ''}
                            ${mode === 'chat' && input.trim() && !isTyping ? 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20' : ''}
                            ${mode === 'image' && input.trim() && !isTyping ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-md hover:shadow-purple-500/20' : ''}
                        `}
                    >
                        {isTyping ? <StopCircle size={16} className="animate-pulse" /> : <Send size={16} />}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AIStudio;