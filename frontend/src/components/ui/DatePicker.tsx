import { useState, useRef, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday, isAfter, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Clock, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Single DatePicker ────────────────────────────────────────────────────────
interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  withTime?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  className?: string;
}

export function DatePicker({
  value, onChange, placeholder = 'Select date', minDate, maxDate,
  withTime = false, disabled = false, label, error, className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const [view, setView] = useState<'calendar' | 'time'>('calendar');
  const [tempTime, setTempTime] = useState({ h: value?.getHours() || 0, m: value?.getMinutes() || 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  const firstDayOfWeek = getDay(startOfMonth(viewDate));
  const weeks = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const selectDay = (day: Date) => {
    if (minDate && isBefore(day, startOfDay(minDate))) return;
    if (maxDate && isAfter(day, startOfDay(maxDate))) return;
    let selected = day;
    if (withTime) {
      selected = setMinutes(setHours(day, tempTime.h), tempTime.m);
      setView('time');
    } else {
      onChange(selected);
      setOpen(false);
    }
    onChange(selected);
  };

  const confirmTime = () => {
    if (!value) return;
    onChange(setMinutes(setHours(value, tempTime.h), tempTime.m));
    setOpen(false);
    setView('calendar');
  };

  const displayValue = value ? (withTime ? format(value, 'EEE, dd MMM yyyy • HH:mm') : format(value, 'EEE, dd MMM yyyy')) : '';

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}

      {/* Input trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setView('calendar'); }}
        className={cn(
          'w-full flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl text-sm transition-all duration-150 bg-white text-left',
          open ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          error && 'border-red-400 focus:ring-red-100',
        )}
      >
        <Calendar className={cn('w-4 h-4 flex-shrink-0', open ? 'text-blue-500' : 'text-gray-400')} />
        <span className={cn('flex-1', value ? 'text-gray-900' : 'text-gray-400')}>{displayValue || placeholder}</span>
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Picker Popover */}
      {open && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in" style={{ minWidth: 320 }}>
          {view === 'calendar' ? (
            <>
              {/* Header */}
              <div className="bg-blue-600 px-5 pt-5 pb-4">
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">
                  {withTime ? 'Select Date' : 'Select Date'}
                </p>
                <p className="text-white text-3xl font-bold mt-1">
                  {value ? format(value, 'EEE, MMM d') : 'Pick a date'}
                </p>
                {withTime && value && (
                  <button onClick={() => setView('time')} className="text-blue-200 text-sm mt-1 hover:text-white underline">
                    {format(value, 'HH:mm')}
                  </button>
                )}
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date())}
                  className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors px-2"
                >
                  {format(viewDate, 'MMMM yyyy')}
                </button>
                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 px-3 py-2">
                {weeks.map((w, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-gray-400 py-1">{w}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                {daysInMonth.map((day) => {
                  const isSelected = value && isSameDay(day, value);
                  const isCurrentToday = isToday(day);
                  const disabled2 = (minDate && isBefore(day, startOfDay(minDate))) || (maxDate && isAfter(day, startOfDay(maxDate)));
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabled2}
                      onClick={() => selectDay(day)}
                      className={cn(
                        'aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all duration-100',
                        isSelected ? 'bg-blue-600 text-white shadow-md scale-110' :
                        isCurrentToday ? 'border-2 border-blue-400 text-blue-600 font-bold' :
                        'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                        disabled2 && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-gray-700',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-4 py-3 border-t border-gray-50">
                <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-blue-600 font-semibold hover:text-blue-700">Cancel</button>
              </div>
            </>
          ) : (
            // Time Picker View
            <div>
              <div className="bg-blue-600 px-5 pt-5 pb-4">
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Select Time</p>
                <p className="text-white text-4xl font-bold mt-1 tracking-widest">
                  {String(tempTime.h).padStart(2, '0')}:{String(tempTime.m).padStart(2, '0')}
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">HOUR</label>
                  <input type="range" min={0} max={23} value={tempTime.h}
                    onChange={(e) => setTempTime((p) => ({ ...p, h: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>00</span><span>{String(tempTime.h).padStart(2,'0')}</span><span>23</span></div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">MINUTE</label>
                  <input type="range" min={0} max={59} step={5} value={tempTime.m}
                    onChange={(e) => setTempTime((p) => ({ ...p, m: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>00</span><span>{String(tempTime.m).padStart(2,'0')}</span><span>59</span></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setView('calendar')} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">← Date</button>
                  <button onClick={confirmTime} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-700">
                    <Check className="w-4 h-4" /> OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onStartChange: (d: Date | null) => void;
  onEndChange: (d: Date | null) => void;
  label?: string;
  className?: string;
}

export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, label, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(startDate || new Date());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  const firstDayOfWeek = getDay(startOfMonth(viewDate));
  const nextMonthDays = eachDayOfInterval({ start: startOfMonth(addMonths(viewDate, 1)), end: endOfMonth(addMonths(viewDate, 1)) });
  const firstDayNextMonth = getDay(startOfMonth(addMonths(viewDate, 1)));
  const weeks = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Quick presets
  const presets = [
    { label: 'Today', start: startOfDay(new Date()), end: new Date() },
    { label: 'Yesterday', start: startOfDay(new Date(Date.now() - 86400000)), end: startOfDay(new Date(Date.now() - 86400000)) },
    { label: 'Last 7 days', start: new Date(Date.now() - 7 * 86400000), end: new Date() },
    { label: 'Last 30 days', start: new Date(Date.now() - 30 * 86400000), end: new Date() },
    { label: 'This month', start: startOfMonth(new Date()), end: new Date() },
    { label: 'Last month', start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) },
    { label: 'This quarter', start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), end: new Date() },
    { label: 'This year', start: new Date(new Date().getFullYear(), 0, 1), end: new Date() },
  ];

  const applyPreset = (p: typeof presets[0]) => {
    onStartChange(p.start);
    onEndChange(p.end);
    setOpen(false);
  };

  const selectDay = (day: Date) => {
    if (selecting === 'start') {
      onStartChange(day);
      onEndChange(null);
      setSelecting('end');
    } else {
      if (startDate && isBefore(day, startDate)) {
        onEndChange(startDate);
        onStartChange(day);
      } else {
        onEndChange(day);
      }
      setSelecting('start');
      setOpen(false);
    }
  };

  const inRange = (day: Date) => {
    const end = endDate || hoverDate;
    if (!startDate || !end) return false;
    const rangeStart = isBefore(startDate, end) ? startDate : end;
    const rangeEnd = isBefore(startDate, end) ? end : startDate;
    return isAfter(day, rangeStart) && isBefore(day, rangeEnd);
  };

  const renderMonth = (days: Date[], firstDay: number, monthViewDate: Date) => (
    <div className="flex-1">
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="text-sm font-semibold text-gray-800">{format(monthViewDate, 'MMMM yyyy')}</span>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {weeks.map((w) => <div key={w} className="text-center text-xs font-medium text-gray-400 py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map((day) => {
          const isStart = startDate && isSameDay(day, startDate);
          const isEnd = endDate && isSameDay(day, endDate);
          const isInRange = inRange(day);
          const isCurrentToday = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => selectDay(day)}
              onMouseEnter={() => setHoverDate(day)}
              onMouseLeave={() => setHoverDate(null)}
              className={cn(
                'aspect-square flex items-center justify-center text-xs font-medium transition-all duration-75 relative',
                isStart || isEnd ? 'bg-blue-600 text-white rounded-full z-10 shadow-sm' :
                isInRange ? 'bg-blue-100 text-blue-800' :
                isCurrentToday ? 'border border-blue-400 text-blue-600 rounded-full font-bold' :
                'text-gray-700 hover:bg-gray-100 rounded-full',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );

  const displayText = startDate && endDate
    ? `${format(startDate, 'dd MMM')} → ${format(endDate, 'dd MMM yyyy')}`
    : startDate ? `${format(startDate, 'dd MMM yyyy')} → Select end`
    : 'Select date range';

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl text-sm bg-white transition-all',
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400',
        )}
      >
        <Calendar className={cn('w-4 h-4 flex-shrink-0', open ? 'text-blue-500' : 'text-gray-400')} />
        <span className={cn('flex-1 text-left', (startDate || endDate) ? 'text-gray-900' : 'text-gray-400')}>{displayText}</span>
        {(startDate || endDate) && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onStartChange(null); onEndChange(null); }} className="text-gray-300 hover:text-gray-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in" style={{ minWidth: 640 }}>
          <div className="flex">
            {/* Presets sidebar */}
            <div className="w-40 bg-gray-50 border-r border-gray-100 p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Quick Select</p>
              <div className="space-y-0.5">
                {presets.map((p) => (
                  <button key={p.label} type="button" onClick={() => applyPreset(p)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dual calendar */}
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 rounded-full hover:bg-gray-100">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div className="flex gap-2 text-xs font-medium text-gray-500">
                  <span className={cn('px-3 py-1 rounded-full', selecting === 'start' ? 'bg-blue-100 text-blue-700' : 'text-gray-400')}>
                    📅 {startDate ? format(startDate, 'dd MMM yyyy') : 'Start date'}
                  </span>
                  <span className="text-gray-300">→</span>
                  <span className={cn('px-3 py-1 rounded-full', selecting === 'end' ? 'bg-blue-100 text-blue-700' : 'text-gray-400')}>
                    📅 {endDate ? format(endDate, 'dd MMM yyyy') : 'End date'}
                  </span>
                </div>
                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 rounded-full hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex gap-6">
                {renderMonth(daysInMonth, firstDayOfWeek, viewDate)}
                <div className="w-px bg-gray-100" />
                {renderMonth(nextMonthDays, firstDayNextMonth, addMonths(viewDate, 1))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-3">
                <button type="button" onClick={() => { onStartChange(null); onEndChange(null); setSelecting('start'); }} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-blue-600 font-semibold hover:text-blue-700 px-4 py-1.5 bg-blue-50 rounded-lg">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Time Picker standalone ───────────────────────────────────────────────────
interface TimePickerProps {
  value?: string; // HH:mm
  onChange: (time: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({ value, onChange, label, disabled, className }: TimePickerProps) {
  const [h, m] = (value || '00:00').split(':').map(Number);
  const [open, setOpen] = useState(false);
  const [tempH, setTempH] = useState(h);
  const [tempM, setTempM] = useState(m);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const confirm = () => { onChange(`${String(tempH).padStart(2,'0')}:${String(tempM).padStart(2,'0')}`); setOpen(false); };

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
        className={cn('w-full flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl text-sm bg-white transition-all',
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400', disabled && 'opacity-50 cursor-not-allowed')}>
        <Clock className={cn('w-4 h-4', open ? 'text-blue-500' : 'text-gray-400')} />
        <span className={value ? 'text-gray-900 font-mono font-semibold' : 'text-gray-400'}>{value || '-- : --'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-fade-in" style={{ width: 260 }}>
          <div className="bg-blue-600 rounded-xl p-4 text-center mb-4">
            <p className="text-blue-200 text-xs mb-1">SELECT TIME</p>
            <p className="text-white text-4xl font-bold font-mono tracking-widest">
              {String(tempH).padStart(2,'0')}:{String(tempM).padStart(2,'0')}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Hour</span><span className="font-bold text-blue-600">{String(tempH).padStart(2,'0')}</span></div>
              <input type="range" min={0} max={23} value={tempH} onChange={(e) => setTempH(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
              <div className="flex justify-between text-xs text-gray-300 mt-0.5"><span>00</span><span>23</span></div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Minute</span><span className="font-bold text-blue-600">{String(tempM).padStart(2,'0')}</span></div>
              <input type="range" min={0} max={59} step={5} value={tempM} onChange={(e) => setTempM(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
              <div className="flex justify-between text-xs text-gray-300 mt-0.5"><span>00</span><span>59</span></div>
            </div>
          </div>
          {/* Quick hour buttons */}
          <div className="grid grid-cols-6 gap-1 mt-3">
            {[6,8,9,12,15,18].map((hr) => (
              <button key={hr} onClick={() => setTempH(hr)} className={cn('py-1 rounded-lg text-xs font-medium transition-colors', tempH === hr ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-50')}>
                {hr}h
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={confirm} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1">
              <Check className="w-4 h-4" /> OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
