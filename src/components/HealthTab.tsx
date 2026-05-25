import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import StandardHealthView from './StandardHealthView';
import NightOwlView from './NightOwlView';
import { 
  Droplet, 
  Activity, 
  Moon, 
  Brain,
  Square,
  Play,
  Pause,
  RotateCcw,
  Music,
  Check,
  Battery,
  Zap,
  Rocket
} from 'lucide-react';

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

interface ActiveTimer {
  totalSeconds: number;
  remainingSeconds: number;
  isTimerActive: boolean;
  lastTick: number;
}

const LOW_ENERGY_ADVICES = [
  "Mức năng lượng thấp, hãy ưu tiên các task nhẹ nhàng, dọn dẹp email hoặc học thử kiến thức mới.",
  "Đừng ép mình uống quá nhiều cafein lúc này; một tách trà gừng hay nước ấm sẽ giữ bạn tỉnh táo.",
  "Vận động nhẹ nhàng mỗi 20 phút để thúc đẩy máu lưu thông lên não, tránh uể oải buồn ngủ.",
  "Nghe list nhạc Lofi có nhịp điệu nhanh một chút để giữ cho tinh thần không bị kéo chìm sâu.",
  "Rửa mặt bằng nước mát hoặc xịt khoáng để kích thích thế thần kinh trung ương tỉnh táo tạm thời.",
  "Nên tắt bớt tab không liên quan để tránh quá tải tâm trí khi cơ thể đang rất mệt mỏi.",
  "Tránh ăn thức ăn nhiều tinh bột hay chất béo lúc này vì dạ dày quá tải sẽ kéo sập năng lượng.",
  "Đặt tư thế ngồi thẳng lưng và ngửa cổ tối đa 20 giây giải tỏa áp lực đè nặng lên đốt sống gáy.",
  "Nếu mí mắt quá nặng, ngủ một giấc ngắn (power nap) 15-20 phút sẽ tốt hơn ép mình cố làm.",
  "Mức năng lượng cực thấp, hãy chắt lọc 1 task cốt lõi nhất cần xử lý rồi chuẩn bị đi ngủ bù."
];

const MID_ENERGY_ADVICES = [
  "Năng lượng trung bình thích hợp giải quyết các đầu việc vừa sức, lập trình logic trung bình.",
  "Bật tính năng nhắc nhở Micro-break để giãn cơ đều đặn mỗi 45 phút, bảo vệ xương khớp.",
  "Nhấp từng ngụm nước lọc nhỏ đều đặn để cấp ẩm liên tục cho giác mạc mắt đang căng thẳng.",
  "Sử dụng quy tắc 20-20-20 nhìn ra xa 6m để cơ mắt không bị mệt mỏi điều tiết quá mức.",
  "Một chút hạt dinh dưỡng (hạnh nhân, óc chó) sẽ bổ dung lượng calo vừa đủ không gây buồn ngủ.",
  "Tối ưu hóa năng lực tập trung bằng cách tắt hết chuông thông báo điện thoại không khẩn cấp.",
  "Vặn mình trái phải và hít thở sâu bằng cơ bụng 5 lượt để nạp đầy lượng oxy mới cho máu.",
  "Để một cốc nước mát cạnh tay. Cứ mỗi lần ngắt dòng code thì nhấp một ngụm xua tan mệt mỏi.",
  "Giữ nhiệt độ phòng mát mẻ (~25 độ C) giúp giữ đầu óc sáng suốt, tránh cảm giác uể oải dồn dập.",
  "Giải quyết các công việc có độ khó trung bình trước, sau đó giảm dần độ khó về cuối ca đêm."
];

const HIGH_ENERGY_ADVICES = [
  "Năng lượng rực rỡ! Đây chính là thời điểm vàng để làm các task khó, nghiên cứu thuật toán sâu.",
  "Độ tập trung cao độ nhưng đừng quên uống nước lọc đều đặn, mắt của bạn vẫn cần điều tiết nghỉ ngơi.",
  "Tận dụng đà hưng phấn để viết tài liệu dự án, vẽ sơ đồ tư duy hoặc giải quyết bug cứng đầu.",
  "Tránh uống thêm cafein lúc này kẻo bị ép tim hoặc mất ngủ kéo dài khó ngủ bù ngày mai.",
  "Cân đối nhịp làm việc: cứ sau mỗi 45 phút ngồi đỉnh cao, hãy đứng dậy đi lại giải tỏa tĩnh mạch chân.",
  "Nhạc Lofi dịu nhẹ hoặc nhạc không lời Baroque sẽ hỗ trợ trạng thái Deep Work của bạn bền bỉ nhất.",
  "Ghi chép nhanh các ý tưởng đột phá nảy sinh ra giấy ghim để tránh làm ngắt quãng dòng suy nghĩ.",
  "Mặc dù năng lượng dồi dào, hãy giữ vững tư thế ngồi thẳng, khớp chân 90 độ bảo toàn cột sống.",
  "Hạn chế tuyệt đối làm việc quá giới hạn thức đêm dự tính, tránh làm suy sụp hệ miễn dịch.",
  "Năng lượng dồi dào hỗ trợ sáng tạo vượt bậc, hãy hoàn thành nhanh để đi ngủ đúng giờ bù sinh học."
];

const LOFI_TRACKS = [
  { title: "Cozy Night Code", artist: "Lofi Dreamer", duration: 225 },
  { title: "Midnight Espresso", artist: "Code & Chill", duration: 260 },
  { title: "Cyberpunk Terminal", artist: "Hacker Vibes", duration: 195 },
  { title: "Raindrops on Window", artist: "Sleepy Owl", duration: 300 },
  { title: "Neon Skyline", artist: "Synthwave Cadet", duration: 235 }
];

export default function HealthTab({ user }: { user: any }) {
  // Mode switcher: standard or nightOwl
  const [healthMode, setHealthMode] = useState<'standard' | 'nightOwl'>(() => {
    return (localStorage.getItem('taskflow_health_mode') as 'standard' | 'nightOwl') || 'standard';
  });

  // Night Owl Active state: when false, sections below are locked/hidden
  const [isNightOwlActive, setIsNightOwlActive] = useState<boolean>(() => {
    return localStorage.getItem('taskflow_is_night_owl_active') === 'true';
  });

  // Night Owl: Night energy
  const [nightEnergy, setNightEnergy] = useState<'low' | 'mid' | 'high'>(() => {
    return (localStorage.getItem('taskflow_night_energy') as 'low' | 'mid' | 'high') || 'mid';
  });

  // Randomized advices
  const [lowAdviceIdx, setLowAdviceIdx] = useState<number>(() => Math.floor(Math.random() * 10));
  const [midAdviceIdx, setMidAdviceIdx] = useState<number>(() => Math.floor(Math.random() * 10));
  const [highAdviceIdx, setHighAdviceIdx] = useState<number>(() => Math.floor(Math.random() * 10));

  // Count-up Stopwatch state
  const [isNightTimerRunning, setIsNightTimerRunning] = useState<boolean>(() => {
    return localStorage.getItem("taskflow_night_timer_running") === "true";
  });
  const [nightTimerSeconds, setNightTimerSeconds] = useState<number>(() => {
    return Number(localStorage.getItem("taskflow_night_timer_base_seconds")) || 0;
  });
  const [nightTimerStartTimestamp, setNightTimerStartTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem("taskflow_night_timer_start_timestamp")) || 0;
  });
  const [nightTimerLimitHours, setNightTimerLimitHours] = useState<number>(() => {
    return Number(localStorage.getItem("taskflow_night_timer_limit_hours")) || 0;
  });

  // Live seconds for display and notifications
  const [liveNightTimer, setLiveNightTimer] = useState<number>(0);

  // Micro-break reminder states
  const [microBreakEnabled, setMicroBreakEnabled] = useState<boolean>(() => {
    return localStorage.getItem("taskflow_night_microbreak_enabled") !== "false";
  });
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  const [lastNotifiedSecond, setLastNotifiedSecond] = useState<number>(0);
  const [lastNotifiedLimit, setLastNotifiedLimit] = useState<boolean>(false);

  // Playlist states
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isLofiPlaying, setIsLofiPlaying] = useState<boolean>(false);
  const [lofiProgress, setLofiProgress] = useState<number>(0);

  // Custom Checklist states
  interface NightCheckItem {
    id: string;
    text: string;
    completed: boolean;
  }
  const [nightChecklist, setNightChecklist] = useState<NightCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem(`taskflow_night_checklist_${user?.uid || 'default'}`);
      return saved ? JSON.parse(saved) : [
        { id: '1', text: 'Chuẩn bị bình nước lọc đầy', completed: false },
        { id: '2', text: 'Bật chế độ đọc sách / Night Light', completed: false },
        { id: '3', text: 'Giảm độ sáng màn hình', completed: false }
      ];
    } catch {
      return [];
    }
  });
  const [newCheckItemText, setNewCheckItemText] = useState<string>('');

  // Accordion open/close state
  const [expandedTipIds, setExpandedTipIds] = useState<Record<string, boolean>>({});

  // Concurrent Reminder Timers State
  const [timers, setTimers] = useState<Record<string, ActiveTimer>>({});

  // Water Intake tracking: 1/8 cups of water
  const [waterIntakeCount, setWaterIntakeCount] = useState<number>(0);

  // 1-month water logs history tracking key values YYYY-MM-DD
  const [waterLogs, setWaterLogs] = useState<Record<string, number>>({});

  // Monthly calendar state with standard controls
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());

  // Real-time tracking of work statistics (in hours) loaded from localStorage
  const [totalWorkHours, setTotalWorkHours] = useState<number>(0);
  const [avgWorkHours, setAvgWorkHours] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const scanStats = () => {
      let totalSeconds = 0;
      let dayCount = 0;
      
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`taskflow_today_work_seconds_${uid}_`)) {
            const val = Number(localStorage.getItem(key)) || 0;
            if (val > 0) {
              totalSeconds += val;
              dayCount++;
            }
          }
        }
      } catch (e) {
        console.error("Lỗi quét thống kê giờ làm việc:", e);
      }
      
      const rawTotalHours = totalSeconds / 3600;
      setTotalWorkHours(Math.round(rawTotalHours * 10) / 10);
      
      const avg = dayCount > 0 ? (totalSeconds / dayCount) / 3600 : 0;
      setAvgWorkHours(Math.round(avg * 10) / 10);
    };

    scanStats();
    window.addEventListener('storage', scanStats);
    window.addEventListener('health-sync', scanStats);
    const interval = setInterval(scanStats, 4000);
    return () => {
      window.removeEventListener('storage', scanStats);
      window.removeEventListener('health-sync', scanStats);
      clearInterval(interval);
    };
  }, [user]);

  // Sync state with storage immediately
  useEffect(() => {
    const syncHealth = () => {
      if (!user) return;
      const uid = user.uid;
      const todayStr = new Date().toLocaleDateString('sv');
      try {
        const lastDateKey = `health_${uid}_water_last_date`;
        const savedDate = localStorage.getItem(lastDateKey);

        let count = 0;
        if (savedDate !== todayStr) {
          localStorage.setItem(lastDateKey, todayStr);
          localStorage.setItem(`health_${uid}_water_intake_count`, '0');
          localStorage.setItem(`health_${uid}_show_water_congrats`, 'false');
        } else {
          const savedCount = localStorage.getItem(`health_${uid}_water_intake_count`);
          count = savedCount ? parseInt(savedCount, 10) : 0;
        }
        setWaterIntakeCount(count);

        const logsKey = `health_${uid}_water_logs`;
        let logs: Record<string, number> = {};
        const savedLogsStr = localStorage.getItem(logsKey);

        if (savedLogsStr) {
          logs = JSON.parse(savedLogsStr);
        } else {
          logs = {};
          localStorage.setItem(logsKey, JSON.stringify(logs));
        }

        logs[todayStr] = count;
        localStorage.setItem(logsKey, JSON.stringify(logs));
        setWaterLogs(logs);

        const currentMode = (localStorage.getItem('taskflow_health_mode') as 'standard' | 'nightOwl') || 'standard';
        setHealthMode(currentMode);

        const currentNightActive = localStorage.getItem('taskflow_is_night_owl_active') === 'true';
        setIsNightOwlActive(currentNightActive);

        const savedStr = localStorage.getItem(`health_${uid}_reminders_map`);
        if (savedStr) {
          setTimers(JSON.parse(savedStr));
        } else {
          setTimers({});
        }
      } catch (e) {
        console.error("Lỗi sync dữ khỏe:", e);
      }
    };

    syncHealth();
    window.addEventListener('health-sync', syncHealth);
    window.addEventListener('storage', syncHealth);
    return () => {
      window.removeEventListener('health-sync', syncHealth);
      window.removeEventListener('storage', syncHealth);
    };
  }, [user]);

  // Audio chime generation with AudioContext
  const playGentleSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.6);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
      osc2.start(audioCtx.currentTime + 0.2);
      osc2.stop(audioCtx.currentTime + 0.9);
    } catch (e) {
      console.warn("Chime blocked by browser context:", e);
    }
  };

  // Synchronise stopwatch variables to local storage on changes
  useEffect(() => {
    localStorage.setItem("taskflow_night_timer_running", String(isNightTimerRunning));
    localStorage.setItem("taskflow_night_timer_base_seconds", String(nightTimerSeconds));
    localStorage.setItem("taskflow_night_timer_start_timestamp", String(nightTimerStartTimestamp));
    localStorage.setItem("taskflow_night_timer_limit_hours", String(nightTimerLimitHours));
  }, [isNightTimerRunning, nightTimerSeconds, nightTimerStartTimestamp, nightTimerLimitHours]);

  useEffect(() => {
    localStorage.setItem('taskflow_health_mode', healthMode);
  }, [healthMode]);

  useEffect(() => {
    localStorage.setItem('taskflow_night_energy', nightEnergy);
  }, [nightEnergy]);

  useEffect(() => {
    localStorage.setItem("taskflow_night_microbreak_enabled", String(microBreakEnabled));
  }, [microBreakEnabled]);

  const getNightStopwatchValue = () => {
    if (!isNightTimerRunning || nightTimerStartTimestamp === 0) {
      return nightTimerSeconds;
    }
    const elapsed = Math.floor((Date.now() - nightTimerStartTimestamp) / 1000);
    return nightTimerSeconds + elapsed;
  };

  useEffect(() => {
    let intervalId: any = null;
    if (isNightTimerRunning) {
      intervalId = setInterval(() => {
        setLiveNightTimer(getNightStopwatchValue());
      }, 1000);
    } else {
      setLiveNightTimer(getNightStopwatchValue());
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isNightTimerRunning, nightTimerStartTimestamp, nightTimerSeconds]);

  // Accumulate Night Owl Timer seconds to the daily statistics
  useEffect(() => {
    if (!isNightTimerRunning || !user?.uid) return;
    const uid = user.uid;
    
    let lastTicked = Date.now();
    
    const intervalId = setInterval(() => {
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - lastTicked) / 1000);
      if (elapsedSec > 0) {
        // Get today date string in Swedish 'sv' format (YYYY-MM-DD)
        const dateStr = new Date().toLocaleDateString('sv');
        const key = `taskflow_today_work_seconds_${uid}_${dateStr}`;
        const currentVal = Number(localStorage.getItem(key)) || 0;
        localStorage.setItem(key, String(currentVal + elapsedSec));
        
        lastTicked += elapsedSec * 1000;
        
        // Notify other components/stats graphs to scan and display
        window.dispatchEvent(new Event('health-sync'));
        window.dispatchEvent(new StorageEvent('storage', {
          key: key,
          newValue: String(currentVal + elapsedSec)
        }));
      }
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
      // Flush any lingering seconds
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - lastTicked) / 1000);
      if (elapsedSec > 0) {
        const dateStr = new Date().toLocaleDateString('sv');
        const key = `taskflow_today_work_seconds_${uid}_${dateStr}`;
        const currentVal = Number(localStorage.getItem(key)) || 0;
        localStorage.setItem(key, String(currentVal + elapsedSec));
        window.dispatchEvent(new Event('health-sync'));
        window.dispatchEvent(new StorageEvent('storage', {
          key: key,
          newValue: String(currentVal + elapsedSec)
        }));
      }
    };
  }, [isNightTimerRunning, user?.uid]);

  useEffect(() => {
    if (liveNightTimer > 0 && liveNightTimer % 2700 === 0 && liveNightTimer !== lastNotifiedSecond) {
      if (microBreakEnabled) {
        setLastNotifiedSecond(liveNightTimer);
        setShowBreakModal(true);
        playGentleSound();
      }
    }

    if (nightTimerLimitHours > 0) {
      const limitSec = nightTimerLimitHours * 3600;
      if (liveNightTimer >= limitSec && !lastNotifiedLimit) {
        setLastNotifiedLimit(true);
        setShowLimitModal(true);
        playGentleSound();
      }
    }
  }, [liveNightTimer, microBreakEnabled, lastNotifiedSecond, nightTimerLimitHours, lastNotifiedLimit]);

  const startNightTimer = () => {
    setIsNightTimerRunning(true);
    const rightNow = Date.now();
    setNightTimerStartTimestamp(rightNow);
  };

  const stopNightTimer = () => {
    if (isNightTimerRunning) {
      const elapsed = Math.floor((Date.now() - nightTimerStartTimestamp) / 1000);
      setNightTimerSeconds(prev => prev + elapsed);
      setIsNightTimerRunning(false);
      setNightTimerStartTimestamp(0);
    }
  };

  const resetNightTimer = () => {
    setIsNightTimerRunning(false);
    setNightTimerSeconds(0);
    setNightTimerStartTimestamp(0);
    setLastNotifiedLimit(false);
    setLiveNightTimer(0);
  };

  // Music Player logic
  useEffect(() => {
    let musicIntervalId: any = null;
    if (isLofiPlaying) {
      musicIntervalId = setInterval(() => {
        setLofiProgress(prev => {
          const currentTrack = LOFI_TRACKS[currentTrackIndex];
          if (prev >= currentTrack.duration) {
            setCurrentTrackIndex(p => (p + 1) % LOFI_TRACKS.length);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (musicIntervalId) clearInterval(musicIntervalId);
    };
  }, [isLofiPlaying, currentTrackIndex]);

  // Custom Checklist actions
  const addNightCheckItem = () => {
    if (!newCheckItemText.trim()) return;
    const newItem = {
      id: Date.now().toString(),
      text: newCheckItemText.trim(),
      completed: false
    };
    const nextList = [...nightChecklist, newItem];
    setNightChecklist(nextList);
    localStorage.setItem(`taskflow_night_checklist_${user?.uid || 'default'}`, JSON.stringify(nextList));
    setNewCheckItemText('');
  };

  const toggleNightCheckItem = (id: string) => {
    const nextList = nightChecklist.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setNightChecklist(nextList);
    localStorage.setItem(`taskflow_night_checklist_${user?.uid || 'default'}`, JSON.stringify(nextList));
  };

  const deleteNightCheckItem = (id: string) => {
    const nextList = nightChecklist.filter(t => t.id !== id);
    setNightChecklist(nextList);
    localStorage.setItem(`taskflow_night_checklist_${user?.uid || 'default'}`, JSON.stringify(nextList));
  };

  // Health tips block - Backed up lifestyle & health handbooks
  const healthTips: HealthTip[] = [
    {
      id: 'water',
      category: 'NƯỚC & DINH DƯỠNG',
      title: 'Uống đủ nước',
      badge: 'Quan trọng nhất',
      shortDesc: '2 – 2.5 lít / ngày, đừng chờ khát mới uống',
      detail: 'Đặt một bình nước 500ml cạnh bàn làm việc. Cứ mỗi 1 tiếng, uống hết một ly. Nước lọc tự nhiên là tốt nhất, hạn chế tối đa việc lạm dụng trà sữa, cà phê đậm đặc hay nước ngọt có ga. Uống thiếu nước sẽ làm lưu thông máu kém, gây giảm sút sự tập trung, mệt mỏi thể chất và đau đầu âm ỉ.',
      icon: <Droplet size={20} />,
      iconBgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
    },
    {
      id: 'rule20',
      category: 'VẬN ĐỘNG & TƯ THẾ',
      title: 'Quy tắc 20-20-20',
      badge: 'Cho mắt',
      shortDesc: 'Mỗi 20 phút nhìn xa 20 feet (~6m) trong 20 giây',
      detail: 'Nhìn liên tục vào nguồn bức xạ màn hình hẹp làm tăng mỏi cơ điều tiết, gây mờ và khô giác mạc. Hãy duy trì thói quen hướng ánh mắt ra ngoài cửa sổ hoặc tập trung vào vật thể xanh mát ở xa cứ sau 20 phút. Bạn có thể sử dụng bộ hẹn giờ nhắc nhở bên dưới để rèn luyện thói quen tự động này.',
      icon: <Brain size={20} />, // Fallback icon instead of Eye
      iconBgColor: 'bg-indigo-500/10',
      iconColor: 'text-indigo-400',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
    },
    {
      id: 'posture',
      category: 'VẬN ĐỘNG & TƯ THẾ',
      title: 'Tư thế ngồi Ergonomic',
      badge: 'Tránh đau mỏi',
      shortDesc: 'Giữ lưng thẳng, mắt ngang tầm màn hình, khuỷu tay vuông góc',
      detail: 'Ngồi làm việc sai tư thế kéo dài gây thoái hóa cột sống cổ và lưng. Hãy điều chỉnh độ cao của ghế để hông và đầu gối song song mặt sàn, bàn chân đặt phẳng trên sàn. Màn hình máy tính cần được đặt xa khoảng 50-70cm và mép trên ngang tầm mắt của bạn.',
      icon: <Activity size={20} />,
      iconBgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
    },
    {
      id: 'sleep',
      category: 'GIẤC NGỦ & TÁI TẠO',
      title: 'Thiết lập chu kỳ ngủ',
      badge: 'Phục hồi',
      shortDesc: 'Ngủ đủ 7 - 8 tiếng và thức dậy đúng giờ giấc cố định',
      detail: 'Giấc ngủ sâu từ 23 giờ đêm đến 3 giờ sáng giúp cơ thể loại bỏ độc tố tự nhiên và củng cố hệ thống miễn dịch trung ương. Tránh sử dụng các nguồn ánh sáng xanh độc hại từ điện thoại hay laptop ít nhất 30 phút trước ngủ để hormone Melatonin hoạt động chính xác.',
      icon: <Moon size={20} />,
      iconBgColor: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
    },
    {
      id: 'stretch',
      category: 'VẬN ĐỘNG & TƯ THẾ',
      title: 'Vận động ngắt quãng 5 phút',
      badge: 'Lưu thông máu',
      shortDesc: 'Đứng dậy di chuyển, vươn vai căng duỗi cơ bắp',
      detail: 'Ngồi làm việc liên tục quá lâu tăng cường áp lực lên hệ xương khớp và làm giảm 40% hiệu suất trao đổi chất của hệ tuần hoàn. Hãy đứng dậy vươn tay căng vai gáy mỗi 45 - 60 phút, đi bộ nhẹ nhàng hoặc thực hiện vài bài tập thở bụng sâu để giải phóng sự căng thẳng.',
      icon: <RotateCcw size={20} />,
      iconBgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
    }
  ];

  const presets = [
    { id: 'water', label: '💧 60 phút (Nước)', seconds: 60 * 60, name: 'UỐNG NƯỚC BÙ NƯỚC' },
    { id: 'eyes', label: '👀 20 phút (Mắt)', seconds: 20 * 60, name: 'QUY TẮC 20-20-20 (MẮT)' },
    { id: 'walk', label: '🚶 45 phút (Đi lại)', seconds: 45 * 60, name: 'ĐỨNG DẬY VÀ DI CHUYỂN' },
    { id: 'pomo', label: '🍅 25 phút (Pomodoro)', seconds: 25 * 60, name: 'POMODORO TẬP TRUNG' }
  ];

  const presetStyles: Record<string, {
    barColor: string;
    pulseClass: string;
    textColor: string;
    icon: React.ReactNode;
    bgActive: string;
    labelColor: string;
  }> = {
    water: {
      barColor: 'bg-blue-500',
      pulseClass: 'animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.9)] border-blue-400',
      textColor: 'text-blue-400',
      icon: <Droplet size={11} className="text-blue-400 fill-blue-500/20" />,
      bgActive: 'bg-blue-500/5 border-blue-500/40 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.12)]',
      labelColor: 'text-blue-400'
    },
    eyes: {
      barColor: 'bg-slate-400',
      pulseClass: 'animate-pulse shadow-[0_0_15px_rgba(156,163,175,0.9)] border-slate-300',
      textColor: 'text-slate-400',
      icon: <Brain size={11} className="text-slate-450" />,
      bgActive: 'bg-slate-500/5 border-slate-500/30 text-slate-300 shadow-[0_0_20px_rgba(156,163,175,0.1)]',
      labelColor: 'text-slate-400'
    },
    walk: {
      barColor: 'bg-orange-500',
      pulseClass: 'animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.9)] border-orange-400',
      textColor: 'text-orange-400',
      icon: <Activity size={11} className="text-orange-400" />,
      bgActive: 'bg-orange-500/5 border-orange-500/40 text-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.12)]',
      labelColor: 'text-orange-400'
    },
    pomo: {
      barColor: 'bg-emerald-500',
      pulseClass: 'animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.9)] border-emerald-400',
      textColor: 'text-emerald-400',
      icon: <Brain size={11} className="text-emerald-400" />,
      bgActive: 'bg-emerald-500/5 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.12)]',
      labelColor: 'text-emerald-400'
    }
  };

  const updateWaterCount = (count: number) => {
    if (!user) return;
    const uid = user.uid;
    setWaterIntakeCount(count);
    localStorage.setItem(`health_${uid}_water_intake_count`, count.toString());
  };

  const toggleTip = (id: string) => {
    setExpandedTipIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleToggleNightOwlActive = (active: boolean) => {
    if (active) {
      const hour = new Date().getHours();
      const allowed = hour >= 23 || hour < 7;
      if (!allowed) return;
    }
    setIsNightOwlActive(active);
    localStorage.setItem('taskflow_is_night_owl_active', String(active));
    
    if (active) {
      if (user) {
        const uid = user.uid;
        try {
          const savedStr = localStorage.getItem(`health_${uid}_reminders_map`);
          if (savedStr) {
            const map = JSON.parse(savedStr);
            Object.keys(map).forEach(key => {
              if (map[key]) {
                map[key].isTimerActive = false;
              }
            });
            localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(map));
            setTimers(map);
          }
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      stopNightTimer();
    }
    
    window.dispatchEvent(new Event('health-sync'));
  };

  const startPresetTimer = (presetId: string) => {
    if (!user) return;
    const uid = user.uid;
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    setTimers(prev => {
      const nowMs = Date.now();
      const next = {
        ...prev,
        [presetId]: {
          totalSeconds: preset.seconds,
          remainingSeconds: preset.seconds,
          isTimerActive: true,
          lastTick: nowMs
        }
      };
      localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(next));
      return next;
    });
  };

  const stopPresetTimer = (presetId: string) => {
    if (!user) return;
    const uid = user.uid;
    setTimers(prev => {
      if (!prev[presetId]) return prev;
      const next = {
        ...prev,
        [presetId]: {
          ...prev[presetId],
          isTimerActive: false
        }
      };
      localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(next));
      return next;
    });
  };

  const handlePresetCardClick = (presetId: string) => {
    const t = timers[presetId];
    if (!t || !t.isTimerActive || t.remainingSeconds <= 0) {
      startPresetTimer(presetId);
    }
  };

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Convert flat tips list into categories
  const tipsByCategory: Record<string, HealthTip[]> = {};
  healthTips.forEach(tip => {
    if (!tipsByCategory[tip.category]) {
      tipsByCategory[tip.category] = [];
    }
    tipsByCategory[tip.category].push(tip);
  });

  // No duplicate decrementing timers loop here. App.tsx centrally manages background countdowns.

  return (
    <div className="space-y-8 select-none">
      {/* Title & Banner area */}
      <div className="bg-[#111113] border border-white/5 p-6 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full" />
        
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/25 rounded-full text-blue-400 text-[10px] font-bold uppercase tracking-widest">
            💚 Y Khoa Lối Sống Freelancer
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight leading-none text-left">Chăm Sóc Sức Khỏe Chủ Động</h2>
          <p className="text-sm text-slate-400 max-w-xl text-left">
            Ngăn chặn tình trạng mỏi mệt cột sống lưng, khô mỏi giác mạc và kiệt quệ năng suất bằng cách áp dụng các mốc chu kỳ nhắc nhở đồng hành tuyệt đẹp dưới đây.
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-[#111113]/80 border border-white/5 p-1 rounded-2xl w-fit relative z-10 gap-1 overflow-hidden">
        <div className="relative">
          {healthMode === 'standard' && (
            <motion.div
              layoutId="healthActiveBg"
              className="absolute inset-0 rounded-xl bg-indigo-600 shadow-lg border border-indigo-500/30"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <button
            type="button"
            disabled={isNightOwlActive}
            onClick={() => {
              if (isNightOwlActive) return;
              setHealthMode('standard');
            }}
            className={`relative z-10 px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-300 flex items-center gap-2 select-none cursor-pointer ${
              isNightOwlActive
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : healthMode === 'standard'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
            title={isNightOwlActive ? "Hoàn thành phiên Cú Đêm để mở lại Sức Khỏe Chủ Động" : ""}
          >
            <Activity size={13} />
            Sức khỏe Chủ Động {isNightOwlActive && "🔒"}
          </button>
        </div>

        <div className="relative">
          {healthMode === 'nightOwl' && (
            <motion.div
              layoutId="healthActiveBg"
              className="absolute inset-0 rounded-xl bg-[#1e1e24] shadow-md border border-white/10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <button
            type="button"
            onClick={() => setHealthMode('nightOwl')}
            className={`relative z-10 px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-300 flex items-center gap-2 select-none cursor-pointer ${
              healthMode === 'nightOwl'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon size={13} />
            Chế độ Cú đêm
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={healthMode}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="w-full"
        >
          {healthMode === 'standard' ? (
            <StandardHealthView
              user={user}
              timers={timers}
              waterIntakeCount={waterIntakeCount}
              setWaterIntakeCount={updateWaterCount}
              waterLogs={waterLogs}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              currentYear={currentYear}
              setCurrentYear={setCurrentYear}
              totalWorkHours={totalWorkHours}
              avgWorkHours={avgWorkHours}
              startPresetTimer={startPresetTimer}
              stopPresetTimer={stopPresetTimer}
              handlePresetCardClick={handlePresetCardClick}
              formatTime={formatTime}
              tipsByCategory={tipsByCategory}
              expandedTipIds={expandedTipIds}
              toggleTip={toggleTip}
              presets={presets}
              presetStyles={presetStyles}
            />
          ) : (
            <NightOwlView
              user={user}
              nightEnergy={nightEnergy}
              setNightEnergy={setNightEnergy}
              isNightOwlActive={isNightOwlActive}
              onToggleNightOwlActive={handleToggleNightOwlActive}
              setHealthMode={setHealthMode}
              lowAdviceIdx={lowAdviceIdx}
              setLowAdviceIdx={setLowAdviceIdx}
              midAdviceIdx={midAdviceIdx}
              setMidAdviceIdx={setMidAdviceIdx}
              highAdviceIdx={highAdviceIdx}
              setHighAdviceIdx={setHighAdviceIdx}
              liveNightTimer={liveNightTimer}
              nightTimerLimitHours={nightTimerLimitHours}
              setNightTimerLimitHours={setNightTimerLimitHours}
              setLastNotifiedLimit={setLastNotifiedLimit}
              isNightTimerRunning={isNightTimerRunning}
              startNightTimer={startNightTimer}
              stopNightTimer={stopNightTimer}
              resetNightTimer={resetNightTimer}
              microBreakEnabled={microBreakEnabled}
              setMicroBreakEnabled={setMicroBreakEnabled}
              currentTrackIndex={currentTrackIndex}
              setCurrentTrackIndex={setCurrentTrackIndex}
              isLofiPlaying={isLofiPlaying}
              setIsLofiPlaying={setIsLofiPlaying}
              lofiProgress={lofiProgress}
              setLofiProgress={setLofiProgress}
              nightChecklist={nightChecklist}
              setNightChecklist={setNightChecklist}
              newCheckItemText={newCheckItemText}
              setNewCheckItemText={setNewCheckItemText}
              addNightCheckItem={addNightCheckItem}
              toggleNightCheckItem={toggleNightCheckItem}
              deleteNightCheckItem={deleteNightCheckItem}
              LOW_ENERGY_ADVICES={LOW_ENERGY_ADVICES}
              MID_ENERGY_ADVICES={MID_ENERGY_ADVICES}
              HIGH_ENERGY_ADVICES={HIGH_ENERGY_ADVICES}
              LOFI_TRACKS={LOFI_TRACKS}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Popups Overlaid Modals */}
      <AnimatePresence>
        {showBreakModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#111113] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto text-2xl animate-bounce">
                ⏱️
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Đã làm việc 45 phút!</h3>
                <p className="text-sm text-slate-300">
                  Nghỉ 5 phút, nhìn xa, uống nước
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakModal(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tôi đã hiểu, tiếp tục
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#111113] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-2xl">
                🚨
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Hết thời gian thức đêm!</h3>
                <p className="text-sm text-slate-300">
                  Giới hạn thời gian thức đêm của bạn đã hết. Hãy tắt máy nghỉ ngơi để bảo vệ sức khỏe của bạn!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Đồng ý, đi ngủ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
