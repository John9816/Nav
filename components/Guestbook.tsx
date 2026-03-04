import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GuestbookMessage } from '../types';
import { fetchMessages, postMessage, deleteMessage } from '../services/guestbookService';
import { Send, Trash2, MessageSquareQuote, User as UserIcon, Loader2, LogIn } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const Guestbook: React.FC = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await fetchMessages();
      setMessages(data);
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    try {
      const newMessage = await postMessage(
        user.id,
        content.trim(),
        profile?.nickname || user.email?.split('@')[0] || 'Guest',
        profile?.avatar_url || null
      );
      setMessages([newMessage, ...messages]);
      setContent('');
    } catch (error) {
      console.error("Failed to post message", error);
      alert("发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条留言吗？")) return;
    try {
      await deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error("Failed to delete message", error);
      alert("删除失败");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      if (diff < 60 * 60 * 1000) {
        return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`;
      }
      return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
    }
    
    return date.toLocaleDateString('zh-CN', {
       month: 'short',
       day: 'numeric',
       hour: '2-digit',
       minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="shrink-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <MessageSquareQuote size={20} />
           </div>
           <div>
             <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">留言板</h1>
             <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">欢迎留下你的足迹</p>
           </div>
        </div>
        <div className="text-xs text-slate-400">
           共 {messages.length} 条留言
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
         <div className="max-w-3xl mx-auto space-y-8">
            
            {/* Input Area */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
               {user ? (
                 <div className="space-y-3">
                    <div className="flex items-start gap-3">
                       <div className="shrink-0">
                          {profile?.avatar_url ? (
                             <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                          ) : (
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold shadow-sm">
                                {user.email?.charAt(0).toUpperCase()}
                             </div>
                          )}
                       </div>
                       <textarea
                         value={content}
                         onChange={(e) => setContent(e.target.value)}
                         placeholder="说点什么吧..."
                         className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-xl p-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 resize-none min-h-[80px]"
                       />
                    </div>
                    <div className="flex justify-end">
                       <button
                         onClick={handlePost}
                         disabled={!content.trim() || submitting}
                         className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                         <span>发布留言</span>
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400">
                       <UserIcon size={24} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">登录后即可发表留言</p>
                 </div>
               )}
            </div>

            {/* Message List */}
            <div className="space-y-4">
               {loading ? (
                 <div className="flex justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-emerald-500" />
                 </div>
               ) : messages.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                    还没有人留言，来抢沙发吧！
                 </div>
               ) : (
                 messages.map((msg) => (
                   <div key={msg.id} className="group flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="shrink-0">
                         {msg.avatar_url ? (
                            <img src={msg.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover shadow-sm bg-white dark:bg-slate-800" />
                         ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                               <UserIcon size={20} />
                            </div>
                         )}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-baseline justify-between">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                               {msg.nickname || '匿名用户'}
                            </h4>
                            <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
                         </div>
                         <div className="mt-1 bg-white dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed relative hover:shadow-md transition-shadow">
                             <div className="prose prose-sm prose-slate dark:prose-invert max-w-none break-words">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                             </div>
                             
                             {user && user.id === msg.user_id && (
                                <button
                                  onClick={() => handleDelete(msg.id)}
                                  className="absolute bottom-2 right-2 p-1.5 text-slate-300 hover:text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  title="删除"
                                >
                                   <Trash2 size={12} />
                                </button>
                             )}
                         </div>
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Guestbook;