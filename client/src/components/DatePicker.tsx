import { useState, useRef, useEffect, useCallback } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [popupUp, setPopupUp] = useState(false);
  const [popupRight, setPopupRight] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months' | 'years'>('days');
  const ref = useRef<HTMLDivElement>(null);

  // Parse value: try with time (ISO) or date-only
  const parseValue = (val: string) => {
    if (!val) {
      const now = new Date();
      return { date: null, hours: now.getHours(), minutes: now.getMinutes() };
    }
    // Handle formats: "YYYY-MM-DDTHH:MM", "YYYY-MM-DD HH:MM", "YYYY-MM-DD"
    const cleaned = val.replace(' ', 'T');
    const d = new Date(cleaned + (cleaned.includes('T') ? ':00' : 'T00:00:00'));
    if (isNaN(d.getTime())) {
      const now = new Date();
      return { date: null, hours: now.getHours(), minutes: now.getMinutes() };
    }
    return { date: d, hours: d.getHours(), minutes: d.getMinutes() };
  };

  const parsed = parseValue(value);
  const selected = parsed.date;
  const [viewMonth, setViewMonth] = useState(() => selected ? selected.getMonth() : new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => selected ? selected.getFullYear() : new Date().getFullYear());
  const [viewHour, setViewHour] = useState(parsed.hours);
  const [viewMinute, setViewMinute] = useState(parsed.minutes);

  // Sync when value changes externally
  useEffect(() => {
    const p = parseValue(value);
    if (p.date) {
      setViewMonth(p.date.getMonth());
      setViewYear(p.date.getFullYear());
    }
    setViewHour(p.hours);
    setViewMinute(p.minutes);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPickerView('days');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen(prev => {
      if (!prev) {
        setPickerView('days');
        const el = ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          setPopupUp(spaceBelow < 350);
          const spaceRight = window.innerWidth - rect.left;
          setPopupRight(spaceRight < 270);
        }
      }
      return !prev;
    });
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevUnit = useCallback(() => {
    if (pickerView === 'months') {
      setViewYear(y => y - 1);
    } else if (pickerView === 'years') {
      setViewYear(y => y - 12);
    } else {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
      else setViewMonth(m => m - 1);
    }
  }, [pickerView, viewMonth]);

  const nextUnit = useCallback(() => {
    if (pickerView === 'months') {
      setViewYear(y => y + 1);
    } else if (pickerView === 'years') {
      setViewYear(y => y + 12);
    } else {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    }
  }, [pickerView, viewMonth]);

  const handleSelect = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const h = String(viewHour).padStart(2, '0');
    const min = String(viewMinute).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}T${h}:${min}`);
    setOpen(false);
    setPickerView('days');
  };

  const handleSelectMonth = (m: number) => {
    setViewMonth(m);
    setPickerView('days');
  };

  const handleSelectYear = (y: number) => {
    setViewYear(y);
    setPickerView('months');
  };

  const isSelected = (day: number) => {
    if (!selected) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const handleOke = useCallback(() => {
    // Use selected date if exists, otherwise today
    const day = selected ? selected.getDate() : new Date().getDate();
    const m = String(selected ? selected.getMonth() + 1 : viewMonth + 1).padStart(2, '0');
    const y = selected ? selected.getFullYear() : viewYear;
    const d = String(day).padStart(2, '0');
    const h = String(viewHour).padStart(2, '0');
    const min = String(viewMinute).padStart(2, '0');
    onChange(`${y}-${m}-${d}T${h}:${min}`);
    setOpen(false);
    setPickerView('days');
  }, [selected, viewMonth, viewYear, viewHour, viewMinute, onChange]);

  const formatDisplay = (val: string) => {
    if (!val) return '';
    const cleaned = val.replace(' ', 'T');
    const d = new Date(cleaned + (cleaned.includes('T') ? ':00' : 'T00:00:00'));
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const headerLabel = pickerView === 'months'
    ? String(viewYear)
    : pickerView === 'years'
      ? `${viewYear - 5} - ${viewYear + 6}`
      : `${MONTHS[viewMonth]} ${viewYear}`;

  // Year range for year picker
  const yearStart = viewYear - 5;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <div className="relative" ref={ref}>
      {/* Input trigger */}
      <div
        onClick={toggleOpen}
        className="bg-[#0d1117] text-gray-300 text-sm px-2.5 py-1.5 rounded border border-gray-700 outline-none cursor-pointer flex items-center gap-2 w-fit min-w-[140px] hover:border-gray-500 transition"
      >
        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value ? 'text-gray-300' : 'text-gray-500'}>{value ? formatDisplay(value) : 'Set due date'}</span>
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="ml-auto text-gray-600 hover:text-gray-400 transition"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Calendar popup */}
      {open && (
        <div className={`absolute ${popupUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${popupRight ? 'right-0' : 'left-0'} z-[60] bg-[#161b22] border border-gray-700/60 rounded-xl shadow-2xl p-3 w-64`}>
          {/* Header with prev/next and clickable label */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevUnit} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setPickerView(pickerView === 'days' ? 'months' : pickerView === 'months' ? 'years' : 'days')}
              className="text-sm font-medium text-gray-200 hover:text-white hover:bg-gray-800 px-2 py-1 rounded-lg transition"
            >
              {headerLabel}
            </button>
            <button onClick={nextUnit} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {pickerView === 'days' && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const sel = isSelected(day);
                  const today = isToday(day);
                  return (
                    <button
                      key={day}
                      onClick={() => handleSelect(day)}
                      className={`w-8 h-8 text-xs rounded-lg transition flex items-center justify-center ${
                        sel
                          ? 'bg-emerald-600 text-white font-semibold'
                          : today
                            ? 'text-emerald-400 font-semibold'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {pickerView === 'months' && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectMonth(i)}
                  className={`text-xs py-2 rounded-lg transition ${
                    viewMonth === i && !selected
                      ? 'bg-emerald-600 text-white font-semibold'
                      : selected && selected.getMonth() === i && selected.getFullYear() === viewYear
                        ? 'bg-emerald-600/50 text-emerald-300 font-semibold'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {pickerView === 'years' && (
            <div className="grid grid-cols-3 gap-1.5">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => handleSelectYear(y)}
                  className={`text-xs py-2 rounded-lg transition ${
                    viewYear === y
                      ? 'bg-emerald-600 text-white font-semibold'
                      : selected && selected.getFullYear() === y
                        ? 'bg-emerald-600/50 text-emerald-300 font-semibold'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

              {/* Time picker */}
              <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-700/30">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mr-1">Time</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewHour(h => (h + 23) % 24)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-gray-200 w-6 text-center">{String(viewHour).padStart(2, '0')}</span>
                  <button
                    onClick={() => setViewHour(h => (h + 1) % 24)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <span className="text-sm text-gray-500">:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMinute(m => (m + 59) % 60)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-gray-200 w-6 text-center">{String(viewMinute).padStart(2, '0')}</span>
                  <button
                    onClick={() => setViewMinute(m => (m + 1) % 60)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

          {/* Quick actions */}
          <div className="flex gap-1 mt-2 pt-2 border-t border-gray-700/30">
            <button
              onClick={() => {
                const now = new Date();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const h = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                onChange(`${now.getFullYear()}-${m}-${d}T${h}:${min}`);
                setOpen(false);
                setPickerView('days');
              }}
              className="flex-1 text-xs text-gray-400 hover:text-emerald-400 py-1.5 rounded-lg hover:bg-gray-800 transition"
            >
              Now
            </button>
            <button
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const d = String(tomorrow.getDate()).padStart(2, '0');
                const h = String(tomorrow.getHours()).padStart(2, '0');
                const min = String(tomorrow.getMinutes()).padStart(2, '0');
                onChange(`${tomorrow.getFullYear()}-${m}-${d}T${h}:${min}`);
                setOpen(false);
                setPickerView('days');
              }}
              className="flex-1 text-xs text-gray-400 hover:text-emerald-400 py-1.5 rounded-lg hover:bg-gray-800 transition"
            >
              Tomorrow
            </button>
            <button
              onClick={handleOke}
              className="flex-1 text-xs text-gray-400 hover:text-emerald-400 py-1.5 rounded-lg hover:bg-gray-800 transition"
            >
              Oke
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
