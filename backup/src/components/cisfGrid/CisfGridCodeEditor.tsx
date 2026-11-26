import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { Check, FileCode2, Loader2, RefreshCw, Save } from 'lucide-react';
import { WORKSPACE_FILES } from './types';

interface CisfGridCodeEditorProps {
  filename: string;
  onSelectFile: (name: string) => void;
  loadFile: (name: string) => Promise<string>;
  saveFile: (name: string, content: string) => Promise<void>;
  recommendedFiles: string[];
}

const MAX_BYTES = 256 * 1024;

const darkHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#93C5FD', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: '#86EFAC' },
  { tag: tags.comment, color: '#838690', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null], color: '#FCD34D' },
  { tag: [tags.propertyName, tags.variableName, tags.operator, tags.punctuation], color: '#E5E7EB' },
]);

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', backgroundColor: '#0C0E14', color: '#F2F4F7' },
    '.cm-scroller': {
      fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace',
      lineHeight: '1.5',
    },
    '.cm-gutters': { backgroundColor: '#0C0E14', color: '#5C6170', border: 'none', paddingLeft: '8px' },
    '.cm-activeLine': { backgroundColor: '#FFFFFF08' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#C9CDD6' },
    '.cm-content': { padding: '12px 0' },
    '.cm-cursor': { borderLeftColor: '#83E8C3' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#F6C6A638' },
  },
  { dark: true },
);

function normalizeLf(raw: string): string {
  const noBom = raw.startsWith('\ufeff') ? raw.slice(1) : raw;
  return noBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export const CisfGridCodeEditor: React.FC<CisfGridCodeEditorProps> = ({
  filename,
  onSelectFile,
  loadFile,
  saveFile,
  recommendedFiles,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const loadSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [loadedText, setLoadedText] = useState('');

  const handleSave = useCallback(async () => {
    const view = viewRef.current;
    if (!view || saving) return;
    const text = normalizeLf(view.state.doc.toString());
    if (new TextEncoder().encode(text).length > MAX_BYTES) {
      setErrorMsg('File exceeds the 256 KiB workspace limit.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await saveFile(filename, text);
      setDirty(false);
      setStatusMsg(`Saved ~/workspace/${filename}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : `Could not save ${filename}.`);
    } finally {
      setSaving(false);
    }
  }, [filename, saveFile, saving]);

  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  const fetchContent = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const content = await loadFile(filename);
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setLoadedText(normalizeLf(content));
      setDirty(false);
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : `Could not load ${filename}.`);
      setLoadedText('');
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [filename, loadFile]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const otherWorkspaceFiles = WORKSPACE_FILES.filter((f) => !recommendedFiles.includes(f));
  const includeCurrentExtra = !recommendedFiles.includes(filename) && !WORKSPACE_FILES.includes(filename);

  const handleFileChange = (nextFile: string) => {
    if (nextFile === filename) return;
    if (dirty && !window.confirm(`Discard unsaved changes in ~/workspace/${filename} and open ${nextFile}?`)) {
      return;
    }
    onSelectFile(nextFile);
  };

  useEffect(() => {
    if (!hostRef.current || loading) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: loadedText,
        extensions: [
          basicSetup,
          syntaxHighlighting(darkHighlight),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          keymap.of([indentWithTab]),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-s',
                preventDefault: true,
                run: () => {
                  void saveRef.current();
                  return true;
                },
              },
            ]),
          ),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setDirty(true);
              setStatusMsg(null);
            }
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
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [loadedText, loading]);

  return (
    <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-[#0C0E14] text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-4 w-4 shrink-0 text-brand-300" />
          <label htmlFor="cisf-workspace-file-select" className="sr-only">
            Workspace file
          </label>
          <select
            id="cisf-workspace-file-select"
            value={filename}
            onChange={(e) => handleFileChange(e.target.value)}
            className="rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            {includeCurrentExtra && (
              <option key={`cur-${filename}`} value={filename}>
                {filename}
              </option>
            )}
            {recommendedFiles.length > 0 && (
              <optgroup label="Current module artifacts">
                {recommendedFiles.map((f) => (
                  <option key={`rec-${f}`} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other workspace files">
              {otherWorkspaceFiles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </optgroup>
          </select>
          {dirty && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void fetchContent()}
            disabled={loading || saving}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Reload file from container workspace"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save'}
            <kbd className="hidden rounded bg-slate-900/10 px-1 font-sans text-[10px] font-medium text-slate-600 sm:inline">
              Ctrl S
            </kbd>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="border-b border-rose-500/30 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading ~/workspace/{filename}...
        </div>
      ) : (
        <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
      )}

      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-t border-white/10 px-3 text-xs text-slate-400">
        <span className="tabular">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span role="status" className="inline-flex items-center gap-1 text-mint-300">
          {statusMsg && (
            <>
              <Check className="h-3.5 w-3.5" />
              {statusMsg}
            </>
          )}
        </span>
        <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">LF normalized · 256 KiB cap</span>
      </div>
    </div>
  );
};
