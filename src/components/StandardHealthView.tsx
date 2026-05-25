import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Droplet, 
  Eye, 
  Activity, 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Square, 
  Bell 
} from 'lucide-react';

interface ActiveTimer {
  totalSeconds: number;
  remainingSeconds: number;
  isTimerActive: boolean;
  lastTick: number;
}

interface HealthTip {
  id: string;
  category: string;
  title: string;
  badge?: string;
  shortDesc: string;
  detail: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  badgeClass?: string;
}

interface StandardHealthViewProps {
  user: any;
  timers: Record<string, ActiveTimer>;
  waterIntakeCount: number;
  setWaterIntakeCount: (count: number) => void;
  waterLogs: Record<string, number>;
  currentMonth: number;
  setCurrentMonth: React.Dispatch<React.SetStateAction<number>>;
  currentYear: number;
  setCurrentYear: React.Dispatch<React.SetStateAction<number>>;
  totalWorkHours: number;
  avgWorkHours: number;
  startPresetTimer: (presetId: string) => void;
  stopPresetTimer: (presetId: string) => void;
  handlePresetCardClick: (presetId: string) => void;
  formatTime: (totalSecs: number) => string;
  tipsByCategory: Record<string, HealthTip[]>;
  expandedTipIds: Record<string, boolean>;
  toggleTip: (id: string) => void;
  presets: any[];
  presetStyles: Record<string, any>;
}

export default function StandardHealthView({
  user,
  timers,
  waterIntakeCount,
  setWaterIntakeCount,
  waterLogs,
  currentMonth,
  setCurrentMonth,
  currentYear,
  setCurrentYear,
  totalWorkHours,
  avgWorkHours,
  startPresetTimer,
  stopPresetTimer,
  handlePresetCardClick,
  formatTime,
  tipsByCategory,
  expandedTipIds,
  toggleTip,
  presets,
  presetStyles,
}: StandardHealthViewProps) {

  const waterPct = Math.min(100, Math.round((waterIntakeCount / 8) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
      
      {/* Left side: Checklist & Preset Selector (5 cols on lg) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-left">
          <div className="space-y-1.5 pb-2 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Thiết Lập Nhanh</span>
            <h3 className="text-lg font-bold text-white tracking-tight">Hẹn Giờ Nhắc Nhở</h3>
            <p className="text-xs text-slate-400">
              Nhấp vào ô để kích hoạt đồng hồ. Khi đang chạy, hãy bấm vào <span className="text-rose-450 font-bold">nút đỏ DỪNG</span> để tạm dừng. Các mục nhắc nhở sẽ tự động lặp lại sau khi xác nhận.
            </p>
          </div>

          {/* Presets Grid - clickable entirety cards */}
          <div className="grid grid-cols-1 gap-4 select-none">
            {presets.map((p) => {
              const state = timers[p.id];
              const isActive = state && state.isTimerActive && state.remainingSeconds > 0;
              const styleConfig = presetStyles[p.id] || presetStyles.water;
              
              const pct = isActive && state.totalSeconds > 0 
                ? (state.remainingSeconds / state.totalSeconds) * 100 
                : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handlePresetCardClick(p.id)}
                  className={`
                    w-full rounded-2xl border transition-all p-4 duration-300 relative overflow-visible flex flex-col gap-3 flex-shrink-0
                    ${isActive 
                      ? `${styleConfig.bgActive} cursor-default` 
                      : 'bg-[#17171a] border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/5 hover:translate-y-[-2px] cursor-pointer'}
                  `}
                >
                  {/* Top Row: Info and Visual Toggle status */}
                  <div className="flex items-center justify-between gap-4 relative z-10">
                    <div>
                      <span className={`text-sm font-bold block ${isActive ? styleConfig.textColor : 'text-white'}`}>
                        {p.label}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Lặp lại đều đặn tự động</span>
                    </div>

                    {isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopPresetTimer(p.id);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 hover:text-white active:bg-red-700 text-rose-450 rounded-lg text-[9px] font-extrabold uppercase border border-red-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.2)] font-sans"
                      >
                        <Square size={8} fill="currentColor" className="animate-pulse" />
                        DỪNG
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                        CHƯA BẬT
                      </span>
                    )}
                  </div>

                  {/* Progress Bar and Timer display embedded INSIDE the preset container */}
                  {isActive ? (
                    <div className="space-y-3 pt-2.5 border-t border-white/5 relative z-10">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span className="tracking-wide text-xs">Thời gian còn lại:</span>
                        <span className={`font-mono font-bold ${styleConfig.textColor}`}>{Math.round(pct)}% còn lại</span>
                      </div>

                      <div className="w-full bg-[#1b1c1e] h-2 rounded-full overflow-visible relative">
                        <div 
                          className={`${styleConfig.barColor} ${styleConfig.pulseClass} h-full rounded-full transition-all duration-1000 ease-linear relative overflow-visible`}
                          style={{ width: `${pct}%` }}
                        >
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border border-current shadow-lg flex items-center justify-center text-[10px] animate-bounce z-20">
                            {styleConfig.icon}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">{p.name}</span>
                        <span className="text-sm font-mono font-black text-white">{formatTime(state.remainingSeconds)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Quick stats summarizing the water balance */}
          <div className="bg-[#17171a] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 mt-2 text-left">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">UỐNG NƯỚC HÔM NAY</span>
              <span className="text-lg font-black text-white">{waterIntakeCount * 250}ml / 2000ml</span>
              <span className="text-[10px] text-slate-500 block">Tiến trình đạt được: {waterPct}%</span>
            </div>
            <div className="relative w-12 h-12 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/25 flex-shrink-0 select-none">
              <Droplet size={20} className="fill-blue-500/20" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center border border-slate-900 font-mono">
                {waterIntakeCount}/8
              </span>
            </div>
          </div>



        </div>

        {/* Quick helper habit card */}
        <div className="bg-gradient-to-br from-indigo-950/20 to-slate-900/10 border border-indigo-500/10 rounded-[2rem] p-6 text-left space-y-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Bell size={16} />
          </div>
          <h4 className="text-sm font-bold text-white">Xử lý tự động xoay vòng thông minh</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Các chu kỳ nhắc nhở đồng hành được thiết lập tối ưu để làm việc cùng lúc hiệu quả. Ngay khi xác nhận đã hoàn thành bài tập thư giãn của chu kỳ cũ, đồng hồ sẽ tự động bắt đầu lặp lại chu kỳ mới từ đầu mà không cần thao tác thiết lập thủ công lặp lại.
          </p>
        </div>
      </div>

      {/* Right side: Collapsible Advice Category Sections (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-6 text-left">
        
        {/* Monthly Water History Grid */}
        {(() => {
          const MONTH_NAMES = [
            "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
          ];

          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
          const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

          const monthDays = [];
          for (let i = 0; i < startOffset; i++) {
            monthDays.push({ isEmpty: true, key: `empty-${i}` });
          }

          for (let d = 1; d <= daysInMonth; d++) {
            const padMonth = String(currentMonth + 1).padStart(2, '0');
            const padDay = String(d).padStart(2, '0');
            const dateStr = `${currentYear}-${padMonth}-${padDay}`;
            
            const isToday = (currentYear === new Date().getFullYear()) && 
                            (currentMonth === new Date().getMonth()) && 
                            (d === new Date().getDate());

            monthDays.push({
              isEmpty: false,
              dayNum: d,
              dateStr,
              isToday,
              key: dateStr
            });
          }

          let totalCups = 0;
          let perfect = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            const padMonth = String(currentMonth + 1).padStart(2, '0');
            const padDay = String(d).padStart(2, '0');
            const dateStr = `${currentYear}-${padMonth}-${padDay}`;
            const count = waterLogs[dateStr] || 0;
            if (count >= 8) {
              totalCups += 8;
              perfect++;
            }
          }
          const avgCount = (totalCups / daysInMonth).toFixed(1);

          const handlePrevMonth = () => {
            if (currentMonth === 0) {
              setCurrentMonth(11);
              setCurrentYear(prev => prev - 1);
            } else {
              setCurrentMonth(prev => prev - 1);
            }
          };

          const handleNextMonth = () => {
            if (currentMonth === 11) {
              setCurrentMonth(0);
              setCurrentYear(prev => prev + 1);
            } else {
              setCurrentMonth(prev => prev + 1);
            }
          };

          return (
            <div className="bg-[#111113] border border-white/5 rounded-3xl p-4 space-y-3 shadow-lg text-left">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5 gap-2">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Thống kê theo tháng</span>
                  <h3 className="text-sm font-black text-white tracking-tight">Lịch Sử Uống Nước</h3>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentMonth(new Date().getMonth());
                      setCurrentYear(new Date().getFullYear());
                    }}
                    className="text-[9px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-xl border border-blue-500/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    Hiện tại
                  </button>
                  <div className="flex items-center gap-1 bg-[#17171a] px-1.5 py-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-black text-slate-200 px-1 whitespace-nowrap">
                      {MONTH_NAMES[currentMonth]}, {currentYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-[#17171a] border border-white/5 rounded-xl p-2 flex flex-col justify-center">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Đạt mục tiêu</span>
                  <span className="font-extrabold text-blue-400">{perfect} ngày</span>
                </div>
                <div className="bg-[#17171a] border border-white/5 rounded-xl p-2 flex flex-col justify-center">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Trung bình tháng</span>
                  <span className="font-extrabold text-emerald-400">{Math.round(parseFloat(avgCount) * 250)}ml/ngày</span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center border-b border-white/5 pb-1">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((dayName, idx) => (
                  <span key={dayName} className={`text-[8px] font-bold tracking-wider ${idx === 6 ? 'text-amber-500' : 'text-slate-500'}`}>
                    {dayName}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 select-none">
                {monthDays.map((item) => {
                  if (item.isEmpty) {
                    return <div key={item.key} className="bg-transparent" />;
                  }

                  const count = waterLogs[item.dateStr || ''] || 0;
                  const pct = Math.min(100, Math.round(count * 12.5));
                  const litersVal = (count * 0.25).toFixed(1) + 'L';
                  const isToday = item.isToday;

                  let bgClass = "bg-[#141517] border-white/5 text-slate-500 border";
                  if (count > 0 && count < 4) {
                    bgClass = "bg-blue-950/10 border-blue-500/10 text-blue-300/80 border";
                  } else if (count >= 4 && count < 8) {
                    bgClass = "bg-blue-900/20 border-blue-500/25 text-blue-300 border";
                  } else if (count >= 8) {
                    bgClass = "bg-gradient-to-br from-blue-600 to-cyan-500 border-blue-400/20 text-white font-black shadow-[0_2px_6px_rgba(59,130,246,0.15)]";
                  }

                  return (
                    <div
                      key={item.key}
                      className={`
                        rounded-xl p-1 py-1.5 flex flex-col justify-between items-center text-center relative min-h-[44px] transition-all duration-300
                        ${bgClass}
                        ${isToday ? 'ring-1 ring-blue-500 border-blue-500' : ''}
                      `}
                    >
                      <span className={`text-[8px] font-bold leading-none tracking-tight ${count >= 8 ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.dayNum}
                      </span>
                      <span className={`text-[9px] font-black leading-none my-0.5 ${count >= 8 ? 'text-white' : 'text-blue-400'}`}>
                        {pct}%
                      </span>
                      <span className={`text-[6.5px] font-semibold tracking-tighter leading-none ${count >= 8 ? 'text-white/90' : 'text-slate-500'}`}>
                        {litersVal}
                      </span>
                      {isToday && (
                        <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full border border-[#0e0f11] ${count >= 8 ? 'bg-white' : 'bg-blue-450 animate-pulse'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="space-y-1 border-b border-white/5 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10b981]">Lớp tư vấn chuẩn</span>
            <h3 className="text-lg font-bold text-white tracking-tight">Cẩm Nang Sức Khỏe Lối Sống</h3>
          </div>

          <div className="space-y-6">
            {Object.keys(tipsByCategory).map(categoryName => (
              <div key={categoryName} className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2.5 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {categoryName}
                </h4>

                <div className="space-y-2.5">
                  {tipsByCategory[categoryName].map((tip) => {
                    const isExpanded = !!expandedTipIds[tip.id];
                    return (
                      <div 
                        key={tip.id}
                        className="bg-[#17171a] hover:bg-[#1a1a1f] border border-white/5 rounded-2xl transition-all overflow-hidden duration-300 hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTip(tip.id)}
                          className="w-full p-4 flex items-center justify-between gap-4 text-left select-none outline-none focus:outline-none cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-10 h-10 ${tip.iconBgColor} ${tip.iconColor} rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}>
                              {tip.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <span className="font-bold text-sm text-white tracking-tight truncate">{tip.title}</span>
                                {tip.badge && (
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full truncate ${tip.badgeClass || 'bg-white/5 text-slate-400'}`}>
                                    {tip.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400/80 font-medium truncate mt-0.5">{tip.shortDesc}</p>
                            </div>
                          </div>
                          
                          <div className="text-slate-500 hover:text-white transition-colors p-1 bg-white/5 hover:bg-white/10 rounded-lg flex-shrink-0">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-white/5 text-xs text-slate-400 leading-relaxed bg-[#1b1b21]/30">
                                <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                                  {tip.detail}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
