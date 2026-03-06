import React, { useState, useRef } from 'react';
import { Category, LinkItem } from '../types';
import {
  FolderPlus, Plus, Upload, Download, Trash2, Edit2,
  ExternalLink, LayoutGrid, List, FileText, RotateCcw, Folder
} from 'lucide-react';
import { bulkCreateBookmarks, clearUserBookmarks, restoreDefaultBookmarks } from '../services/bookmarkService';
import { useAuth } from '../contexts/AuthContext';

interface BookmarkManagerProps {
  categories: Category[];
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onAddLink: (catId: string) => void;
  onEditLink: (link: LinkItem) => void;
  onDeleteLink: (id: string) => void;
  refreshBookmarks: () => Promise<void>;
}

const BookmarkManager: React.FC<BookmarkManagerProps> = ({
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddLink,
  onEditLink,
  onDeleteLink,
  refreshBookmarks
}) => {
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categories.length > 0 ? categories[0].id : null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = categories.find(c => c.id === selectedCategoryId);

  const handleClearAll = async () => {
    if (!user) return;
    if (!confirm('严重警告：此操作将清空您账号下的所有分类和链接，且无法撤销。\n\n确定要清空吗？')) {
      return;
    }
    try {
      await clearUserBookmarks(user.id);
      await refreshBookmarks();
      setSelectedCategoryId(null);
      alert('导航数据已清空');
    } catch (e) {
      console.error(e);
      alert('清空失败，请重试');
    }
  };

  const handleRestoreDefaults = async () => {
    if (!user) return;
    if (!confirm('此操作将清空您当前的所有数据，并恢复为系统默认导航数据。\n\n确定要重置吗？')) {
      return;
    }
    try {
      await restoreDefaultBookmarks(user.id);
      await refreshBookmarks();
      alert('已恢复默认数据');
    } catch (e) {
      console.error(e);
      alert('重置失败，请重试');
    }
  };

  const handleExport = () => {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const toolbarRootName = '书签栏';
    const toolbarItems = categories.filter(c => c.title === toolbarRootName || c.title.startsWith(toolbarRootName + '/'));
    const otherItems = categories.filter(c => c.title !== toolbarRootName && !c.title.startsWith(toolbarRootName + '/'));

    const generateDL = (items: Category[], rootPrefix: string = '') => {
      let output = '';

      const rootCat = items.find(c => c.title === rootPrefix);
      if (rootCat) {
        rootCat.links.forEach(link => {
          output += `    <DT><A HREF="${link.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${link.title}</A>\n`;
        });
      }

      const prefixLen = rootPrefix ? rootPrefix.length + 1 : 0;
      const children = items.filter(c => c.title !== rootPrefix && c.title.startsWith(rootPrefix ? rootPrefix + '/' : ''));
      const directChildNames = new Set<string>();

      children.forEach(c => {
        const suffix = c.title.substring(prefixLen);
        const parts = suffix.split('/');
        const childName = parts[0];
        directChildNames.add(rootPrefix ? `${rootPrefix}/${childName}` : childName);
      });

      directChildNames.forEach(childTitle => {
        const shortName = childTitle.split('/').pop() || childTitle;
        output += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}">${shortName}</H3>\n`;
        output += `    <DL><p>\n`;
        output += generateDL(items, childTitle);
        output += `    </DL><p>\n`;
      });

      return output;
    };

    if (toolbarItems.length > 0) {
      html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>\n`;
      html += `    <DL><p>\n`;
      html += generateDL(toolbarItems, toolbarRootName);
      html += `    </DL><p>\n`;
    }

    otherItems.forEach(cat => {
      html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}">${cat.title}</H3>\n`;
      html += `    <DL><p>\n`;
      cat.links.forEach(link => {
        html += `        <DT><A HREF="${link.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${link.title}</A>\n`;
      });
      html += `    </DL><p>\n`;
    });

    html += `</DL><p>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const importDataMap = new Map<string, { title: string, url: string }[]>();

        const processList = (dlElement: Element, currentPath: string[]) => {
          const children = Array.from(dlElement.children);

          for (const node of children) {
            if (node.tagName === 'DT') {
              const h3 = node.querySelector(':scope > h3');
              const dl = node.querySelector(':scope > dl');
              const nextSibling = node.nextElementSibling;
              let targetDl = dl;

              if (!targetDl && nextSibling && nextSibling.tagName === 'DL') {
                targetDl = nextSibling;
              }

              const a = node.querySelector(':scope > a');

              if (h3) {
                let folderName = h3.textContent || 'Untitled';
                const isToolbar =
                  h3.getAttribute('PERSONAL_TOOLBAR_FOLDER') === 'true' ||
                  h3.getAttribute('personal_toolbar_folder') === 'true' ||
                  folderName === 'Bookmarks bar' ||
                  folderName === '书签栏';

                let newPath = [...currentPath];
                if (isToolbar) {
                  folderName = '书签栏';
                  newPath = ['书签栏'];
                } else {
                  newPath.push(folderName);
                }

                if (targetDl) {
                  processList(targetDl, newPath);
                }
              } else if (a) {
                let categoryTitle = '导入书签';
                if (currentPath.length > 0) {
                  categoryTitle = currentPath.join('/');
                }

                if (!importDataMap.has(categoryTitle)) {
                  importDataMap.set(categoryTitle, []);
                }

                importDataMap.get(categoryTitle)?.push({
                  title: a.textContent || 'Link',
                  url: a.getAttribute('href') || ''
                });
              }
            }
          }
        };

        const rootDl = doc.querySelector('dl');
        if (rootDl) {
          processList(rootDl, []);
        }

        const importData = Array.from(importDataMap.entries()).map(([title, links]) => ({
          title,
          links
        }));

        if (importData.length > 0) {
          const result = await bulkCreateBookmarks(user.id, importData);
          if (result.success) {
            await refreshBookmarks();
            alert(`成功导入 ${importData.length} 个文件夹的书签`);
          } else {
            alert('导入失败，请重试。');
          }
        } else {
          alert('未在文件中找到有效的书签数据。请确认您上传的是 Chrome 导出的 HTML 书签文件。');
        }
      } catch (err) {
        console.error(err);
        alert('文件解析失败');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-5 border-b border-[rgba(148,114,70,0.12)] dark:border-[rgba(94,234,212,0.1)] bg-[rgba(255,250,242,0.72)] dark:bg-[rgba(9,20,28,0.8)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-teal-500 text-white flex items-center justify-center shadow-[0_16px_30px_-18px_rgba(217,119,69,0.8)]">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h1 className="font-[Outfit] text-2xl font-semibold tracking-[0.08em] text-slate-900 dark:text-white">导航管理</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">沿用首页的玻璃暖色系统，分类和链接都在同一工作台中完成。</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/40 text-sm font-medium transition-colors"
            >
              <RotateCcw size={16} />
              <span>重置</span>
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200/70 dark:border-red-800/40 text-sm font-medium transition-colors"
            >
              <Trash2 size={16} />
              <span>清空</span>
            </button>

            <input
              type="file"
              accept=".html"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/70 dark:bg-slate-900/70 hover:bg-orange-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[rgba(148,114,70,0.12)] dark:border-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
              <span>{isImporting ? '导入中' : '导入'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/70 dark:bg-slate-900/70 hover:bg-orange-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[rgba(148,114,70,0.12)] dark:border-slate-700 text-sm font-medium transition-colors"
            >
              <Download size={16} />
              <span>导出</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-6">
          <aside className="glass-panel rounded-[2rem] overflow-hidden flex flex-col min-h-[18rem] lg:min-h-0">
            <div className="p-5 border-b border-[rgba(148,114,70,0.1)] dark:border-slate-800/50 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Categories</div>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{categories.length} 个分类</div>
              </div>
              <button
                onClick={onAddCategory}
                className="p-2 rounded-full bg-white/70 dark:bg-slate-900/70 hover:bg-orange-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-[rgba(148,114,70,0.12)] dark:border-slate-700 transition-colors"
                title="添加分类"
              >
                <FolderPlus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {categories.map(cat => {
                const isPinned = cat.title.startsWith('书签栏');
                const isActive = selectedCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`group flex items-center justify-between px-3 py-3 rounded-[1.25rem] cursor-pointer transition-colors text-sm border ${
                      isActive
                        ? 'bg-[rgba(255,251,246,0.9)] dark:bg-[rgba(9,20,28,0.82)] text-slate-900 dark:text-slate-100 border-[rgba(148,114,70,0.14)] dark:border-slate-700 shadow-[0_18px_40px_-30px_rgba(66,45,22,0.45)]'
                        : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="opacity-80 shrink-0">
                        {isPinned ? <Folder size={18} className="text-amber-500" /> : (cat.icon || <Folder size={18} className="text-slate-400" />)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{cat.title.replace('书签栏/', '').replace('书签栏', '书签栏')}</div>
                        {isPinned && cat.title !== '书签栏' && (
                          <div className="text-[10px] text-slate-400 truncate">{cat.title}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      {isPinned && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">置顶</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }} className="p-1 hover:text-orange-500 text-slate-400">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }} className="p-1 hover:text-red-500 text-slate-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  暂无分类，请先添加一个分类。
                </div>
              )}
            </div>
          </aside>

          <section className="glass-panel rounded-[2rem] overflow-hidden min-h-[20rem] flex flex-col">
            {activeCategory ? (
              <>
                <div className="p-5 md:p-6 border-b border-[rgba(148,114,70,0.1)] dark:border-slate-800/50 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Active Category</div>
                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="text-xl font-[Outfit] font-semibold text-slate-900 dark:text-white truncate">{activeCategory.title}</h2>
                      <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/70 border border-[rgba(148,114,70,0.12)] dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                        {activeCategory.links.length}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddLink(activeCategory.id)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-400 hover:to-teal-400 text-white rounded-full text-sm font-medium shadow-[0_20px_40px_-24px_rgba(217,119,69,0.85)] shrink-0"
                  >
                    <Plus size={16} />
                    <span>添加链接</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                  {activeCategory.links.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                      <FileText size={48} className="opacity-20" />
                      <p>此分类下暂无链接</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {activeCategory.links.map(link => (
                        <div
                          key={link.id}
                          className="group bg-[rgba(255,251,246,0.84)] dark:bg-[rgba(9,20,28,0.74)] border border-white/70 dark:border-slate-700/60 rounded-[1.5rem] p-4 flex items-start gap-4 hover:shadow-[0_24px_50px_-34px_rgba(66,45,22,0.45)] transition-all"
                        >
                          <div className="shrink-0 p-3 bg-white/70 dark:bg-slate-900/70 rounded-2xl text-slate-500">
                            {link.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">{link.title}</h3>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEditLink(link)} className="p-1 text-slate-400 hover:text-orange-500"><Edit2 size={14} /></button>
                                <button onClick={() => onDeleteLink(link.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            </div>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-orange-600 dark:text-teal-300 hover:underline truncate block mt-1 flex items-center gap-1"
                            >
                              <span className="truncate">{link.url}</span>
                              <ExternalLink size={10} />
                            </a>
                            {link.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                                {link.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <List size={48} className="opacity-20 mb-4" />
                <p>请选择分类进行管理</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default BookmarkManager;
