import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { AVAILABLE_ICONS, getIconByName } from '../utils/iconMap';

// --- Icon Picker Component ---
const IconPicker: React.FC<{ selected: string, onSelect: (icon: string) => void }> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg max-h-32 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700">
      {AVAILABLE_ICONS.map(iconName => (
        <button
          key={iconName}
          type="button"
          onClick={() => onSelect(iconName)}
          className={`p-2 rounded-md flex items-center justify-center transition-colors
            ${selected === iconName 
              ? 'bg-blue-500 text-white shadow-sm' 
              : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700 dark:text-slate-400'
            }
          `}
          title={iconName}
        >
          {getIconByName(iconName, selected === iconName ? "" : undefined)}
        </button>
      ))}
    </div>
  );
};

// --- Category Modal ---
interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, iconName: string) => Promise<void>;
  initialData?: { title: string, iconName: string };
  title: string;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSave, initialData, title }) => {
  const [catTitle, setCatTitle] = useState('');
  const [iconName, setIconName] = useState('Hash');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCatTitle(initialData?.title || '');
      setIconName(initialData?.iconName || 'Hash');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    setLoading(true);
    try {
      await onSave(catTitle, iconName);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">分类名称</label>
            <input 
              value={catTitle} 
              onChange={e => setCatTitle(e.target.value)} 
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="例如：常用工具"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">选择图标</label>
            <IconPicker selected={iconName} onSelect={setIconName} />
          </div>
          <button 
            type="submit" 
            disabled={loading || !catTitle.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Link Modal ---
interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string, url: string, description: string, iconName: string }) => Promise<void>;
  initialData?: { title: string, url: string, description: string, iconName: string };
  title: string;
}

export const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onSave, initialData, title }) => {
  const [linkTitle, setLinkTitle] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [iconName, setIconName] = useState('Globe');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLinkTitle(initialData?.title || '');
      setUrl(initialData?.url || '');
      setDesc(initialData?.description || '');
      setIconName(initialData?.iconName || 'Globe');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !url.trim()) return;
    setLoading(true);
    try {
      await onSave({ title: linkTitle, url, description: desc, iconName });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">链接名称</label>
              <input 
                value={linkTitle} 
                onChange={e => setLinkTitle(e.target.value)} 
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="名称"
                autoFocus
              />
            </div>
            <div>
               <label className="block text-xs font-medium text-slate-500 mb-1">图标</label>
               <div className="relative group">
                 <div className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 cursor-pointer">
                    {getIconByName(iconName)}
                    <span className="text-sm opacity-70">{iconName}</span>
                 </div>
                 <div className="absolute top-full left-0 right-0 mt-1 z-10 hidden group-hover:block hover:block">
                     <IconPicker selected={iconName} onSelect={setIconName} />
                 </div>
               </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">链接地址 (URL)</label>
            <input 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">描述 (可选)</label>
            <input 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="简短的描述..."
            />
          </div>
          
          {/* Mobile friendly simplified icon picker if hover doesn't work well */}
          <div className="md:hidden">
             <label className="block text-xs font-medium text-slate-500 mb-1">选择图标</label>
             <IconPicker selected={iconName} onSelect={setIconName} />
          </div>

          <button 
            type="submit" 
            disabled={loading || !linkTitle.trim() || !url.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
};