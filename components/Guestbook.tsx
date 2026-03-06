import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GuestbookMessage } from '../types';
import { fetchMessages, postMessage, deleteMessage } from '../services/guestbookService';
import { Send, Trash2, MessageSquareQuote, User as UserIcon, Loader2 } from 'lucide-react';
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 md:px-6 lg:px-8 py-5 border-b border-[rgba(148,114,70,0.12)] dark:border-[rgba(94,234,212,0.1)] bg-[rgba(255,250,242,0.72)] dark:bg-[rgba(9,20,28,0.8)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-teal-500 text-white flex items-center justify-center shadow-[0_16px_30px_-18px_rgba(217,119,69,0.8)]">
              <MessageSquareQuote size={20} />
            </div>
            <div>
              <h1 className="font-[Outfit] text-2xl font-semibold tracking-[0.08em] text-slate-900 dark:text-white">留言板</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">延续导航页的视觉语言，保留轻松的交流感。</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/65 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/60 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {messages.length} Messages
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[24rem_minmax(0,1fr)] gap-6">
          <aside className="glass-panel rounded-[2rem] p-5 md:p-6 h-fit">
            <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">Write</div>
            {user ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-[rgba(148,114,70,0.18)] dark:border-slate-700" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-sm">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {profile?.nickname || user.email?.split('@')[0]}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">留下你的想法、近况或建议。</div>
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="说点什么吧..."
                  className="w-full min-h-[140px] bg-[rgba(255,255,255,0.7)] dark:bg-[rgba(9,20,28,0.72)] border border-[rgba(148,114,70,0.12)] dark:border-slate-700 rounded-[1.5rem] p-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/10 focus:border-orange-400/30 resize-none"
                />
                <button
                  onClick={handlePost}
                  disabled={!content.trim() || submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-400 hover:to-teal-400 text-white rounded-[1.25rem] text-sm font-medium transition-all shadow-[0_20px_40px_-24px_rgba(217,119,69,0.85)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>发布留言</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center py-10 text-center space-y-3 rounded-[1.5rem] bg-white/55 dark:bg-slate-900/60 border border-white/60 dark:border-slate-700/60">
                <div className="p-3 bg-orange-50 dark:bg-slate-800 rounded-full text-slate-400">
                  <UserIcon size={24} />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">登录后即可发布留言</p>
              </div>
            )}
          </aside>

          <section className="space-y-4">
            {loading ? (
              <div className="glass-panel rounded-[2rem] flex justify-center py-16">
                <Loader2 size={26} className="animate-spin text-orange-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="glass-panel rounded-[2rem] text-center py-16 text-slate-400">
                还没有人留言，来抢沙发吧。
              </div>
            ) : (
              messages.map((msg) => (
                <article key={msg.id} className="glass-panel rounded-[2rem] p-5 md:p-6 group animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      {msg.avatar_url ? (
                        <img src={msg.avatar_url} alt="Avatar" className="w-11 h-11 rounded-full object-cover shadow-sm bg-white dark:bg-slate-800 border border-[rgba(148,114,70,0.14)] dark:border-slate-700" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-teal-500/80 flex items-center justify-center text-white">
                          <UserIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {msg.nickname || '匿名用户'}
                          </h4>
                          <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
                        </div>
                        {user && user.id === msg.user_id && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-2 text-slate-400 hover:text-red-500 bg-white/70 dark:bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-white/60 dark:border-slate-700/60"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="mt-4 prose prose-sm prose-slate dark:prose-invert max-w-none break-words text-slate-700 dark:text-slate-300">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Guestbook;
