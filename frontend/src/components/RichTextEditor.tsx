import { useEffect } from 'react';
import './review-rich-text.css';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, Highlighter, List, ListOrdered, Undo2, Redo2 } from 'lucide-react';

export function safeCommentHtml(value: string) {
  const html = /<\/?[a-z][^>]*>/i.test(value) ? value : value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'mark', 'ul', 'ol', 'li'], ALLOWED_ATTR: [] });
}

export function RichTextEditor({ value, onChange, disabled = false, label }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  const editor = useEditor({
    extensions: [StarterKit, Highlight], content: safeCommentHtml(value), editable: !disabled, shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'review-rich-text min-h-28 p-3 outline-none text-sm font-normal', role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } },
    onUpdate: ({ editor: current }) => onChange(safeCommentHtml(current.getHTML()))
  });
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (editor && safeCommentHtml(editor.getHTML()) !== safeCommentHtml(value)) editor.commands.setContent(safeCommentHtml(value), { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return null;
  const commands = [
    { name: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { name: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { name: 'Underline', icon: Underline, active: editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { name: 'Highlight', icon: Highlighter, active: editor.isActive('highlight'), run: () => editor.chain().focus().toggleHighlight().run() },
    { name: 'Bulleted list', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { name: 'Numbered list', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { name: 'Undo', icon: Undo2, active: false, run: () => editor.chain().focus().undo().run() },
    { name: 'Redo', icon: Redo2, active: false, run: () => editor.chain().focus().redo().run() }
  ];
  return <div className="mt-1 overflow-hidden rounded-md border border-slate-300 bg-white">
    <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1">
      {commands.map(({ name, icon: Icon, active, run }) => <button key={name} type="button" title={name} aria-label={name} aria-pressed={active} disabled={disabled} onClick={run} className={`flex h-8 w-8 items-center justify-center rounded disabled:opacity-40 ${active ? 'bg-red-100 text-red-700' : 'text-slate-700 hover:bg-slate-200'}`}><Icon className="h-4 w-4" /></button>)}
    </div>
    <EditorContent editor={editor} />
  </div>;
}
