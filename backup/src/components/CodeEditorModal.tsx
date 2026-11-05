import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { Info, Loader2, Save, Wand2 } from 'lucide-react';
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
  { tag: tags.comment, color: '#838690', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null], color: '#FCD34D' },
  { tag: [tags.function(tags.definition(tags.variableName)), tags.function(tags.variableName)], color: '#F9A8D4' },
  { tag: [tags.className, tags.definition(tags.className)], color: '#A5F3FC' },
  { tag: [tags.self, tags.special(tags.variableName)], color: '#FDBA74' },
  { tag: [tags.variableName, tags.propertyName, tags.operator, tags.punctuation], color: '#E5E7EB' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: '#0C0E14', color: '#F2F4F7' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace', lineHeight: '1.5' },
  '.cm-gutters': { backgroundColor: '#0C0E14', color: '#5C6170', border: 'none', paddingLeft: '8px' },
  '.cm-activeLine': { backgroundColor: '#FFFFFF08' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#C9CDD6' },
  '.cm-content': { padding: '12px 0' },
  '.cm-cursor': { borderLeftColor: '#83E8C3' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#F6C6A638' },
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

  // Sits under the terminal's header bar, whose button switches back, so the brief stays
  // readable beside it and the switch never moves.
  return (
    <div className="fade-in absolute inset-x-0 bottom-0 top-10 z-20 flex flex-col bg-[#0C0E14]" role="dialog" aria-label={`Code editor: ${filename}`}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-[13px] font-semibold text-slate-100">~/{filename}</div>
            <div className="truncate text-[11px] text-slate-400">Save writes this file, the one the brief asks for</div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400 lg:inline">Python · 4 spaces</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={fixIndentation}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            title="Turn tabs into four spaces and remove trailing spaces"
          >
            <Wand2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tidy indentation</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Save'}
            <kbd className="hidden rounded bg-slate-900/10 px-1 font-sans text-[0.7rem] font-medium text-slate-500 sm:inline">Ctrl S</kbd>
          </button>
        </div>
      </div>
      {note && (
        <div className="flex items-start gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs leading-5 text-slate-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {note}
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-4 text-xs text-slate-500">
        <span className="tabular">Ln {cursor.line}, Col {cursor.col}</span>
        <span role="status" className={saveMessage?.startsWith('Saved') ? 'text-emerald-400' : 'text-amber-300'}>{saveMessage ?? ''}</span>
        <span className="hidden truncate md:inline">
          Esc goes back to the terminal · then run <code className="font-mono text-slate-300">submit ~/{filename}</code>
        </span>
      </div>
    </div>
  );
};

export default CodeEditorModal;
