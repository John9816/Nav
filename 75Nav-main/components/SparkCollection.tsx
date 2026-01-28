import React, { useEffect, useState } from 'react';
import { Spark } from '../types';
import { fetchSparks, deleteSpark } from '../services/sparkService';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Trash2, Copy, Image as ImageIcon, Type, Calendar, Check, Search, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SparkCollection: React.FC = () => {
  const { user } = useAuth();
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'text' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSparks();
    }
  }, [user]);

  const loadSparks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchSparks(user.id);
      setSparks(data);
    } catch (error) {
      console.error("Failed to load sparks", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条灵感吗？')) return;
    try {
      await deleteSpark(id);
      setSparks(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("Failed to delete spark", error);
      alert("删除失败，请重试");
    }
  };

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const filteredSparks = sparks.filter(spark => {
    const matchesFilter = filter === 'all' || spark.type === filter;
    const matchesSearch = spark.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-xl">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">我的灵感集</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              共收集 {sparks.length} 个 AI 创作片段
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           {/* Search */}
           <div className="relative flex-1 md:w-64">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索灵感..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           </div>

           {/* Filter Tabs */}
           <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg shrink-0">
              <button 
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                全部
              </button>
              <button 
                onClick={() => setFilter('text')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${filter === 'text' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                <Type size={12} /> 文本
              </button>
              <button 
                onClick={() => setFilter('image')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${filter === 'image' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                <ImageIcon size={12} /> 图片
              </button>
           </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
             <div className="w-8 h-8 border-4 border-slate-200 border-t-yellow-500 rounded-full animate-spin"></div>
             <p className="text-sm">加载灵感中...</p>
          </div>
        ) : filteredSparks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <Zap size={32} className="opacity-30" />
             </div>
             <p>还没有收藏任何灵感</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {filteredSparks.map(spark => (
               <div 
                 key={spark.id} 
                 className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
               >
                 {/* Card Content */}
                 {spark.type === 'image' ? (
                   <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                      <img src={spark.content} alt="Spark" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      <a 
                        href={spark.content} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-black/60 backdrop-blur rounded-full text-slate-700 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        title="查看原图"
                      >
                         <ExternalLink size={16} />
                      </a>
                   </div>
                 ) : (
                   <div className="p-5 flex-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none break-words">
                         <ReactMarkdown>{spark.content}</ReactMarkdown>
                      </div>
                   </div>
                 )}

                 {/* Card Footer */}
                 <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                       <Calendar size={12} />
                       <span>{formatDate(spark.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                       {spark.type === 'text' && (
                         <button 
                           onClick={() => handleCopy(spark.content, spark.id)}
                           className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                           title="复制"
                         >
                            {copiedId === spark.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                         </button>
                       )}
                       <button 
                         onClick={() => handleDelete(spark.id)}
                         className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                         title="删除"
                       >
                          <Trash2 size={16} />
                       </button>
                    </div>
                 </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SparkCollection;
