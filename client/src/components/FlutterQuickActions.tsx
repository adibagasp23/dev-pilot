interface FlutterQuickActionsProps {
  processId: number;
  onSend: (processId: number, key: string) => void;
}

const ACTIONS = [
  { key: 'r', label: '🔥 Hot Reload', title: 'Hot reload' },
  { key: 'R', label: '🔄 Restart', title: 'Hot restart' },
  { key: 'c', label: '🧹 Clear', title: 'Clear screen' },
  { key: 'q', label: '✕ Quit', title: 'Quit app' },
  { key: 'h', label: '💡 Help', title: 'Show commands' },
  { key: 'v', label: '🔧 DevTools', title: 'Open DevTools' },
];

export default function FlutterQuickActions({ processId, onSend }: FlutterQuickActionsProps) {
  return (
    <div className="flex gap-1 flex-wrap px-3 py-1.5">
      {ACTIONS.map((btn) => (
        <button
          key={btn.key}
          onClick={() => onSend(processId, btn.key)}
          title={btn.title}
          className="text-[11px] px-2 py-0.5 rounded transition hover:text-green-400"
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            color: '#8b949e',
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
