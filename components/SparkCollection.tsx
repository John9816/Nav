import React, { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import {
  BookOpen,
  Bold,
  Code,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  LogIn,
  Minus,
  PenSquare,
  Plus,
  Quote,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Spark } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { deleteSpark, fetchSparks, saveSpark, updateSpark } from '../services/sparkService';

interface SparkCollectionProps {
  onAuthRequest: () => void;
}

const EMPTY_NOTE_TEMPLATE = `# 新笔记

在这里记录你的灵感、待办、会议纪要或草稿。`;

const normalizeContent = (value: string) => value.replace(/\s+$/, '');

const getNoteTitle = (content: string) => {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const firstLine = lines.find(line => line !== '---' && line !== '***' && line !== '___');
  if (!firstLine) return '未命名笔记';
  return firstLine.replace(/^#+\s*/, '').slice(0, 36) || '未命名笔记';
};

const getNoteExcerpt = (content: string) => {
  const plainText = content
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>\-\[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return '暂无内容';
  return plainText.slice(0, 72);
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const SparkCollection: React.FC<SparkCollectionProps> = ({ onAuthRequest }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Spark[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState(EMPTY_NOTE_TEMPLATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedNote = notes.find(note => note.id === selectedId) || null;
  const baselineContent = selectedNote?.content ?? EMPTY_NOTE_TEMPLATE;
  const isDirty = normalizeContent(draftContent) !== normalizeContent(baselineContent);

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return notes;

    return notes.filter(note => {
      const title = getNoteTitle(note.content).toLowerCase();
      const content = note.content.toLowerCase();
      return title.includes(query) || content.includes(query);
    });
  }, [notes, searchQuery]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image,
      Placeholder.configure({
        placeholder: '直接输入，或用 #、-、1.、``` 这些 Markdown 语法开始编辑。',
      }),
      Markdown,
    ],
    content: EMPTY_NOTE_TEMPLATE,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'tiptap-editor__content',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setDraftContent(currentEditor.getMarkdown());
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!saving && user && isDirty && draftContent.trim()) {
          void handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, user, isDirty, draftContent, selectedId]);

  useEffect(() => {
    if (!editor) return;

    const nextContent = selectedNote?.content ?? EMPTY_NOTE_TEMPLATE;
    if (normalizeContent(editor.getMarkdown()) === normalizeContent(nextContent)) {
      return;
    }

    editor.commands.setContent(nextContent, { contentType: 'markdown' });
    setDraftContent(nextContent);
  }, [editor, selectedId, selectedNote?.content]);

  const loadNotes = async () => {
    if (!user) {
      setNotes([]);
      setSelectedId(null);
      setDraftContent(EMPTY_NOTE_TEMPLATE);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchSparks(user.id);
      const textNotes = data.filter(note => note.type === 'text');
      const nextSelected = textNotes.find(note => note.id === selectedId) || textNotes[0] || null;

      setNotes(textNotes);
      setSelectedId(nextSelected?.id ?? null);
    } catch (error) {
      console.error('Failed to load notes', error);
      setNotes([]);
      setSelectedId(null);
      setDraftContent(EMPTY_NOTE_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [user?.id]);

  const openNote = (note: Spark | null) => {
    if (isDirty && !confirm('当前笔记尚未保存，确定要切换吗？')) {
      return;
    }

    setSelectedId(note?.id ?? null);
  };

  const handleCreateNote = () => {
    openNote(null);
  };

  const handleSave = async () => {
    if (!user || !editor) return;

    const content = normalizeContent(editor.getMarkdown());
    if (!content.trim()) return;

    setSaving(true);
    try {
      if (selectedNote) {
        const updated = await updateSpark(selectedNote.id, content);
        setNotes(prev => [updated, ...prev.filter(note => note.id !== updated.id)]);
        setSelectedId(updated.id);
      } else {
        const created = await saveSpark(user.id, 'text', content);
        setNotes(prev => [created, ...prev]);
        setSelectedId(created.id);
      }
      setDraftContent(content);
    } catch (error) {
      console.error('Failed to save note', error);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!confirm('确定要删除这条笔记吗？')) return;

    setDeleting(true);
    try {
      await deleteSpark(selectedNote.id);
      const remainingNotes = notes.filter(note => note.id !== selectedNote.id);
      const nextSelected = remainingNotes[0] || null;

      setNotes(remainingNotes);
      setSelectedId(nextSelected?.id ?? null);
      setDraftContent(nextSelected?.content ?? EMPTY_NOTE_TEMPLATE);
    } catch (error) {
      console.error('Failed to delete note', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  const promptForLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('输入链接地址', previousUrl);
    if (url === null) return;

    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const promptForImage = () => {
    if (!editor) return;

    const src = window.prompt('输入图片地址');
    if (!src) return;
    editor.chain().focus().setImage({ src: src.trim() }).run();
  };

  const toolbarButtonClass = (active: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-colors ${
      active
        ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300'
        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
    }`;

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-xl shadow-slate-200/40 dark:shadow-none p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <BookOpen size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">灵感记录</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
            这是一个单一编辑框。非程序员可以直接点工具栏排版，程序员可以直接输入 Markdown 语法，编辑器会在同一个区域即时生效。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">单一编辑框</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">富文本操作</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">Markdown 输入规则</span>
          </div>
          <button
            onClick={onAuthRequest}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500"
          >
            <LogIn size={16} />
            <span>登录后开始记录</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <aside className="w-full max-w-full md:max-w-80 lg:max-w-96 shrink-0 border-r border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md flex flex-col">
        <div className="border-b border-slate-200/70 dark:border-slate-800/70 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <BookOpen size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">灵感记录</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">共 {notes.length} 条 Markdown 笔记</p>
              </div>
            </div>
            <button
              onClick={handleCreateNote}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:text-blue-400"
              title="新建笔记"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="relative mt-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索笔记标题或内容"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">加载笔记中...</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900/60">
              <PenSquare size={24} />
              <p className="text-sm">{notes.length === 0 ? '还没有笔记，先写第一条。' : '没有匹配的笔记。'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotes.map(note => {
                const active = note.id === selectedId;
                return (
                  <button
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                      active
                        ? 'border-blue-200 bg-blue-50/90 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10'
                        : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
                        {getNoteTitle(note.content)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {getNoteExcerpt(note.content)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
                      <span>最近保存</span>
                      <span>{formatDate(note.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4 md:px-6 md:py-6">
          <div className="rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-slate-200/70 dark:border-slate-800/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedNote ? getNoteTitle(selectedNote.content) : '新建笔记'}
                  </h2>
                  {isDirty && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      未保存
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  同一个编辑框同时支持工具栏排版和 Markdown 快捷输入，例如 `#` 标题、`-` 列表、``` ``` 代码块。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving || !draftContent.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{selectedNote ? '保存修改' : '保存笔记'}</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!selectedNote || deleting}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:text-red-400"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>删除</span>
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200/70 dark:border-slate-800/70 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={toolbarButtonClass(!!editor?.isActive('bold'))}
                  title="粗体"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={toolbarButtonClass(!!editor?.isActive('italic'))}
                  title="斜体"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={toolbarButtonClass(!!editor?.isActive('heading', { level: 1 }))}
                  title="一级标题"
                >
                  <Heading1 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={toolbarButtonClass(!!editor?.isActive('heading', { level: 2 }))}
                  title="二级标题"
                >
                  <Heading2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={toolbarButtonClass(!!editor?.isActive('bulletList'))}
                  title="无序列表"
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={toolbarButtonClass(!!editor?.isActive('orderedList'))}
                  title="有序列表"
                >
                  <ListOrdered size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  className={toolbarButtonClass(!!editor?.isActive('blockquote'))}
                  title="引用"
                >
                  <Quote size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                  className={toolbarButtonClass(!!editor?.isActive('codeBlock'))}
                  title="代码块"
                >
                  <Code size={15} />
                </button>
                <button
                  type="button"
                  onClick={promptForLink}
                  className={toolbarButtonClass(!!editor?.isActive('link'))}
                  title="链接"
                >
                  <Link2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={promptForImage}
                  className={toolbarButtonClass(false)}
                  title="图片"
                >
                  <ImagePlus size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                  className={toolbarButtonClass(false)}
                  title="分割线"
                >
                  <Minus size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                  <Sparkles size={12} />
                  同一个编辑框
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"># 空格生成标题</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">- 空格生成列表</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">``` 生成代码块</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Ctrl/⌘ + S 保存</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="tiptap-editor min-h-full rounded-3xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-700/70 dark:bg-slate-950/30">
                {editor ? <EditorContent editor={editor} /> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SparkCollection;
