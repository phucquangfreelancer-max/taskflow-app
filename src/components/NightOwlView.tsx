import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, 
  Zap, 
  Rocket, 
  Brain, 
  Play, 
  Pause, 
  RotateCcw, 
  Music, 
  SkipForward, 
  Check, 
  Trash2, 
  RefreshCw 
} from 'lucide-react';

interface NightCheckItem {
  id: string;
  text: string;
  completed: boolean;
}

interface NightOwlViewProps {
  user: any;
  nightEnergy: 'low' | 'mid' | 'high';
  setNightEnergy: (e: 'low' | 'mid' | 'high') => void;
  isNightOwlActive: boolean;
  onToggleNightOwlActive: (active: boolean) => void;
  setHealthMode: (m: 'standard' | 'nightOwl') => void;
  lowAdviceIdx: number;
  setLowAdviceIdx: React.Dispatch<React.SetStateAction<number>>;
  midAdviceIdx: number;
  setMidAdviceIdx: React.Dispatch<React.SetStateAction<number>>;
  highAdviceIdx: number;
  setHighAdviceIdx: React.Dispatch<React.SetStateAction<number>>;
  liveNightTimer: number;
  nightTimerLimitHours: number;
  setNightTimerLimitHours: (h: number) => void;
  setLastNotifiedLimit: (l: boolean) => void;
  isNightTimerRunning: boolean;
  startNightTimer: () => void;
  stopNightTimer: () => void;
  resetNightTimer: () => void;
  microBreakEnabled: boolean;
  setMicroBreakEnabled: (b: boolean) => void;
  currentTrackIndex: number;
  setCurrentTrackIndex: React.Dispatch<React.SetStateAction<number>>;
  isLofiPlaying: boolean;
  setIsLofiPlaying: (p: boolean) => void;
  lofiProgress: number;
  setLofiProgress: React.Dispatch<React.SetStateAction<number>>;
  nightChecklist: NightCheckItem[];
  setNightChecklist: React.Dispatch<React.SetStateAction<NightCheckItem[]>>;
  newCheckItemText: string;
  setNewCheckItemText: (t: string) => void;
  addNightCheckItem: () => void;
  toggleNightCheckItem: (id: string) => void;
  deleteNightCheckItem: (id: string) => void;
  LOW_ENERGY_ADVICES: string[];
  MID_ENERGY_ADVICES: string[];
  HIGH_ENERGY_ADVICES: string[];
  LOFI_TRACKS: any[];
}

export default function NightOwlView({
  user,
  nightEnergy,
  setNightEnergy,
  isNightOwlActive,
  onToggleNightOwlActive,
  setHealthMode,
  lowAdviceIdx,
  setLowAdviceIdx,
  midAdviceIdx,
  setMidAdviceIdx,
  highAdviceIdx,
  setHighAdviceIdx,
  liveNightTimer,
  nightTimerLimitHours,
  setNightTimerLimitHours,
  setLastNotifiedLimit,
  isNightTimerRunning,
  startNightTimer,
  stopNightTimer,
  resetNightTimer,
  microBreakEnabled,
  setMicroBreakEnabled,
  currentTrackIndex,
  setCurrentTrackIndex,
  isLofiPlaying,
  setIsLofiPlaying,
  lofiProgress,
  setLofiProgress,
  nightChecklist,
  setNightChecklist,
  newCheckItemText,
  setNewCheckItemText,
  addNightCheckItem,
  toggleNightCheckItem,
  deleteNightCheckItem,
  LOW_ENERGY_ADVICES,
  MID_ENERGY_ADVICES,
  HIGH_ENERGY_ADVICES,
  LOFI_TRACKS,
}: NightOwlViewProps) {
  const [showFinishModal, setShowFinishModal] = React.useState(false);
  const [randomFinishMessage, setRandomFinishMessage] = React.useState("");

  const isNightTimeAllowed = () => {
    const hour = new Date().getHours();
    return hour >= 23 || hour < 7;
  };

  const finishQuotes = [
    "Khóc đủ rồi, đi ngủ thôi nào! Bạn đã làm rất tốt.",
    "Ngẩng mặt lên ngắm sao trời một chút rồi chìm vào giấc ngủ nhé.",
    "Bọc mắt lại và ngủ thật say, ngày mai là một bình minh rực rỡ.",
    "Tắt máy tính, nhắm mắt lại. Tâm trí của bạn xứng đáng được bình yên.",
    "Hôm nay bạn chiến đấu đủ rồi. Giờ là giờ sạc lại năng lượng cơ thể.",
    "Hơi thở sâu, thả lỏng toàn thân, gác lại mọi âu lo để chìm vào giấc ngủ lành.",
    "Giấc ngủ ngon là vị thuốc bổ tráng kiện nhất cho ngày mai bùng nổ.",
    "Thức đêm đủ mệt rồi, hãy để cơ thể bạn tự chữa lành trong bóng đêm yên tĩnh.",
    "Ngày làm việc ca đêm kết thúc xuất sắc. Bạn đã rất kiên cường!",
    "Tắt bớt suy nghĩ đi nào, để não bộ của bạn trôi dạt vào giấc mơ đẹp.",
    "Một cốc nước lọc ấm nhỏ trước khi ngủ để duy trì lượng nước dĩ vãng.",
    "Để điện thoại xa giường ngủ để tránh bức xạ phá hỏng Melatonin sâu giấc.",
    "Nép mình vào chăn ấm, nghe tiếng mưa nhẹ nhàng hoặc một bản nhạc êm.",
    "Chiếc giường êm ái đang đợi bạn. Đừng cố quá sức kẻo thành quá cố nha!",
    "Sức khỏe là khối tài sản vô giá nhất, tiền bạc chỉ là công cụ. Đi ngủ thôi!",
    "Cảm ơn cơ thể bạn đã đồng hành bền bỉ suốt ca đêm qua.",
    "Ngày mai hãy thức dậy lúc bình minh chan hòa, hít thở sương sớm mát mẻ.",
    "Nụ cười mỉm trên môi trước khi nhắm mắt sẽ thanh lọc mọi stress công việc.",
    "Hãy từ tốn đếm hơi thở để rơi tự do vào cõi mộng mơ.",
    "Đêm đã tàn, bình minh chuẩn bị ló rạng. Nghỉ ngơi trọn vẹn thôi nào!"
  ];

  const handleFinishClick = () => {
    const randomIdx = Math.floor(Math.random() * finishQuotes.length);
    setRandomFinishMessage(finishQuotes[randomIdx]);
    setShowFinishModal(true);
  };

  const handleConfirmFinish = () => {
    setShowFinishModal(false);
    resetNightTimer();
    
    // Clear the night checklist when Night Owl mode is finished (completed)
    setNightChecklist([]);
    localStorage.setItem(`taskflow_night_checklist_${user?.uid || 'default'}`, JSON.stringify([]));
    
    onToggleNightOwlActive(false);
    setHealthMode('standard');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
      {/* 1. TOP DYNAMIC ADVICE BANNER - Only shown when Night Owl is enabled */}
      {isNightOwlActive && (
        <div className="lg:col-span-12">
          <div className="bg-[#111113] border border-amber-500/20 rounded-[2rem] p-6 text-left relative overflow-hidden shadow-[0_4px_24px_rgba(245,158,11,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-0.5 inline-block font-sans">
                Khuyên dùng cho ca đêm
              </span>
              <p className="text-sm italic text-white/95 leading-relaxed font-semibold leading-relaxed">
                "{nightEnergy === 'low' 
                  ? LOW_ENERGY_ADVICES[lowAdviceIdx % 10] 
                  : nightEnergy === 'mid' 
                    ? MID_ENERGY_ADVICES[midAdviceIdx % 10] 
                    : HIGH_ENERGY_ADVICES[highAdviceIdx % 10]}"
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (nightEnergy === 'low') setLowAdviceIdx(prev => (prev + 1) % 10);
                else if (nightEnergy === 'mid') setMidAdviceIdx(prev => (prev + 1) % 10);
                else setHighAdviceIdx(prev => (prev + 1) % 10);
              }}
              className="text-xs text-[#f59e0b] hover:text-yellow-300 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition-all cursor-pointer font-sans whitespace-nowrap self-end md:self-center"
            >
              <RefreshCw size={12} /> Đổi lời khuyên
            </button>
          </div>
        </div>
      )}

      {/* Left Column: holds Energy Indicator, Work limits, and Reminders */}
      <div className="lg:col-span-12 xl:col-span-5 space-y-6">
        
        {/* Box 1: Night Energy Indicator (Năng lượng ban đêm) - ALWAYS SHOWN */}
        <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 text-left space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="space-y-1 pb-2 border-b border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Chỉ số năng lượng</span>
              <h3 className="text-base font-bold text-white tracking-tight">Năng lượng ban đêm</h3>
            </div>
          </div>

          <div className="flex bg-[#17171a] p-1 rounded-xl border border-white/5 gap-2">
            {(['low', 'mid', 'high'] as const).map((energy) => {
              const labels = {
                low: "🔋 Low",
                mid: "⚡ Mid",
                high: "🚀 High"
              };
              const activeClasses = {
                low: "bg-zinc-805 text-white bg-white/10 border-white/15",
                mid: "bg-zinc-805 text-white bg-white/10 border-white/15",
                high: "bg-zinc-805 text-white bg-white/10 border-white/15"
              };
              return (
                <button
                  key={energy}
                  type="button"
                  onClick={() => setNightEnergy(energy)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer ${
                    nightEnergy === energy 
                      ? `${activeClasses[energy]} shadow-md` 
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {labels[energy]}
                </button>
              );
            })}
          </div>

          {!isNightOwlActive && (
            <button
              type="button"
              disabled={!isNightTimeAllowed()}
              onClick={() => {
                if (!isNightTimeAllowed()) return;
                onToggleNightOwlActive(true);
              }}
              className={`w-full mt-4 py-3.5 px-6 font-bold rounded-xl text-xs transition-all text-center uppercase tracking-wider block font-sans ${
                isNightTimeAllowed()
                  ? 'bg-[#9333ea] hover:bg-[#a855f7] hover:shadow-[0_0_20px_rgba(147,51,234,0.3)] active:scale-95 cursor-pointer text-white shadow-lg'
                  : 'bg-zinc-800/80 border border-white/5 cursor-not-allowed text-slate-500 shadow-none'
              }`}
            >
              {isNightTimeAllowed() ? "Kích hoạt Không gian Cú đêm" : "🔒 Ngoài giờ cú đêm (23h - 7h)"}
            </button>
          )}

          {!isNightOwlActive && !isNightTimeAllowed() && (
            <div className="mt-4 p-4 rounded-2xl bg-[#9333ea]/10 border border-[#9333ea]/20 text-left space-y-1.5 animate-fade-in">
              <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider block flex items-center gap-1.5">
                <span>⏰</span> CHỈ HOẠT ĐỘNG TỪ 23:00 - 07:00
              </span>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Không gian Cú Đêm được khuyến nghị chỉ nên kích hoạt và làm việc trong khoảng thời gian từ <strong className="text-white">23 giờ đêm hôm trước đến 7 giờ sáng hôm sau</strong> để đảm bảo đồng hồ sinh học khỏe mạnh.
              </p>
              <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1 bg-purple-500/10 w-fit px-2 py-0.5 rounded border border-purple-500/10">
                <span>Giờ hiện tại:</span>
                <strong>{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            </div>
          )}
        </div>

        {/* If Mode is active, show remainders inside the left column */}
        {isNightOwlActive && (
          <>
            {/* Box 2: Stopwatch and Alerts */}
            <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 text-left space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="space-y-1 pb-2 border-b border-white/5 flex items-center justify-between animate-fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">GIỮ VỮNG TẬP TRUNG</span>
                  <h3 className="text-base font-bold text-white tracking-tight font-sans">Bộ Đồng Hồ Làm Việc</h3>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-white/5">
                  <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full animate-ping" />
                  <span className="font-mono">Stopwatch</span>
                </div>
              </div>

              <div className="bg-[#17171a] border border-white/5 rounded-2xl p-6 text-center space-y-3">
                <div className="text-4xl font-mono font-bold tracking-tight text-white select-all">
                  {(() => {
                    const h = Math.floor(liveNightTimer / 3600);
                    const m = Math.floor((liveNightTimer % 3600) / 60);
                    const s = liveNightTimer % 60;
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                  })()}
                </div>
                
                {/* Progress bar if work sleep limit is active */}
                {nightTimerLimitHours > 0 && (
                  <div className="space-y-2 pt-1 animate-fade-in">
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#f59e0b] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (liveNightTimer / (nightTimerLimitHours * 3600)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
                      <span>Đạt {Math.min(100, Math.round((liveNightTimer / (nightTimerLimitHours * 3600)) * 100))}% thời gian thức</span>
                      <span>Giới hạn {nightTimerLimitHours}h</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {!isNightTimerRunning ? (
                    <button
                      type="button"
                      onClick={startNightTimer}
                      className="flex-1 py-2.5 bg-white text-black hover:bg-[#eaeaea] transition-colors rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      <Play size={12} fill="currentColor" />
                      Bắt đầu làm ca đêm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopNightTimer}
                      className="flex-1 py-2.5 bg-[#1e1e24] text-white hover:bg-[#25252b] border border-white/10 transition-colors rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      <Pause size={12} fill="currentColor" />
                      Tạm dừng đếm
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetNightTimer}
                    title="Reset đồng hồ"
                    className="p-2.5 bg-[#17171a] border border-white/5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Set Limit hours dropdown */}
              <div className="flex items-center justify-between text-xs gap-4 pt-1 font-sans">
                <span className="text-zinc-400 font-medium font-sans">Giới hạn thời gian thức:</span>
                <select
                  value={nightTimerLimitHours}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNightTimerLimitHours(val);
                    setLastNotifiedLimit(false);
                  }}
                  className="bg-[#17171a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-semibold outline-none focus:border-white/20 cursor-pointer"
                >
                  <option value={0}>Không giới hạn (Vô hạn)</option>
                  <option value={1}>1 tiếng</option>
                  <option value={2}>2 tiếng</option>
                  <option value={3}>3 tiếng</option>
                  <option value={4}>4 tiếng</option>
                  <option value={5}>5 tiếng</option>
                  <option value={6}>6 tiếng</option>
                </select>
              </div>
            </div>

            {/* Box 3: Micro-break (Reminders) */}
            <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 text-left space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Nhắc nhở giãn cơ</span>
                  <h3 className="text-sm font-bold text-white tracking-tight font-sans">Micro-break Reminder</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMicroBreakEnabled(!microBreakEnabled)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer font-sans ${
                    microBreakEnabled 
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' 
                      : 'bg-white/5 border border-white/5 text-slate-500'
                  }`}
                >
                  {microBreakEnabled ? "ĐANG BẬT" : "ĐANG TẮT"}
                </button>
              </div>

              <div className="bg-[#17171a] border border-white/5 rounded-xl p-3.5 text-xs text-slate-400 leading-relaxed flex items-start gap-3 select-text">
                <div className="p-1 rounded bg-white/5 border border-white/10 text-white mt-0.5 flex-shrink-0 select-none">
                  🔔
                </div>
                <div>
                  Cứ mỗi <strong>45 phút</strong>, hệ thống sẽ tự phát chuông dịu mát nhắc nhở: <span className="text-white font-medium font-sans">"Nghỉ 5 phút, nhìn xa, uống nước"</span> để hồi phục sảng khoái tầm mắt.
                </div>
              </div>

              {isNightTimerRunning && microBreakEnabled && (
                <div className="flex items-center justify-between text-xs pt-1 px-1 font-sans animate-fade-in">
                  <span className="text-slate-500 font-medium">Chu kỳ nhắc tiếp theo:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {(() => {
                      const nextBreakSec = 2700 - (liveNightTimer % 2700);
                      const m = Math.floor(nextBreakSec / 60);
                      const s = nextBreakSec % 60;
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Column - Cẩm Nang Làm Đêm Chuyên Nghiệp (Show when inactive) */}
      {!isNightOwlActive ? (
        <div className="lg:col-span-12 xl:col-span-7 space-y-6 animate-fade-in text-left">
          <div className="bg-[#111113] border border-[#9333ea]/15 rounded-[2rem] p-6 space-y-6 shadow-[0_8px_32px_rgba(147,51,234,0.04)]">
            <div className="space-y-1.5 border-b border-white/5 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Góc tham vấn y học ca làm đêm</span>
              <h3 className="text-xl font-bold text-white tracking-tight font-sans">Cẩm Nang Làm Đêm Chuyên Nghiệp</h3>
              <p className="text-xs text-slate-400 leading-relaxed select-text font-sans">
                Quỹ thời gian về đêm luôn đem đến sự tĩnh lặng tuyệt hảo để tập trung sáng tạo sâu. Tuy nhiên, nếu thức đêm quá mức sẽ tàn hại nghiêm trọng sức khỏe. Hãy vận dụng các khuyến nghị của chuyên gia y học để giảm thiểu rủi ro:
              </p>
            </div>

            {/* Section: Trước ca trực đêm */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                <span className="text-yellow-400">⚡</span> Trước ca trực đêm
              </h4>
              <div className="bg-[#17171a] border border-white/5 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5 select-text leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Bồi hoàn giấc ngủ:</strong> Khuyến nghị ngủ trưa bù từ 1.5 – 2 tiếng vào buổi chiều trước đó để giảm bớt nồng độ adenosine tích tụ gây buồn ngủ, mệt mỏi về đêm.</span>
                </p>
              </div>
            </div>

            {/* Section: Trong khi thức */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                <span className="text-purple-400">🧠</span> Trong suốt ca đêm
              </h4>
              <div className="bg-[#17171a] border border-white/5 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5 select-text leading-relaxed font-sans">
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Liệu pháp uống Caffeine:</strong> Tránh xa cà phê đậm đặc sau 12 giờ đêm. Chỉ nhấp nhẹ hàm lượng caffeine ấm vừa vào đầu ca làm và dừng hẳn uống sau 2 giờ sáng.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Điều chỉnh ánh sáng màn hình:</strong> Bật bộ lọc ánh sáng ban đêm Night Shield và giảm độ sáng màn hình hết mức để tránh luồng bức xạ phá hủy lượng Melatonin.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Bù nước lọc mộc mạc:</strong> Tránh dùng nước ngọt năng lượng cao, vì chúng kéo sụt giảm nhanh chóng lượng đường huyết tiếp theo, dẫn đến uể oải lúc 3h sáng.</span>
                </p>
              </div>
            </div>

            {/* Section: Sau khi thức */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                <span className="text-emerald-400">😴</span> Sau khi kết thúc ca đêm
              </h4>
              <div className="bg-[#17171a] border border-white/5 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5 select-text leading-relaxed font-sans">
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Kiến tạo phòng tối:</strong> Ngủ bù ngay lập tức khi trời sáng. Đóng tối rèm phòng, bọc mắt bịt tai để thúc đẩy tuyến tùng giải phóng Melatonin sâu sắc.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-[#f59e0b] font-bold">•</span>
                  <span><strong>Không thức rướn bù giờ:</strong> Cố gắng không tiếp tục làm việc sau 9 giờ sáng. Việc dạo ngoài nắng sớm gắt sẽ gây loạn nhịp, kiệt quệ mệt mỏi vĩnh viễn.</span>
                </p>
              </div>
            </div>

            {/* Scientific Impact Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 font-sans">
                <span className="text-[#f59e0b]">📊</span>
                <h4 className="text-sm font-bold text-white">Thống Kê Khoa Học Về Tác Hại Của Thức Đêm Phổ Biến</h4>
              </div>
              <div className="overflow-hidden border border-white/5 rounded-2xl select-text">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-slate-450 font-semibold h-10">
                      <th className="px-4">Tần suất thức đêm</th>
                      <th className="px-4">Hậu quả và Tác động sinh học tiêu biểu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300 leading-relaxed font-sans">
                    <tr className="hover:bg-white/[1%] h-12">
                      <td className="px-4 font-semibold text-[#10b981] whitespace-nowrap">1 – 2 lần / tháng</td>
                      <td className="px-4 py-2">Ảnh hưởng tạm thời, mô cơ cấu tự phục hồi, cơ thể dễ dàng cân bằng sinh hóa trong vòng 48h nghỉ ngơi đầy đủ.</td>
                    </tr>
                    <tr className="hover:bg-white/[1%] h-12">
                      <td className="px-4 font-semibold text-[#f59e0b] whitespace-nowrap">1 – 2 lần / tuần</td>
                      <td className="px-4 py-2">Gây rối loạn nặng nề nhịp thức ngủ, làm giảm tới 30% hàng rào miễn dịch tự nhiên, dễ gây ra tích mỡ xấu, béo phì.</td>
                    </tr>
                    <tr className="hover:bg-white/[1%] h-12">
                      <td className="px-4 font-bold text-[#f43f5e] whitespace-nowrap">Thường xuyên liên tục</td>
                      <td className="px-4 py-2 text-rose-300">Suy thoái nhận thức và suy giảm tuần hoàn não mãn tính, tăng gấp đôi tỉ lệ phát mạch gân cứng xơ vữa, đau đầu triền miên.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 italic leading-relaxed pt-1 select-text">
                💡 Lời khuyên vàng: Hãy sắp đặt dồn các task ca trực sang mốc sớm bình minh (như từ 4h – 6h sáng) thay vì cày thâu đêm 3h – 4h sáng. Không khí sương sớm lành mạnh sẽ bảo trì tuyệt đỉnh tuổi thọ cho Freelancer!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Active Ca Đêm Right column layout */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-6 text-left animate-fade-in">
            
            {/* Box 4: Lofi Chill Music Player */}
            <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 text-left space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="space-y-0.5 pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">TẬP TRUNG SÂU</span>
                <h3 className="text-sm font-bold text-white tracking-tight font-sans">Âm Nhạc Lofi Chill</h3>
              </div>

              <div className="flex items-center gap-4 bg-[#17171a] border border-white/5 rounded-2xl p-4">
                <div 
                  className={`w-14 h-14 rounded-full border border-white/10 bg-zinc-950 flex items-center justify-center relative flex-shrink-0 select-none shadow-inner ${
                    isLofiPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '6s' }}
                >
                  <div className="absolute inset-2.5 rounded-full border border-white/5 bg-zinc-900 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-400 flex items-center justify-center text-[8px] text-yellow-300 font-mono">
                      ♩
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <h4 className="text-xs font-bold text-white truncate font-sans">
                    {LOFI_TRACKS[currentTrackIndex]?.title || 'Lofi Code'}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {LOFI_TRACKS[currentTrackIndex]?.artist || 'Lofi Vibes'}
                  </p>
                  
                  <div className="flex h-3 items-end gap-1 mt-2.5 overflow-hidden w-24">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                      const randH = isLofiPlaying ? [12, 16, 24, 20, 8, 14, 22, 10][bar - 1] : 4;
                      return (
                        <div 
                          key={bar} 
                          className="bg-yellow-500/45 w-1 rounded-sm transition-all duration-350"
                          style={{
                            height: isLofiPlaying ? '100%' : '4px',
                            maxHeight: `${randH}px`
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-yellow-500 h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(lofiProgress / (LOFI_TRACKS[currentTrackIndex]?.duration || 200)) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#f59e0b] font-semibold font-mono">
                  <span>
                    {(() => {
                      const m = Math.floor(lofiProgress / 60);
                      const s = lofiProgress % 100 % 60;
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    })()}
                  </span>
                  <span>
                    {(() => {
                      const dur = LOFI_TRACKS[currentTrackIndex]?.duration || 200;
                      const m = Math.floor(dur / 60);
                      const s = dur % 60;
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTrackIndex(prev => (prev - 1 + LOFI_TRACKS.length) % LOFI_TRACKS.length);
                    setLofiProgress(0);
                  }}
                  className="p-2 border border-white/5 bg-[#17171a] hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <Music size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLofiPlaying(!isLofiPlaying)}
                  className="p-3 bg-white text-black hover:bg-slate-250 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-md"
                >
                  {isLofiPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTrackIndex(prev => (prev + 1) % LOFI_TRACKS.length);
                    setLofiProgress(0);
                  }}
                  className="p-2 border border-white/5 bg-[#17171a] hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <SkipForward size={12} fill="currentColor" />
                </button>
              </div>
            </div>

            {/* Box 5: Custom Checklist */}
            <div className="bg-[#111113] border border-white/5 rounded-[2rem] p-6 text-left space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="space-y-0.5 pb-2 border-b border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">MỤC TIÊU PHỤ</span>
                  <h3 className="text-sm font-bold text-white tracking-tight font-sans">Checklist Ca Đêm</h3>
                </div>
                <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/25 px-2 py-0.5 rounded-lg font-mono">
                  {nightChecklist.filter(t => t.completed).length}/{nightChecklist.length} đạt
                </span>
              </div>

              <div className="flex gap-2 font-sans">
                <input
                  type="text"
                  placeholder="Thêm task ca đêm mới..."
                  value={newCheckItemText}
                  onChange={(e) => setNewCheckItemText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNightCheckItem(); }}
                  className="flex-1 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-550/50"
                />
                <button
                  type="button"
                  onClick={addNightCheckItem}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Thêm
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {nightChecklist.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-white/[2%] border border-white/5 rounded-xl text-xs text-slate-300 gap-3 hover:bg-white/[4%] transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => toggleNightCheckItem(item.id)}
                      className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        item.completed 
                          ? 'bg-purple-600 border-purple-500 text-white' 
                          : 'border-white/20'
                      }`}>
                        {item.completed && <Check size={10} strokeWidth={4} />}
                      </div>
                      <span className={`font-medium transition-all ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNightCheckItem(item.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {nightChecklist.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs select-none">
                    Trống việc đêm. Thêm mục tiêu để bắt đầu làm!
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Complete Rest Button at the end of the tab (Image 4) */}
          <div className="lg:col-span-12 flex justify-center mt-6">
            <button
              type="button"
              onClick={handleFinishClick}
              className="py-4 px-8 bg-gradient-to-r from-purple-650 to-indigo-600 hover:opacity-90 active:scale-95 transition-all text-white font-bold rounded-2xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-purple-600/20 w-full max-w-md block"
            >
              Hoàn thành (nghỉ ngơi thôi) 😴
            </button>
          </div>
        </>
      )}

      {/* Complete Rest Modal Overlaid popup showing 20 randomized quotes */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111113] border-2 border-purple-500/40 rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full animate-pulse" />

              <div className="relative mx-auto w-20 h-20 bg-purple-500/10 border-2 border-purple-500/20 text-purple-400 rounded-full flex items-center justify-center animate-bounce">
                🌙
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 animate-pulse">
                  Lời chúc ngủ ngon từ TaskFlow
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
                  Nghỉ Ngơi Trọn Vẹn!
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed bg-white/5 p-5 rounded-2xl border border-white/5 italic">
                  "{randomFinishMessage}"
                </div>
              </div>

              <button
                onClick={handleConfirmFinish}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-2xl transition-all outline-none border border-transparent shadow-[0_0_20px_rgba(168,85,247,0.25)] active:scale-95 text-sm uppercase tracking-wider cursor-pointer"
              >
                Xác nhận & Đi Ngủ Thôi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
