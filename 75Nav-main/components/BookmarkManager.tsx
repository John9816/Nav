import React, { useState, useRef } from 'react';
import { Category, LinkItem } from '../types';
import { 
  FolderPlus, Plus, Upload, Download, Trash2, Edit2, 
  ExternalLink, ChevronRight, LayoutGrid, List, FileText, RotateCcw, AlertTriangle, Folder
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

  // --- Actions ---

  const handleClearAll = async () => {
    if (!user) return;
    if (!confirm('严重警告：此操作将清空您账号下的所有分类和链接，且无法撤销！\n\n确定要清空吗？')) {
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
      if (!confirm('此操作将清空您当前的所有数据，并恢复为系统的默认导航数据。\n\n确定要重置吗？')) {
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

  // --- Export Logic ---
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

    // 1. Build a Tree from Categories
    // Map path -> Category
    const categoryMap = new Map<string, Category>();
    categories.forEach(cat => categoryMap.set(cat.title, cat));

    // Sort categories so we process parents before children (if alphabetically sorted e.g. "A", "A/B")
    // But we need to reconstruct hierarchy.
    
    // We'll separate "Bookmark Bar" items and "Others"
    const toolbarRootName = '书签栏';
    const toolbarItems = categories.filter(c => c.title === toolbarRootName || c.title.startsWith(toolbarRootName + '/'));
    const otherItems = categories.filter(c => c.title !== toolbarRootName && !c.title.startsWith(toolbarRootName + '/'));

    // Helper to generate DL content
    const generateDL = (items: Category[], rootPrefix: string = '') => {
        let output = '';
        
        // Group by direct level relative to rootPrefix
        // e.g. rootPrefix = "书签栏", items has "书签栏", "书签栏/Folder", "书签栏/Folder/Sub"
        
        // 1. Process the exact root category links first
        const rootCat = items.find(c => c.title === rootPrefix);
        if (rootCat) {
            rootCat.links.forEach(link => {
                output += `    <DT><A HREF="${link.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${link.title}</A>\n`;
            });
        }

        // 2. Find direct sub-folders
        // A direct sub-folder is one where title is "rootPrefix/Name" and no further slashes
        const prefixLen = rootPrefix ? rootPrefix.length + 1 : 0;
        
        // Get all potential children
        const children = items.filter(c => c.title !== rootPrefix && c.title.startsWith(rootPrefix ? rootPrefix + '/' : ''));
        
        // Identify direct children names
        const directChildNames = new Set<string>();
        children.forEach(c => {
             const suffix = c.title.substring(prefixLen);
             const parts = suffix.split('/');
             const childName = parts[0];
             directChildNames.add(rootPrefix ? `${rootPrefix}/${childName}` : childName);
        });

        directChildNames.forEach(childTitle => {
            // Recurse
            const shortName = childTitle.split('/').pop() || childTitle;
            output += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}">${shortName}</H3>\n`;
            output += `    <DL><p>\n`;
            output += generateDL(items, childTitle);
            output += `    </DL><p>\n`;
        });

        return output;
    };

    // Export Toolbar
    if (toolbarItems.length > 0) {
        html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>\n`;
        html += `    <DL><p>\n`;
        html += generateDL(toolbarItems, toolbarRootName);
        html += `    </DL><p>\n`;
    }

    // Export Others
    // For others, we assume they are flat categories in "Other Bookmarks" or root
    // But since our app only supports 1 level of non-toolbar categories effectively in UI (Sidebar),
    // We just dump them as folders at root level of export.
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

  // --- Import Logic ---
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
                   const dl = node.querySelector(':scope > dl'); // Sibling DL or nested DL? Netscape often nests DL inside DT
                   const nextSibling = node.nextElementSibling; // Sometimes DL is a sibling of DT

                   // Determine target DL for this folder
                   let targetDl = dl;
                   if (!targetDl && nextSibling && nextSibling.tagName === 'DL') {
                       targetDl = nextSibling;
                   }

                   const a = node.querySelector(':scope > a');

                   if (h3) {
                       // It is a Folder
                       let folderName = h3.textContent || 'Untitled';
                       const isToolbar = h3.getAttribute('PERSONAL_TOOLBAR_FOLDER') === 'true' || 
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
                       
                       // Initialize category even if empty (optional, but good for structure)
                       // We don't create empty categories in bulkCreateBookmarks usually, but we can capture links
                       
                       if (targetDl) {
                           processList(targetDl, newPath);
                       }
                   } else if (a) {
                       // It is a Link
                       // Determine category name from path
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
        
        // Start processing from root DLs
        const rootDls = doc.querySelectorAll('body > dl, dl'); 
        // We only want the top-level DL usually, but DOMParser might put it anywhere.
        // Usually `doc.querySelector('dl')` gets the first one which is root.
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
                alert(`成功导入 ${importData.length} 个文件夹的书签！`);
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      
      {/* Header */}
      <div className="shrink-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 gap-2 sm:gap-0 overflow-x-auto">
         <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
               <LayoutGrid size={20} />
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">导航管理</h1>
         </div>
         
         <div className="flex items-center gap-2 shrink-0">
             <button 
               onClick={handleRestoreDefaults}
               className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm font-medium transition-colors border border-yellow-200 dark:border-yellow-700/30"
               title="重置为默认数据"
             >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">重置默认</span>
             </button>

             <button 
               onClick={handleClearAll}
               className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-200 dark:border-red-700/30"
               title="清空所有数据"
             >
                <Trash2 size={16} />
                <span className="hidden sm:inline">清空</span>
             </button>

             <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

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
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
             >
                <Upload size={16} />
                <span className="hidden sm:inline">导入书签</span>
             </button>
             <button 
               onClick={handleExport}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
             >
                <Download size={16} />
                <span className="hidden sm:inline">导出</span>
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar: Categories */}
         <div className="w-64 md:w-80 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">分类列表</span>
               <button 
                 onClick={onAddCategory}
                 className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors"
                 title="添加分类"
               >
                 <FolderPlus size={16} />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
               {categories.map(cat => (
                  <div 
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm
                       ${selectedCategoryId === cat.id 
                         ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                         : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                       }
                    `}
                  >
                     <div className="flex items-center gap-3 truncate">
                        <span className="opacity-70">
                            {cat.title.startsWith('书签栏') ? <Folder size={18} className="text-yellow-500" /> : cat.icon}
                        </span>
                        <div className="flex flex-col truncate">
                            <span className="truncate font-medium">{cat.title.replace('书签栏/', '')}</span>
                            {cat.title.startsWith('书签栏') && cat.title !== '书签栏' && (
                                <span className="text-[10px] text-slate-400 truncate">{cat.title}</span>
                            )}
                        </div>
                        {cat.title.startsWith('书签栏') && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ml-auto shrink-0">置顶</span>
                        )}
                     </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }}
                          className="p-1 hover:text-blue-500 text-slate-400"
                        >
                           <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                          className="p-1 hover:text-red-500 text-slate-400"
                        >
                           <Trash2 size={12} />
                        </button>
                     </div>
                  </div>
               ))}
               {categories.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                     暂无分类，请点击右上角添加
                  </div>
               )}
            </div>
         </div>

         {/* Main: Links */}
         <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 min-w-0">
             {activeCategory ? (
               <>
                 <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{activeCategory.title}</h2>
                       <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {activeCategory.links.length}
                       </span>
                    </div>
                    <button 
                       onClick={() => onAddLink(activeCategory.id)}
                       className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                    >
                       <Plus size={16} /> 添加链接
                    </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
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
                               className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 flex items-start gap-4 hover:shadow-md transition-all"
                             >
                                <div className="shrink-0 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-500">
                                   {link.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex items-start justify-between">
                                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">{link.title}</h3>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button onClick={() => onEditLink(link)} className="p-1 text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                                         <button onClick={() => onDeleteLink(link.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                      </div>
                                   </div>
                                   <a 
                                     href={link.url} 
                                     target="_blank" 
                                     rel="noreferrer" 
                                     className="text-xs text-blue-500 hover:underline truncate block mt-1 flex items-center gap-1"
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
                  <p>请选择左侧分类进行管理</p>
               </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default BookmarkManager;