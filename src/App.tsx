import { useState, useEffect, useMemo, useRef } from 'react';
import { LogIn, LogOut, RotateCcw, CheckCircle2, Circle } from 'lucide-react';

declare global {
   interface Window {
      electronStore?: {
         get: (key: string) => Promise<unknown>;
         set: (key: string, value: unknown) => Promise<void>;
         delete: (key: string) => Promise<void>;
      };
   }
}

const TARGET_HOURS = 80;
const WEEK_TARGET = 40;
const STORE_KEY = 'worklogs';

type LogType = 'work' | 'half' | 'full';

interface WorkLog {
   id: string;
   date: string;
   start: string;
   end: string;
   type: LogType;
}

// electron-store 없으면 localStorage로 폴백
const storage = {
   get: async (key: string): Promise<unknown> => {
      if (window.electronStore) return window.electronStore.get(key);
      try {
         const v = localStorage.getItem(key);
         return v ? JSON.parse(v) : null;
      } catch {
         return null;
      }
   },
   set: async (key: string, value: unknown): Promise<void> => {
      if (window.electronStore) return window.electronStore.set(key, value);
      try {
         localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
         console.error(err);
      }
   },
};

const calculateHours = (log: WorkLog): number => {
   if (log.type === 'full') return 8;
   if (!log.start || !log.end) return 0;
   const [sH, sM] = log.start.split(':').map(Number);
   const [eH, eM] = log.end.split(':').map(Number);
   const diff = (eH * 60 + eM - (sH * 60 + sM)) / 60;
   if (log.type === 'half') return Math.max(0, diff) + 4;
   return Math.max(0, diff - 1);
};

const nowStr = () => {
   const d = new Date();
   return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const todayStr = () => new Date().toISOString().split('T')[0];

const generateLogs = (): WorkLog[] => {
   const logs: WorkLog[] = [];
   const d = new Date();
   d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
   while (logs.length < 10) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
         logs.push({
            id: crypto.randomUUID(),
            date: d.toISOString().split('T')[0],
            start: '09:00',
            end: '18:00',
            type: 'work',
         });
      }
      d.setDate(d.getDate() + 1);
   }
   return logs;
};

const TYPE_LABELS: Record<LogType, string> = { work: '근무', half: '반차', full: '연차' };
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function App() {
   const [logs, setLogs] = useState<WorkLog[]>([]);
   const [loaded, setLoaded] = useState(false);
   const today = todayStr();
   const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

   // 불러오기 — 실패해도 반드시 setLoaded(true) 호출
   useEffect(() => {
      storage
         .get(STORE_KEY)
         .then((saved) => {
            if (Array.isArray(saved) && saved.length > 0) {
               setLogs(saved as WorkLog[]);
            } else {
               setLogs(generateLogs());
            }
         })
         .catch(() => {
            setLogs(generateLogs());
         })
         .finally(() => {
            setLoaded(true);
         });
   }, []);

   // 자동 저장 (300ms 디바운스)
   useEffect(() => {
      if (!loaded) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
         storage.set(STORE_KEY, logs);
      }, 300);
      return () => {
         if (saveTimer.current) clearTimeout(saveTimer.current);
      };
   }, [logs, loaded]);

   const stats = useMemo(() => {
      const total = logs.reduce((a, l) => a + calculateHours(l), 0);
      const w1 = logs.slice(0, 5).reduce((a, l) => a + calculateHours(l), 0);
      const w2 = logs.slice(5, 10).reduce((a, l) => a + calculateHours(l), 0);
      return {
         total: total.toFixed(1),
         remain: Math.max(0, TARGET_HOURS - total).toFixed(1),
         pct: Math.min(100, (total / TARGET_HOURS) * 100),
         w1Done: w1 >= WEEK_TARGET,
         w2Done: w2 >= WEEK_TARGET,
         w1h: w1.toFixed(1),
         w2h: w2.toFixed(1),
      };
   }, [logs]);

   const update = (id: string, u: Partial<WorkLog>) => setLogs(logs.map((l) => (l.id === id ? { ...l, ...u } : l)));

   const handleReset = () => {
      if (!window.confirm('초기화하시겠습니까?')) return;
      const fresh = generateLogs();
      setLogs(fresh);
      storage.set(STORE_KEY, fresh);
   };

   const week1 = logs.slice(0, 5);
   const week2 = logs.slice(5, 10);

   const barColor = stats.pct >= 100 ? 'bg-green-500' : stats.pct >= 60 ? 'bg-blue-500' : 'bg-amber-400';
   const remainColor = stats.pct >= 100 ? 'text-green-400' : stats.pct >= 60 ? 'text-blue-400' : 'text-amber-400';

   if (!loaded) {
      return (
         <div className="w-full bg-white font-sans">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900">
               <span className="text-xs text-slate-500">불러오는 중...</span>
            </div>
         </div>
      );
   }

   const Row = ({ log }: { log: WorkLog }) => {
      const isToday = log.date === today;
      const day = DAY_KR[new Date(log.date + 'T00:00:00').getDay()];
      const hrs = calculateHours(log);

      return (
         <div
            className={`px-2.5 py-1.5 border-b border-slate-100 last:border-0 border-l-2 transition-colors ${isToday ? 'bg-blue-50 border-l-blue-500' : 'hover:bg-slate-50 border-l-transparent'}`}>
            <div className="flex items-center justify-between mb-1">
               <span className={`text-[10px] font-bold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                  {log.date.slice(5)} <span className="opacity-60">{day}</span>
                  {isToday && <span className="ml-1 text-blue-400">▶</span>}
               </span>
               <div className="flex gap-0.5">
                  {(['work', 'half', 'full'] as LogType[]).map((t) => (
                     <button
                        key={t}
                        onClick={() => update(log.id, { type: t })}
                        className={`px-1.5 py-px rounded text-[9px] font-bold border-none cursor-pointer transition-colors ${
                           log.type === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}>
                        {TYPE_LABELS[t]}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-1.5">
               {log.type === 'full' ? (
                  <div className="flex-1 text-center text-[10px] font-bold text-slate-400 bg-slate-100 rounded py-1">
                     연차 — 8.0h
                  </div>
               ) : (
                  <div
                     className={`flex flex-1 items-center gap-1 rounded px-2 py-1 border ${
                        log.type === 'half' ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                     }`}>
                     <input
                        type="time"
                        value={log.start}
                        onChange={(e) => update(log.id, { start: e.target.value })}
                        className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 w-24"
                     />
                     <span className="text-slate-300 text-[10px]">~</span>
                     <input
                        type="time"
                        value={log.end}
                        onChange={(e) => update(log.id, { end: e.target.value })}
                        className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 w-24"
                     />
                  </div>
               )}
               <span
                  className={`text-xs font-bold min-w-[30px] text-right tabular-nums ${hrs > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                  {hrs > 0 ? `${hrs.toFixed(1)}h` : '—'}
               </span>
            </div>

            {isToday && log.type !== 'full' && (
               <div className="flex gap-1.5 mt-1.5">
                  <button
                     onClick={() => update(log.id, { start: nowStr() })}
                     className="flex flex-1 items-center justify-center gap-1 py-0.5 rounded border border-slate-200 text-[10px] font-bold cursor-pointer bg-white text-slate-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                     <LogIn size={10} /> 출근
                  </button>
                  <button
                     onClick={() => update(log.id, { end: nowStr() })}
                     className="flex flex-1 items-center justify-center gap-1 py-0.5 rounded border border-slate-200 text-[10px] font-bold cursor-pointer bg-white text-slate-500 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all">
                     <LogOut size={10} /> 퇴근
                  </button>
               </div>
            )}
         </div>
      );
   };

   return (
      <div className="w-full min-w-140 bg-white font-sans text-sm text-slate-800">
         <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white">
            <div className="flex items-baseline gap-1 shrink-0">
               <span className="text-base font-black tabular-nums">{stats.total}</span>
               <span className="text-[10px] text-slate-500 font-bold">/ {TARGET_HOURS}h</span>
            </div>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
               <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${stats.pct}%` }}
               />
            </div>
            <span className={`text-[10px] font-bold shrink-0 ${remainColor}`}>{stats.remain}h 남음</span>
            <button
               onClick={handleReset}
               className="text-slate-600 hover:text-red-400 transition-colors shrink-0 bg-transparent border-none cursor-pointer p-0 flex">
               <RotateCcw size={12} />
            </button>
         </div>

         <div className="flex border-t border-slate-100">
            {([week1, week2] as WorkLog[][]).map((week, i) => {
               const done = i === 0 ? stats.w1Done : stats.w2Done;
               const wh = i === 0 ? stats.w1h : stats.w2h;
               return (
                  <div key={i} className={`flex-1 min-w-0 ${i === 0 ? 'border-r border-slate-100' : ''}`}>
                     <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                           Week {i + 1}
                        </span>
                        <div className="flex items-center gap-1">
                           <span className={`text-[10px] font-bold ${done ? 'text-green-600' : 'text-slate-400'}`}>
                              {wh}h
                           </span>
                           {done ? (
                              <CheckCircle2 size={13} className="text-green-500" />
                           ) : (
                              <Circle size={13} className="text-slate-300" />
                           )}
                        </div>
                     </div>
                     {week.map((log) => (
                        <Row key={log.id} log={log} />
                     ))}
                  </div>
               );
            })}
         </div>

         <div className="flex items-center gap-2 px-2.5 py-1 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400 font-bold">
            <CheckCircle2 size={10} className="text-green-500" />
            <span>주 40h 달성</span>
            <Circle size={10} className="text-slate-300" />
            <span>미달성</span>
            <span className="ml-auto opacity-50">근무 -1h 점심 · 반차 +4h</span>
         </div>
      </div>
   );
}
