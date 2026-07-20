import { useMemo } from 'react';

interface Props {
  log: string;
}

interface OverlayEntry {
  file: string;
  route: string;
}

export default function DebugOverlayBadges({ log }: Props) {
  const { overlay, sections } = useMemo(() => {
    let overlay: OverlayEntry | null = null;
    const sections: string[] = [];

    if (!log) return { overlay: null, sections: [] };

    const lines = log.split('\n');
    const seenSections = new Set<string>();

    // Scan backwards: first find the latest overlay, then collect sections
    // that belong to that overlay (stop at previous overlay)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      if (!overlay) {
        // Find the most recent [📁 Overlay] first
        const overlayMatch = line.match(/(?:I\/flutter\s*\(\d+\)\s*:)?\s*\[📁\s*Overlay\]\s+(\S+)\s+\|\s+(\S+)/);
        if (overlayMatch) {
          overlay = { file: overlayMatch[1], route: overlayMatch[2] };
        }
        continue;
      }

      // Once overlay found, stop at previous overlay
      if (line.includes('[📁 Overlay]')) break;

      // Collect sections within this overlay's scope
      const sectionMatch = line.match(/(?:I\/flutter\s*\(\d+\)\s*:)?\s*\[📄\s*Section\]\s+(\S+)/);
      if (sectionMatch && !seenSections.has(sectionMatch[1])) {
        seenSections.add(sectionMatch[1]);
        sections.unshift(sectionMatch[1]);
      }
    }

    return { overlay, sections };
  }, [log]);

  return (
    <div
      className="flex gap-1.5 px-3 py-2 flex-wrap items-center"
      style={{
        backgroundColor: '#0d1117',
        borderTop: '1px solid #21262d',
      }}
    >
      <span className="text-[10px] text-gray-500 mr-1">🧩</span>

      {/* Overlay badge — copy overlay file */}
      {overlay && (
        <button
          onClick={() => navigator.clipboard.writeText(overlay.file)}
          title={`Click to copy: ${overlay.file}\nRoute: ${overlay.route}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition hover:opacity-80 active:scale-95"
          style={{
            backgroundColor: '#0d3b3b',
            color: '#5eead4',
            border: '1px solid #115e59',
          }}
        >
          <span>📍</span>
          <span>{overlay.file}</span>
          {overlay.route !== '/' && (
            <span className="text-[9px] opacity-60 ml-0.5">{overlay.route}</span>
          )}
        </button>
      )}

      {/* Section badges — copy overlay > section */}
      {sections.length > 0 && sections.map((file) => (
          <button
            key={file}
            onClick={() => navigator.clipboard.writeText(overlay ? `${overlay.file} > ${file}` : file)}
            title={`Click to copy: ${overlay ? `${overlay.file} > ` : ''}${file}`}
            className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition hover:opacity-80 active:scale-95"
            style={{
              backgroundColor: '#1a3a2a',
              color: '#6ee7b7',
              border: '1px solid #166534',
            }}
          >
            <span>📄</span>
            <span>{file}</span>
          </button>
        ))}
    </div>
  );
}
