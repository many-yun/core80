import { useState, useEffect, useMemo } from 'react';

const CORE_START = '10:00';
const CORE_END = '16:00';
const TARGET_HOURS = 80;

const calculateHours = (start: string, end: string): number => {
   if (!start || !end) return 0;
   const [sH, sM] = start.split(':').map(Number);
   const [eH, eM] = end.split(':').map(Number);
   const diff = eH * 60 + eM - (sH * 60 + sM);
   return Math.max(0, diff / 60);
};

const isCoreOk = (start: string, end: string): boolean => !!start && !!end && start <= CORE_START && end >= CORE_END;

const fmt = (n: number) => n.toFixed(1);

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

const getDayKr = (dateStr: string) => {
   if (!dateStr) return '';
   return DAYS_KR[new Date(dateStr + 'T00:00:00').getDay()];
};

const isWeekend = (dateStr: string) => {
   if (!dateStr) return false;
   const d = new Date(dateStr + 'T00:00:00').getDay();
   return d === 0 || d === 6;
};

const getNowTimeStr = () => {
   const now = new Date();
   return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const getMondayOfCurrentCycle = () => {
   const d = new Date();
   const day = d.getDay();
   const diff = day === 0 ? -6 : 1 - day;
   d.setDate(d.getDate() + diff);
   d.setHours(0, 0, 0, 0);
   return d.toISOString().split('T')[0];
};

const getWeekdaysInCycle = (cycleStart: string): string[] => {
   const dates: string[] = [];
   const d = new Date(cycleStart + 'T00:00:00');
   for (let i = 0; i < 14; i++) {
      const dateStr = d.toISOString().split('T')[0];
      if (!isWeekend(dateStr)) dates.push(dateStr);
      d.setDate(d.getDate() + 1);
   }
   return dates;
};

const storage = {
   get: (key: string): string | null => {
      try {
         return localStorage.getItem(key);
      } catch {
         return null;
      }
   },
   set: (key: string, value: string): void => {
      try {
         localStorage.setItem(key, value);
      } catch {}
   },
};

interface WorkLog {
   id: string;
   date: string;
   start: string;
   end: string;
}

const initLogsForCycle = (cycle: string, existing: WorkLog[]): WorkLog[] => {
   return getWeekdaysInCycle(cycle).map((date) => {
      const found = existing.find((l) => l.date === date);
      return found || { id: crypto.randomUUID(), date, start: '', end: '' };
   });
};

export default function App() {
   const [cycleStart, setCycleStart] = useState<string>(getMondayOfCurrentCycle);
   const [logs, setLogs] = useState<WorkLog[]>([]);
   const [loaded, setLoaded] = useState(false);
   const [editingCycle, setEditingCycle] = useState(false);
   const [toast, setToast] = useState<string | null>(null);

   useEffect(() => {
      const savedCycle = storage.get('worklogs-cycle') || getMondayOfCurrentCycle();
      const savedLogs = storage.get('worklogs-v3');
      let parsed: WorkLog[] = [];
      if (savedLogs) {
         try {
            parsed = JSON.parse(savedLogs);
         } catch {}
      }
      setCycleStart(savedCycle);
      setLogs(initLogsForCycle(savedCycle, parsed));
      setLoaded(true);
   }, []);

   useEffect(() => {
      if (!loaded) return;
      storage.set('worklogs-v3', JSON.stringify(logs));
   }, [logs, loaded]);

   useEffect(() => {
      if (!loaded) return;
      storage.set('worklogs-cycle', cycleStart);
   }, [cycleStart, loaded]);

   const handleCycleChange = (newCycle: string) => {
      setCycleStart(newCycle);
      setLogs((prev) => initLogsForCycle(newCycle, prev));
   };

   const updateLog = (id: string, field: keyof WorkLog, value: string) => {
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
   };

   const clockIn = (id: string) => {
      const now = getNowTimeStr();
      setLogs((prev) => prev.map((l) => (l.id === id && !l.start ? { ...l, start: now } : l)));
      showToast(`출근 기록 ✓  ${getNowTimeStr()}`);
   };

   const clockOut = (id: string) => {
      const now = getNowTimeStr();
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, end: now } : l)));
      showToast(`퇴근 기록 ✓  ${getNowTimeStr()}`);
   };

   const clearLog = (id: string) => {
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, start: '', end: '' } : l)));
   };

   const showToast = (msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(null), 2000);
   };

   const stats = useMemo(() => {
      const total = logs.reduce((acc, l) => acc + calculateHours(l.start, l.end), 0);
      const remain = Math.max(0, TARGET_HOURS - total);
      const percent = Math.min(100, (total / TARGET_HOURS) * 100);
      const coreViolations = logs.filter((l) => l.start && l.end && !isCoreOk(l.start, l.end)).length;
      const workedDays = logs.filter((l) => l.start && l.end).length;
      const avgDaily = workedDays ? total / workedDays : 0;
      return { total, remain, percent, coreViolations, avgDaily, workedDays };
   }, [logs]);

   const cycleEnd = useMemo(() => {
      const d = new Date(cycleStart + 'T00:00:00');
      d.setDate(d.getDate() + 13);
      return d.toISOString().split('T')[0];
   }, [cycleStart]);

   const todayStr = new Date().toISOString().split('T')[0];
   const progressColor = stats.percent >= 100 ? '#16a34a' : stats.percent >= 60 ? '#2563eb' : '#d97706';

   if (!loaded) {
      return (
         <div
            style={{
               minHeight: '100vh',
               background: '#f1f5f9',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
            }}>
            <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 13 }}>불러오는 중...</div>
         </div>
      );
   }

   return (
      <div
         style={{
            minHeight: '100vh',
            background: '#f1f5f9',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            color: '#1e293b',
            padding: '28px 16px 80px',
         }}>
         <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; }
        input[type="date"], input[type="time"] {
          color-scheme: light;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          color: inherit;
        }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          cursor: pointer; opacity: 0.35;
        }
        input[type="time"]:hover::-webkit-calendar-picker-indicator,
        input[type="date"]:hover::-webkit-calendar-picker-indicator { opacity: 0.7; }
        .log-row { transition: background 0.1s; border-bottom: 1px solid #f1f5f9; }
        .log-row:last-child { border-bottom: none; }
        .log-row:hover { background: #f8fafc !important; }
        .btn { cursor: pointer; border: none; font-family: inherit; transition: all 0.12s; }
        .btn:active { transform: scale(0.97); }
        .ci-btn {
          font-size: 10px; font-weight: 700;
          border-radius: 5px; padding: 3px 7px; cursor: pointer;
          font-family: inherit; transition: all 0.12s;
          border: 1px solid;
          white-space: nowrap;
        }
        .ci-btn:active { transform: scale(0.95); }
        .ci-in  { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
        .ci-in:hover:not(:disabled) { background: #dcfce7; }
        .ci-in:disabled { background: #f0fdf4; color: #86efac; border-color: #dcfce7; cursor: default; }
        .ci-out { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
        .ci-out:hover:not(:disabled) { background: #ffedd5; }
        .ci-out:disabled { background: #fff7ed; color: #fdba74; border-color: #fed7aa; cursor: default; }
        .clr-btn { background: none; color: #cbd5e1; font-size: 14px; line-height: 1;
          padding: 2px 5px; border-radius: 4px; cursor: pointer; border: none;
          transition: color 0.12s; }
        .clr-btn:hover { color: #94a3b8; }
        @keyframes slideUp { from { transform: translateY(8px) translateX(-50%); opacity: 0; }
          to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        .toast-box { animation: slideUp 0.2s ease; }
      `}</style>

         <div style={{ maxWidth: 620, margin: '0 auto' }}>
            {/* ── Header ── */}
            <div
               style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
               <div>
                  <div
                     style={{
                        fontSize: 10,
                        color: '#94a3b8',
                        letterSpacing: 3,
                        textTransform: 'uppercase',
                        marginBottom: 2,
                     }}>
                     FLEX TIME TRACKER
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>근무시간 계산기</div>
               </div>

               <div style={{ textAlign: 'right' }}>
                  <div
                     style={{
                        fontSize: 9,
                        color: '#94a3b8',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                     }}>
                     사이클
                  </div>
                  {editingCycle ? (
                     <input
                        type="date"
                        value={cycleStart}
                        onChange={(e) => handleCycleChange(e.target.value)}
                        onBlur={() => setEditingCycle(false)}
                        autoFocus
                        style={{
                           fontSize: 11,
                           color: '#1e293b',
                           background: '#fff',
                           border: '1px solid #cbd5e1',
                           borderRadius: 6,
                           padding: '3px 8px',
                        }}
                     />
                  ) : (
                     <button
                        className="btn"
                        onClick={() => setEditingCycle(true)}
                        style={{
                           background: 'none',
                           color: '#64748b',
                           fontSize: 11,
                           padding: 0,
                           textDecoration: 'underline',
                           textDecorationStyle: 'dotted',
                           textUnderlineOffset: 3,
                        }}>
                        {cycleStart} ~ {cycleEnd}
                     </button>
                  )}
               </div>
            </div>

            {/* ── Stats ── */}
            <div
               style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '18px 20px 16px',
                  marginBottom: 14,
               }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginBottom: 16 }}>
                  <StatCell label="총 근무" value={`${fmt(stats.total)}h`} color="#0f172a" />
                  <StatCell
                     label="남은 시간"
                     value={`${fmt(stats.remain)}h`}
                     color={stats.remain === 0 ? '#16a34a' : '#d97706'}
                  />
                  <StatCell label="일 평균" value={`${fmt(stats.avgDaily)}h`} color="#64748b" />
                  <StatCell
                     label="코어 위반"
                     value={stats.coreViolations > 0 ? `${stats.coreViolations}일` : '없음'}
                     color={stats.coreViolations > 0 ? '#dc2626' : '#16a34a'}
                  />
               </div>

               {/* Progress */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                     <div
                        style={{
                           height: '100%',
                           width: `${stats.percent}%`,
                           background: progressColor,
                           borderRadius: 99,
                           transition: 'width 0.5s ease, background 0.4s ease',
                        }}
                     />
                  </div>
                  <span
                     style={{ fontSize: 11, fontWeight: 700, color: progressColor, minWidth: 36, textAlign: 'right' }}>
                     {Math.round(stats.percent)}%
                  </span>
               </div>
               <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 5, letterSpacing: 1 }}>
                  {stats.workedDays}일 기록 / 10일 사이클
               </div>
            </div>

            {/* ── Log Table ── */}
            <div
               style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  overflow: 'hidden',
               }}>
               {/* Column header */}
               <div
                  style={{
                     display: 'grid',
                     gridTemplateColumns: '32px 100px 1fr 46px 100px 28px',
                     alignItems: 'center',
                     padding: '9px 14px',
                     background: '#f8fafc',
                     borderBottom: '2px solid #e2e8f0',
                     fontSize: 9,
                     color: '#94a3b8',
                     letterSpacing: 2,
                     textTransform: 'uppercase',
                     gap: 6,
                  }}>
                  <span></span>
                  <span>날짜</span>
                  <span>출근시간 → 퇴근시간</span>
                  <span style={{ textAlign: 'right' }}>합계</span>
                  <span style={{ textAlign: 'center' }}>기록</span>
                  <span></span>
               </div>

               {logs.map((log) => {
                  const hrs = calculateHours(log.start, log.end);
                  const ok = isCoreOk(log.start, log.end);
                  const isToday = log.date === todayStr;
                  const hasStart = !!log.start;
                  const hasEnd = !!log.end;
                  const dayKr = getDayKr(log.date);
                  const rowBg = isToday ? '#eff6ff' : undefined;

                  return (
                     <div
                        key={log.id}
                        className="log-row"
                        style={{
                           display: 'grid',
                           gridTemplateColumns: '32px 100px 1fr 46px 100px 28px',
                           alignItems: 'center',
                           padding: '8px 14px',
                           gap: 6,
                           background: rowBg,
                           borderLeft: isToday ? '3px solid #3b82f6' : '3px solid transparent',
                        }}>
                        {/* Day of week */}
                        <div
                           style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textAlign: 'center',
                              color: isToday ? '#2563eb' : '#cbd5e1',
                           }}>
                           {isToday ? '▶' : dayKr}
                        </div>

                        {/* Date */}
                        <div>
                           <input
                              type="date"
                              value={log.date}
                              onChange={(e) => updateLog(log.id, 'date', e.target.value)}
                              style={{ fontSize: 11, color: isToday ? '#1d4ed8' : '#64748b', width: 100 }}
                           />
                        </div>

                        {/* Time inputs */}
                        <div
                           style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: hasStart || hasEnd ? '#f8fafc' : '#fcfcfd',
                              border: `1px solid ${hasStart || hasEnd ? '#e2e8f0' : '#f1f5f9'}`,
                              borderRadius: 8,
                              padding: '5px 10px',
                              gap: 6,
                           }}>
                           <input
                              type="time"
                              value={log.start}
                              onChange={(e) => updateLog(log.id, 'start', e.target.value)}
                              style={{
                                 fontSize: 12,
                                 width: 66,
                                 color: hasStart ? '#1e293b' : '#e2e8f0',
                              }}
                           />
                           <span style={{ color: '#e2e8f0', fontSize: 10, userSelect: 'none' }}>→</span>
                           <input
                              type="time"
                              value={log.end}
                              onChange={(e) => updateLog(log.id, 'end', e.target.value)}
                              style={{
                                 fontSize: 12,
                                 width: 66,
                                 color: hasEnd ? '#1e293b' : '#e2e8f0',
                              }}
                           />
                           {/* Core dot */}
                           {hasStart && hasEnd && (
                              <div
                                 title={ok ? '코어 시간 충족' : '코어 시간 미충족 (10:00~16:00)'}
                                 style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    background: ok ? '#22c55e' : '#f59e0b',
                                 }}
                              />
                           )}
                        </div>

                        {/* Hours */}
                        <div style={{ textAlign: 'right' }}>
                           {hrs > 0 ? (
                              <span
                                 style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: ok ? '#15803d' : '#d97706',
                                 }}>
                                 {fmt(hrs)}
                              </span>
                           ) : (
                              <span style={{ fontSize: 12, color: '#e2e8f0' }}>—</span>
                           )}
                        </div>

                        {/* Clock buttons */}
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                           <button
                              className="ci-btn ci-in"
                              onClick={() => clockIn(log.id)}
                              disabled={hasStart}
                              title={hasStart ? `출근: ${log.start}` : '현재 시간으로 출근 기록'}>
                              출근
                           </button>
                           <button
                              className="ci-btn ci-out"
                              onClick={() => clockOut(log.id)}
                              disabled={!hasStart}
                              title={hasEnd ? `퇴근: ${log.end}` : '현재 시간으로 퇴근 기록'}>
                              퇴근
                           </button>
                        </div>

                        {/* Clear */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                           {(hasStart || hasEnd) && (
                              <button className="clr-btn" onClick={() => clearLog(log.id)} title="기록 초기화">
                                 ×
                              </button>
                           )}
                        </div>
                     </div>
                  );
               })}
            </div>

            {/* Legend */}
            <div
               style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 20px',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: '#94a3b8',
                  marginTop: 14,
                  letterSpacing: 1,
               }}>
               <span>
                  <span style={{ color: '#22c55e' }}>●</span> 코어 충족 (10:00~16:00)
               </span>
               <span>
                  <span style={{ color: '#f59e0b' }}>●</span> 코어 미충족
               </span>
               <span>시간 필드 클릭 → 수동 조정</span>
            </div>
         </div>

         {/* Toast */}
         {toast && (
            <div
               className="toast-box"
               style={{
                  position: 'fixed',
                  bottom: 32,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#1e293b',
                  color: '#f8fafc',
                  borderRadius: 10,
                  padding: '10px 22px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  zIndex: 99,
                  whiteSpace: 'nowrap',
               }}>
               {toast}
            </div>
         )}
      </div>
   );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
   return (
      <div style={{ textAlign: 'center' }}>
         <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
            {label}
         </div>
         <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      </div>
   );
}
