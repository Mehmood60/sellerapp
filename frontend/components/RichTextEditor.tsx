'use client';

/**
 * RichTextEditor — crash-safe WYSIWYG editor.
 *
 * The contentEditable div is created imperatively via DOM APIs inside a
 * useEffect, so it is NEVER part of React's virtual DOM. React therefore has
 * no knowledge of the browser-managed child nodes and will never attempt a
 * removeChild reconciliation on them — which is the root cause of the
 * "removeChild: The node is not a child" crash.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function Btn({
  onMouseDown,
  title,
  children,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className="px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors select-none"
    >
      {children}
    </button>
  );
}

const Sep = () => (
  <div className="w-px h-4 bg-gray-300 mx-0.5 self-center shrink-0" />
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  defaultValue: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ defaultValue, onChange }: Props) {
  // The React-managed slot where we will imperatively append the editor div
  const slotRef     = useRef<HTMLDivElement>(null);
  // Direct reference to the imperative contentEditable div
  const editorRef   = useRef<HTMLDivElement | null>(null);
  // Always points to the latest onChange without needing to be in effect deps
  const onChangeFn  = useRef(onChange);
  onChangeFn.current = onChange;

  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(defaultValue ?? '');

  // ── Create the editor outside React's vDOM ────────────────────────────────
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.style.minHeight = '200px';
    div.style.padding   = '10px 12px';
    div.style.outline   = 'none';
    div.style.wordBreak = 'break-word';
    div.style.fontSize  = '14px';
    div.style.lineHeight = '1.6';
    div.innerHTML = defaultValue ?? '';

    const fire = () => onChangeFn.current(div.innerHTML);
    div.addEventListener('input', fire);
    div.addEventListener('blur',  fire);

    slot.appendChild(div);
    editorRef.current = div;

    return () => {
      div.removeEventListener('input', fire);
      div.removeEventListener('blur',  fire);
      if (slot.contains(div)) slot.removeChild(div);
      editorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── execCommand wrapper ───────────────────────────────────────────────────

  const exec = (e: React.MouseEvent, cmd: string, val?: string) => {
    e.preventDefault(); // keep focus in editor
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    onChangeFn.current(editorRef.current?.innerHTML ?? '');
  };

  // ── Source / visual toggle ────────────────────────────────────────────────

  const toggleSource = () => {
    if (!showSource) {
      // Entering source mode: snapshot current visual HTML, hide editor
      const html = editorRef.current?.innerHTML ?? '';
      setSourceHtml(html);
      if (editorRef.current) editorRef.current.style.display = 'none';
    } else {
      // Returning to visual mode: push source HTML into editor, show it
      if (editorRef.current) {
        editorRef.current.innerHTML = sourceHtml;
        editorRef.current.style.display = '';
      }
      onChangeFn.current(sourceHtml);
    }
    setShowSource(v => !v);
  };

  const b = (cmd: string, val?: string) => (ev: React.MouseEvent) =>
    exec(ev, cmd, val);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-300 transition-shadow">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
        <Btn onMouseDown={b('bold')}      title="Fett (Strg+B)">      <strong>B</strong>                        </Btn>
        <Btn onMouseDown={b('italic')}    title="Kursiv (Strg+I)">    <em className="italic font-medium">I</em> </Btn>
        <Btn onMouseDown={b('underline')} title="Unterstrichen">      <span className="underline">U</span>      </Btn>
        <Sep />
        <Btn onMouseDown={b('formatBlock', 'h2')} title="Überschrift">    <span className="font-bold">H2</span></Btn>
        <Btn onMouseDown={b('formatBlock', 'h3')} title="Unterüberschrift"><span className="font-bold">H3</span></Btn>
        <Btn onMouseDown={b('formatBlock', 'p')}  title="Absatz">         <span>¶</span>                       </Btn>
        <Sep />
        <Btn onMouseDown={b('insertUnorderedList')} title="Aufzählungsliste">• Liste</Btn>
        <Btn onMouseDown={b('insertOrderedList')}   title="Nummerierte Liste">1. Liste</Btn>
        <Sep />
        <Btn onMouseDown={b('undo')} title="Rückgängig (Strg+Z)">↩</Btn>
        <Btn onMouseDown={b('redo')} title="Wiederholen (Strg+Y)">↪</Btn>
        <Sep />
        <Btn onMouseDown={b('removeFormat')} title="Formatierung entfernen">
          <span className="line-through text-gray-400">A</span>
        </Btn>

        <div className="ml-auto">
          <button
            type="button"
            onClick={toggleSource}
            title={showSource ? 'Visuell bearbeiten' : 'HTML-Quelltext anzeigen'}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
              showSource
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
          >
            &lt;/&gt;
          </button>
        </div>
      </div>

      {/* ── Editor slot ──────────────────────────────────────────────────
          React only knows about this empty <div> container.
          The actual contentEditable div lives inside it but was created
          via DOM API — completely invisible to React's reconciler.       */}
      <div
        ref={slotRef}
        className="prose prose-sm max-w-none"
      />

      {/* ── HTML source textarea ─────────────────────────────────────── */}
      {showSource && (
        <textarea
          value={sourceHtml}
          onChange={e => {
            setSourceHtml(e.target.value);
            onChangeFn.current(e.target.value);
          }}
          rows={10}
          spellCheck={false}
          className="w-full px-3 py-2.5 text-xs font-mono text-gray-700 focus:outline-none resize-y bg-white border-t border-gray-100"
          placeholder="HTML-Code hier eingeben…"
        />
      )}
    </div>
  );
}
