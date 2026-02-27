import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock, RotateCcw, LogIn, LogOut } from 'lucide-react';

// --- Constants ---
const CORE_START = '10:00';
const CORE_END = '16:00';
const TARGET_HOURS = 80;

type LogType = 'work' | 'half' | 'full';

interface WorkLog {
   id: string;
   date: string;
   start: string;
   end: string;
   type: LogType;
}

const calculateHours = (log: WorkLog): number => {
   if (log.type === 'full') return 8;

   const [sH, sM] = log.start.split(':').map(Number);
   const [eH, eM] = log.end.split(':').map(Number);
   const diffMinutes = eH * 60 + eM - (sH * 60 + sM);
   let workedHours = diffMinutes / 60;

   if (log.type === 'work') {
      // 일반 근무: 점심시간 1시간 제외 (최소 0시간 보장)
      workedHours = Math.max(0, workedHours - 1);
   } else if (log.type === 'half') {
      // 반차: 실제 근무 시간 + 4시간 (반차는 점심시간 제외 로직을 보통 포함하지 않거나 이미 퇴근/출근으로 처리됨)
      workedHours = workedHours + 4;
   }

   return Math.max(0, workedHours);
};

const isCoreOk = (log: WorkLog): boolean => {
   if (log.type === 'full') return true;
   return log.start <= CORE_START && log.end >= CORE_END;
};

const getCurrentTime = () => {
   const now = new Date();
   return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const generateInitialLogs = (): WorkLog[] => {
   const logs: WorkLog[] = [];
   const startDay = new Date();
   // 이번 주 월요일 찾기
   startDay.setDate(startDay.getDate() - (startDay.getDay() === 0 ? 6 : startDay.getDay() - 1));

   let count = 0;
   const current = new Date(startDay);

   while (count < 10) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
         logs.push({
            id: crypto.randomUUID(),
            date: current.toISOString().split('T')[0],
            start: '08:00',
            end: '17:00',
            type: 'work',
         });
         count++;
      }
      current.setDate(current.getDate() + 1);
   }
   return logs;
};

export default function App() {
   const [logs, setLogs] = useState<WorkLog[]>(generateInitialLogs());
   const today = getTodayString();

   const stats = useMemo(() => {
      const total = logs.reduce((acc, log) => acc + calculateHours(log), 0);
      return {
         total: total.toFixed(1),
         remain: Math.max(0, TARGET_HOURS - total).toFixed(1),
         percent: Math.min(100, (total / TARGET_HOURS) * 100).toFixed(0),
      };
   }, [logs]);

   const updateLog = (id: string, updates: Partial<WorkLog>) => {
      setLogs(logs.map((log) => (log.id === id ? { ...log, ...updates } : log)));
   };

   const resetAll = () => {
      if (window.confirm('모든 기록을 초기 상태로 되돌리시겠습니까?')) {
         setLogs(generateInitialLogs());
      }
   };

   const week1 = logs.slice(0, 5);
   const week2 = logs.slice(5, 10);

   const LogItem = ({ log }: { log: WorkLog }) => {
      const isToday = log.date === today;

      return (
         <div
            className={`p-3 group transition-colors border-b border-gray-100 last:border-0 ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                     {log.date} {isToday && '(오늘)'}
                  </span>
               </div>
               <div className="flex gap-1">
                  {(['work', 'half', 'full'] as LogType[]).map((t) => (
                     <button
                        key={t}
                        onClick={() => updateLog(log.id, { type: t })}
                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold transition-colors ${
                           log.type === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>
                        {t === 'work' ? '근무' : t === 'half' ? '반차' : '연차'}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-2">
               {log.type !== 'full' ? (
                  <div
                     className={`flex-1 flex items-center rounded-md px-2 py-1 border transition-all ${log.type === 'half' ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                     <input
                        type="time"
                        value={log.start}
                        onChange={(e) => updateLog(log.id, { start: e.target.value })}
                        className="bg-transparent w-full text-xs outline-none font-bold"
                     />
                     <span className="mx-1 text-gray-300 text-[10px]">~</span>
                     <input
                        type="time"
                        value={log.end}
                        onChange={(e) => updateLog(log.id, { end: e.target.value })}
                        className="bg-transparent w-full text-xs outline-none font-bold"
                     />
                  </div>
               ) : (
                  <div className="flex-1 flex items-center justify-center bg-gray-900 text-white rounded-md py-1 text-xs font-bold">
                     Full Day Off (8.0h)
                  </div>
               )}

               <div className="w-8 text-right flex flex-col items-end">
                  <span className="text-xs font-bold">{calculateHours(log).toFixed(1)}</span>
                  {log.type === 'half' && <span className="text-[8px] text-blue-500 font-bold leading-none">+4h</span>}
                  {log.type === 'work' && (
                     <span className="text-[8px] text-gray-400 font-bold leading-none">-1h L</span>
                  )}
               </div>

               <div className="w-4 flex justify-center">
                  {isCoreOk(log) ? (
                     <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : (
                     <AlertCircle size={14} className="text-amber-500" />
                  )}
               </div>
            </div>

            {isToday && log.type !== 'full' && (
               <div className="flex gap-2 mt-2">
                  <button
                     onClick={() => updateLog(log.id, { start: getCurrentTime() })}
                     className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                     <LogIn size={12} /> 출근
                  </button>
                  <button
                     onClick={() => updateLog(log.id, { end: getCurrentTime() })}
                     className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-white border border-gray-100 text-[10px] font-bold text-gray-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm">
                     <LogOut size={12} /> 퇴근
                  </button>
               </div>
            )}
         </div>
      );
   };

   return (
      <div className="w-full min-w-5xl bg-white overflow-hidden flex flex-col md:flex-row">
         {/* Left Side: Display Stats */}
         <div className="w-full md:w-1/4 bg-gray-900 p-8 md:p-10 text-right flex flex-col justify-between">
            <div>
               <div className="text-gray-500 text-xs uppercase tracking-widest mb-1 font-bold">Status</div>
               <div className="text-white text-7xl font-bold mb-4 tabular-nums">
                  {stats.total}
                  <span className="text-2xl ml-1 text-gray-600">h</span>
               </div>
               <div className="space-y-2 text-sm">
                  <div className="text-blue-400 font-bold text-lg">Remain: {stats.remain}h</div>
                  <div className="text-emerald-400 font-bold">Progress: {stats.percent}%</div>
               </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-800 text-left">
               <button
                  onClick={resetAll}
                  className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-[10px] uppercase font-bold mb-8 group">
                  <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Reset All
                  Data
               </button>
               <h3 className="text-gray-500 text-[10px] uppercase font-bold mb-4 tracking-widest">Legend</h3>
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>{' '}
                     Core OK
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                     <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>{' '}
                     Core Check (10-16)
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50 mt-4">
                     <p className="text-[9px] text-gray-400 leading-relaxed font-bold">
                        * WORK: (DIFF) - 1.0H (Lunch)
                        <br />
                        * HALF: (DIFF) + 4.0H
                        <br />* FULL: Fixed 8.0H
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* Right Side: 2-Week List */}
         <div className="flex-1 bg-white p-6 md:p-10 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
               <div className="flex items-center gap-2">
                  <Clock className="text-blue-600" size={20} />
                  <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                     Bi-Weekly Core Tracker
                  </span>
               </div>
               <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                  Target: 80.0h
               </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 overflow-y-auto pr-2 custom-scrollbar max-h-[600px]">
               {/* Week 1 */}
               <div className="flex-1">
                  <div className="flex items-center justify-between mb-4 px-2">
                     <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Week 1</h4>
                     <div className="h-px bg-gray-100 flex-1 ml-4"></div>
                  </div>
                  <div className="bg-gray-50/30 rounded-3xl border border-gray-100 overflow-hidden">
                     {week1.map((log) => (
                        <LogItem key={log.id} log={log} />
                     ))}
                  </div>
               </div>

               {/* Week 2 */}
               <div className="flex-1">
                  <div className="flex items-center justify-between mb-4 px-2">
                     <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Week 2</h4>
                     <div className="h-px bg-gray-100 flex-1 ml-4"></div>
                  </div>
                  <div className="bg-gray-50/30 rounded-3xl border border-gray-100 overflow-hidden">
                     {week2.map((log) => (
                        <LogItem key={log.id} log={log} />
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
