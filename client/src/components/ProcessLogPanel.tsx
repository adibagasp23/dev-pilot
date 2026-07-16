import { useRef, useEffect, useCallback } from 'react';
import FlutterQuickActions from './FlutterQuickActions';
import TerminalInput from './TerminalInput';

interface ProcessLogPanelProps {
  processId: number;
  log: string;
  projectType?: string;
  onSend: (processId: number, value: string) => void;
  onCopyAll: () => void;
  onCopyVisible: () => void;
  onClear: () => void;
}

export default function ProcessLogPanel({ processId, log, projectType, onSend, onCopyAll, onCopyVisible, onClear }: ProcessLogPanelProps) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const userScrolled = useRef(false);

  const handleScroll = useCallback(() => {
    const pre = preRef.current;
    if (!pre) return;
    const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 50;
    userScrolled.current = !atBottom;
  }, []);

  useEffect(() => {
    if (!userScrolled.current && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="rounded-lg overflow-hidden shadow-lg" style={{ border: '1px solid #374151' }}>
      {/* Terminal header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: '#0d1117',
          borderBottom: '1px solid #374151',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500 ml-2">terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyAll}
            className="text-xs text-gray-500 hover:text-emerald-400 transition cursor-pointer"
            title="Copy full log"
          >
            📋 All
          </button>
          <button
            onClick={onCopyVisible}
            className="text-xs text-gray-500 hover:text-emerald-400 transition cursor-pointer"
            title="Copy visible area"
          >
            👁 View
          </button>
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-400 transition cursor-pointer"
            title="Clear terminal"
          >
            🗑 Clear
          </button>
        </div>
      </div>
      {/* Output */}
      <pre
        ref={preRef}
        onScroll={handleScroll}
        className="text-xs p-4 overflow-auto max-h-[70vh] min-h-[16rem] font-mono leading-relaxed select-text"
        style={{
          backgroundColor: '#0d1117',
          color: '#4ade80',
          userSelect: 'text',
        }}
      >
        {log || 'Waiting for output...'}
      </pre>
      {/* Quick action buttons */}
      {(projectType === 'flutter') && (
        <div
          className="flex gap-1 px-3 py-1.5 flex-wrap"
          style={{
            backgroundColor: '#0d1117',
            borderTop: '1px solid #21262d',
          }}
        >
          <FlutterQuickActions
            processId={processId}
            onSend={onSend}
          />
        </div>
      )}
      <TerminalInput
        processId={processId}
        onSend={onSend}
      />
    </div>
  );
}
