import { useState } from 'react';

interface TerminalInputProps {
  processId: number;
  onSend: (processId: number, value: string) => void;
}

export default function TerminalInput({ processId, onSend }: TerminalInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    onSend(processId, value);
    setValue('');
  };

  return (
    <div
      className="flex gap-1 items-center px-3 py-2"
      style={{
        backgroundColor: '#0d1117',
        borderTop: '1px solid #374151',
      }}
    >
      <span className="text-gray-500 text-xs leading-6">❯</span>
      <input
        type="text"
        placeholder="Input..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
        className="flex-1 text-green-400 text-xs px-2 py-1 outline-none font-mono"
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '4px',
          color: '#4ade80',
        }}
      />
      <button
        onClick={handleSend}
        className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-500 transition"
      >
        Kirim
      </button>
    </div>
  );
}
