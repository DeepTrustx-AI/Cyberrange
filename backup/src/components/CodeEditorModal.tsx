import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { Loader2, Save, Wand2, X } from 'lucide-react';
import { tidyIndentation } from './terminalEditor';

interface CodeEditorModalProps {
  filename: string;
  initialText: string;
  note?: string;
  saving: boolean;
  saveMessage?: string | null;
  onSave: (text: string) => void;
  onChange: (text: string) => void;
  onClose: () => void;
}

const darkHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.operatorKeyword], color: '#93C5FD', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: '#86EFAC' },
  { tag: tags.comment, color: '#94A3B8', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null], color: '#FCD34D' },
  { tag: [tags.function(tags.definition(tags.variableName)), tags.function(tags.variableName)], color: '#F9A8D4' },
  { tag: [tags.className, tags.definition(tags.className)], color: '#A5F3FC' },
  { tag: [tags.self, tags.special(tags.variableName)], color: '#FDBA74' },
  { tag: [tags.variableName, tags.propertyName, tags.operator, tags.punctuation], color: '#E5E7EB' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: '#0B0F17', color: '#F3F4F6' },
  '.cm-scroller': { fontFamily: 'Fira Code, Menlo, Monaco, Consolas, "Courier New", monospace', lineHeight: '1.5' },
  '.cm-gutters': { backgroundColor: '#111827', color: '#6B7280', border: 'none' },
  '.cm-activeLine': { backgroundColor: '#1F293780' },
  '.cm-activeLineGutter': { backgroundColor: '#1F2937' },
  '.cm-cursor': { borderLeftColor: '#60A5FA' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#1D4ED866' },
}, { dark: true });

const CodeEditorModal: React.FC<CodeEditorModalProps> = ({
  filename, initialText, note, saving, saveMessage, onSave, onChange, onClose,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const currentText = useCallback(() => viewRef.current?.state.doc.toString() ?? '', []);

  const save = useCallback(() => {
    const tidy = tidyIndentation(currentText());
    const view = viewRef.current;
    if (view && tidy !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: tidy } });
    }
    onSave(tidy);
  }, [currentText, onSave]);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          basicSetup,
          python(),
          syntaxHighlighting(darkHighlight),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          keymap.of([indentWithTab]),
          Prec.highest(keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => { saveRef.current(); return true; } },
            { key: 'Escape', run: () => { closeRef.current(); return true; } },
          ])),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setCursor({ line: line.number, col: head - line.from + 1 });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialText]);

  const fixIndentation = () => {
    const view = viewRef.current;
    if (!view) return;
    const tidy = tidyIndentation(view.state.doc.toString());
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: tidy } });
    view.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"
         aria-label={`Code editor: ${filename}`}>
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0B0F17] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#111827] px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-bold text-slate-200">{filename}</div>
            <div className="text-[11px] text-slate-500">
              Python · 4 spaces<span className="hidden sm:inline"> · Tab indents, Shift+Tab outdents · Ctrl+S saves · Esc closes</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={fixIndentation}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                    title="Turn tabs into four spaces and remove trailing spaces">
              <Wand2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Fix indentation</span>
            </button>
            <button type="button" onClick={save} disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save to workspace'}</span>
            </button>
            <button type="button" onClick={onClose}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close (your draft is kept)"
                    aria-label="Close editor (your draft is kept)">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {note && <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-1.5 text-xs text-amber-300">{note}</div>}
        <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
        <div className="flex items-center justify-between border-t border-slate-800 bg-[#111827] px-4 py-1.5 text-[11px] text-slate-500">
          <span>Ln {cursor.line}, Col {cursor.col}</span>
          <span role="status" className={saveMessage?.startsWith('Saved') ? 'text-emerald-400' : 'text-amber-300'}>{saveMessage ?? ''}</span>
          <span className="hidden md:inline">When you are done, run <code className="font-mono text-slate-300">submit {filename.split('/').pop()}</code> in the terminal.</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorModal;
