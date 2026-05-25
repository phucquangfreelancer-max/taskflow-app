import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  Calendar, 
  CheckSquare, 
  LayoutDashboard, 
  Clock, 
  TrendingUp,

  LogOut,
  User,
  Heart,
  Droplet,
  Trophy,
  AlertTriangle,
  Volume2,

  RefreshCw
} from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
// Tabs
import TaskEntryTab from './components/TaskEntryTab';
import AIPlanTab from './components/AIPlanTab';
import ChecklistTab from './components/ChecklistTab';
import HealthTab from './components/HealthTab';

import FloatingAIChat from './components/FloatingAIChat';
import LoginScreen from './components/LoginScreen';
import { sendNotification, playThreeBeeps } from './lib/utils';

const WATER_QUOTES = [
  "Sức khỏe tốt kéo dài tuổi thọ và nâng tầm thành công của một lập trình viên tinh anh.",
  "Chăm sóc cơ thể chu đáo chính là nền móng vững chãi cho những ý tưởng vĩ đại.",
  "Uống đủ nước lọc tự nhiên giống như dọn sạch rác bẩn trong hệ tuần hoàn của bạn.",
  "Một tâm hồn hạnh phúc luôn trú ngụ sâu sắc trong một cơ thể tràn đầy thể lực khỏe mạnh.",
  "Sức khỏe bất diệt không phải thứ tự nhiên có, đó là kết quả của thói quen sống lành mạnh hằng ngày.",
  "Một ngụm nước mát lọc trong xua tan căng thẳng tâm lý, đưa trí tuệ bạn lên tầng đỉnh cao.",
  "Đầu tư thời gian bảo vệ đôi mắt và vóc dáng hôm nay để viết tiếp hành trình sáng tạo tươi sáng mai sau.",
  "Nước uống là thần dược tự nhiên miễn phí nhất để khởi động hiệu suất công việc trường tồn.",
  "Thư giãn cơ vai cổ gáy và uống đủ nước lọc giúp cải thiện lưu lượng máu lên não tối hậu.",
  "Hãy tử tế với cơ thể mình, bạn sẽ ngạc nhiên trước năng suất làm việc phi thường mà nó mang lại."
];

function playHealthBeepTwoTimes() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const playTones = () => {
      [0, 160, 320].forEach((delayMs) => {
        setTimeout(() => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1100, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.14);
          } catch (e) {}
        }, delayMs);
      });
    };

    // Play once immediately
    playTones();

    // Play second time after 1200ms
    setTimeout(() => {
      playTones();
    }, 1200);

  } catch (err) {
    console.error("Synthesizer Alarm failed:", err);
  }
}

export default function App() {
const [splashDone, setSplashDone] = useState(false);
  const [splashStatus, setSplashStatus] = useState<'loading' | 'no-internet' | 'done'>('loading');

  useEffect(() => {
    const check = async () => {
      await new Promise(r => setTimeout(r, 3500));
      try {
        await fetch('https://www.google.com', { mode: 'no-cors', cache: 'no-store' });
        setSplashStatus('done');
        setTimeout(() => setSplashDone(true), 500);
      } catch {
        setSplashStatus('no-internet');
      }
    };
    check();
  }, []);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { 
      setUser(u); 
      setAuthReady(true);
    });
    return () => unsub();
  }, []);
  const [activeTab, setActiveTab] = useState<'entry' | 'plan' | 'checklist' | 'health' | 'ai'>('checklist');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Settings & Reset app states





  // Synchronized Health reminding background states
  const [healthWaterCount, setHealthWaterCount] = useState<number>(0);
  const [healthTriggeredAlarms, setHealthTriggeredAlarms] = useState<string[]>([]);
  const [healthShowCongrats, setHealthShowCongrats] = useState<boolean>(false);
  const [healthRandomQuote, setHealthRandomQuote] = useState<string>('');

  // Keep alert sound playing on a loop when alarms are triggered and unconfirmed
  useEffect(() => {
    if (healthTriggeredAlarms.length === 0) return;

    // Play once right away
    playHealthBeepTwoTimes();

    const intervalId = setInterval(() => {
      playHealthBeepTwoTimes();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [healthTriggeredAlarms]);
  
  // Real-time synchronization of Night Owl status for navigation label/glowing class
  const [healthMode, setHealthMode] = useState<'standard' | 'nightOwl'>(() => {
    return (localStorage.getItem('taskflow_health_mode') as 'standard' | 'nightOwl') || 'standard';
  });
  const [isNightOwlActive, setIsNightOwlActive] = useState<boolean>(() => {
    return localStorage.getItem('taskflow_is_night_owl_active') === 'true';
  });

  const displayWaterCount = Math.min(8, healthWaterCount + 1);

  const getTodayStr = () => {
    return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  };

  const loadUserHealthData = (uid: string) => {
    try {
      const today = getTodayStr();
      const lastDateKey = `health_${uid}_water_last_date`;
      const savedDate = localStorage.getItem(lastDateKey);

      let count = 0;
      if (savedDate !== today) {
        localStorage.setItem(lastDateKey, today);
        localStorage.setItem(`health_${uid}_water_intake_count`, '0');
        localStorage.setItem(`health_${uid}_show_water_congrats`, 'false');
      } else {
        const savedCount = localStorage.getItem(`health_${uid}_water_intake_count`);
        count = savedCount ? parseInt(savedCount, 10) : 0;
      }
      setHealthWaterCount(count);

      const savedTriggered = localStorage.getItem(`health_${uid}_triggered_alarms`);
      setHealthTriggeredAlarms(savedTriggered ? JSON.parse(savedTriggered) : []);

      const congrats = localStorage.getItem(`health_${uid}_show_water_congrats`) === 'true';
      setHealthShowCongrats(congrats);
    } catch (e) {
      console.error("Lỗi khi load dữ liệu sức khỏe user:", e);
    }
  };

  useEffect(() => {
    const handleSync = () => {
      // Always sync healthMode and isNightOwlActive to remain updated across tab views
      const currentMode = (localStorage.getItem('taskflow_health_mode') as 'standard' | 'nightOwl') || 'standard';
      const activeNight = localStorage.getItem('taskflow_is_night_owl_active') === 'true';
      setHealthMode(currentMode);
      setIsNightOwlActive(activeNight);

      if (!user) return;
      const uid = user.uid;
      try {
        const count = localStorage.getItem(`health_${uid}_water_intake_count`);
        setHealthWaterCount(count ? parseInt(count, 10) : 0);

        const savedTriggered = localStorage.getItem(`health_${uid}_triggered_alarms`);
        setHealthTriggeredAlarms(savedTriggered ? JSON.parse(savedTriggered) : []);

        const congrats = localStorage.getItem(`health_${uid}_show_water_congrats`) === 'true';
        setHealthShowCongrats(congrats);
      } catch (e) {
        console.error(e);
      }
    };

    handleSync();
    window.addEventListener('health-sync', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('health-sync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user]);

  // Scroll to top when activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Timer Tick implementation specifically on the global App space
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const handleHealthTickOnApp = () => {
      try {
        // --- Day rollover check ---
        const today = getTodayStr();
        const lastDateKey = `health_${uid}_water_last_date`;
        const savedDate = localStorage.getItem(lastDateKey);
        if (savedDate !== today) {
          localStorage.setItem(lastDateKey, today);
          localStorage.setItem(`health_${uid}_water_intake_count`, '0');
          localStorage.setItem(`health_${uid}_show_water_congrats`, 'false');
          
          setHealthWaterCount(0);
          setHealthShowCongrats(false);
          
          // Clear water-specific alarms if active so they reset
          const currentTriggers = JSON.parse(localStorage.getItem(`health_${uid}_triggered_alarms`) || '[]');
          const nextTriggers = currentTriggers.filter((id: string) => id !== 'water');
          localStorage.setItem(`health_${uid}_triggered_alarms`, JSON.stringify(nextTriggers));
          setHealthTriggeredAlarms(nextTriggers);
          
          window.dispatchEvent(new Event('health-sync'));
        }
        // ---------------------------

        const savedStr = localStorage.getItem(`health_${uid}_reminders_map`);
        if (!savedStr) return;

        const map = JSON.parse(savedStr) as Record<string, any>;
        let stateChanged = false;
        const newlyFinished: string[] = [];

        Object.keys(map).forEach(id => {
          const t = map[id];
          if (t && t.isTimerActive && t.remainingSeconds > 0) {
            const nowMs = Date.now();
            const lastTickMs = Number(t.lastTick) || nowMs;
            const elapsedSec = Math.max(1, Math.floor((nowMs - lastTickMs) / 1000));
            const nextSec = Math.max(0, t.remainingSeconds - elapsedSec);
            map[id] = {
              ...t,
              remainingSeconds: nextSec,
              lastTick: nowMs
            };
            stateChanged = true;

            if (nextSec === 0) {
              map[id].isTimerActive = false;
              newlyFinished.push(id);
            }
          }
        });

        if (newlyFinished.length > 0) {
          // Sync Triggers list
          const currentTriggers = JSON.parse(localStorage.getItem(`health_${uid}_triggered_alarms`) || '[]');
          const nextTriggers = [...currentTriggers];
          newlyFinished.forEach(id => {
            if (!nextTriggers.includes(id)) {
              nextTriggers.push(id);
            }
          });
          localStorage.setItem(`health_${uid}_triggered_alarms`, JSON.stringify(nextTriggers));
          setHealthTriggeredAlarms(nextTriggers);

          // Triggers Native Push Notifications
          const presets = [
            { id: 'water', name: 'UỐNG NƯỚC BÙ NƯỚC' },
            { id: 'eyes', name: 'QUY TẮC 20-20-20 (MẮT)' },
            { id: 'walk', name: 'ĐỨNG DẬY VÀ DI CHUYỂN' },
            { id: 'pomo', name: 'POMODORO TẬP TRUNG' }
          ];

          newlyFinished.forEach(id => {
            const pr = presets.find(p => p.id === id);
            const prName = pr ? pr.name : "Nhắc nhở sức khỏe";
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification("Sức khỏe hàng đầu!", {
                  body: `Đã hết thời gian: ${prName}. Hãy tạm gác công việc để thư giãn!`,
                  icon: "/favicon.ico"
                });
              } catch (_) {}
            }
          });
        }

        if (stateChanged || newlyFinished.length > 0) {
          localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(map));
          window.dispatchEvent(new Event('health-sync'));
        }
      } catch (e) {
        console.error("Health Tick run error on App component context: ", e);
      }
    };

    const interval = setInterval(handleHealthTickOnApp, 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        loadUserHealthData(u.uid);
        setActiveTab('checklist');
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.send('resize-window', 1280, 800);
        } catch {}
      }
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return unsubscribe;
  }, []);

  // Background timer listener to keep countdown / pomodoro running and trigger notifications even when ChecklistTab is unmounted or in secondary tabs
  useEffect(() => {
    const handleBackgroundTimer = () => {
      const isRunning = localStorage.getItem("taskflow_timer_running") === "true";
      if (!isRunning) return;

      const startTimestamp = Number(localStorage.getItem("taskflow_timer_start_timestamp")) || 0;
      if (startTimestamp === 0) return;

      const timerMode = localStorage.getItem("taskflow_timer_mode") || "up";
      const timer = Number(localStorage.getItem("taskflow_timer_base_seconds")) || 0;
      const pomodoroEnabled = localStorage.getItem("taskflow_timer_pomodoro_enabled") === "true";
      const pomodoroTimer = Number(localStorage.getItem("taskflow_timer_pomodoro_base_seconds")) || 0;
      const activeTaskStr = localStorage.getItem("taskflow_timer_active_task");
      const activeTask = activeTaskStr ? JSON.parse(activeTaskStr) : null;
      const notificationsEnabled = localStorage.getItem("taskflow_timer_notifications") === "true";

      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);

      if (timerMode === "down") {
        const remaining = timer - elapsed;
        if (remaining <= 0) {
          localStorage.setItem("taskflow_timer_running", "false");
          localStorage.setItem("taskflow_timer_base_seconds", "0");
          localStorage.setItem("taskflow_timer_start_timestamp", "0");
          localStorage.setItem("taskflow_timer_active_task", "");
          localStorage.setItem("taskflow_timer_mode", "up");
          localStorage.setItem("taskflow_timer_pomodoro_base_seconds", "0");
          localStorage.setItem("taskflow_timer_pomodoro_enabled", "false");
          
          const token = `down_${activeTask?.id || 'none'}_${startTimestamp}`;
          if (localStorage.getItem("taskflow_last_notified") !== token) {
            localStorage.setItem("taskflow_last_notified", token);
            if (notificationsEnabled) {
              sendNotification("Hết giờ!", `Công việc ${activeTask?.name || 'Task'} đã hoàn thành.`);
              playThreeBeeps();
            }
          }
        }
      }

      if (pomodoroEnabled) {
        const pomValue = pomodoroTimer + elapsed;
        if (pomValue >= 25 * 60) {
          localStorage.setItem("taskflow_timer_running", "false");
          localStorage.setItem("taskflow_timer_base_seconds", "0");
          localStorage.setItem("taskflow_timer_start_timestamp", "0");
          localStorage.setItem("taskflow_timer_active_task", "");
          localStorage.setItem("taskflow_timer_mode", "up");
          localStorage.setItem("taskflow_timer_pomodoro_base_seconds", "0");
          localStorage.setItem("taskflow_timer_pomodoro_enabled", "false");

          const token = `pomo_${activeTask?.id || 'none'}_${startTimestamp}`;
          if (localStorage.getItem("taskflow_last_notified") !== token) {
            localStorage.setItem("taskflow_last_notified", token);
            if (notificationsEnabled) {
              sendNotification("Pomodoro hoàn thành!", "Đã hết 25 phút làm việc tập trung.");
              playThreeBeeps();
            }
          }
        }
      }
    };

    const interval = setInterval(handleBackgroundTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      const cleanBuggyTasks = async () => {
        try {
          const { collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
          const { db } = await import('./firebase');
          const q = query(
            collection(db, 'tasks'),
            where('userId', '==', user.uid),
            where('name', '==', 'ăn')
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        } catch (error) {
          console.error("Lỗi khi dọn dẹp task ăn:", error);
        }
      };
      cleanBuggyTasks();
    }
  }, [user]);

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const logout = () => {
    // Collect and stop the active timers before logging out
    if (user) {
      const uid = user.uid;
      const mapKey = `health_${uid}_reminders_map`;
      const savedStr = localStorage.getItem(mapKey);
      if (savedStr) {
        try {
          const map = JSON.parse(savedStr);
          Object.keys(map).forEach(id => {
            if (map[id]) {
              map[id].isTimerActive = false;
              map[id].remainingSeconds = 0;
              map[id].totalSeconds = 0;
            }
          });
          localStorage.setItem(mapKey, JSON.stringify(map));
        } catch (e) {
          console.error(e);
        }
      }
      localStorage.removeItem(`health_${uid}_triggered_alarms`);
      localStorage.removeItem(`health_${uid}_show_water_congrats`);
    }

    // Clear custom timer storage upon sign out
    localStorage.removeItem("taskflow_timer_running");
    localStorage.removeItem("taskflow_timer_mode");
    localStorage.removeItem("taskflow_timer_base_seconds");
    localStorage.removeItem("taskflow_timer_start_timestamp");
    localStorage.removeItem("taskflow_timer_pomodoro_base_seconds");
    localStorage.removeItem("taskflow_timer_active_task");
    localStorage.removeItem("taskflow_timer_notifications");
    localStorage.removeItem("taskflow_timer_pomodoro_enabled");
    localStorage.removeItem("taskflow_last_notified");

    setHealthWaterCount(0);
    setHealthTriggeredAlarms([]);
    setHealthShowCongrats(false);
    setHealthRandomQuote('');

    // Also dispatch event immediately so other components reload
    setTimeout(() => {
      window.dispatchEvent(new Event('health-sync'));
    }, 100);

    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('resize-window', 430, 760);
    } catch {}
    signOut(auth);
  };

  const jumpToChecklist = (date: Date) => {
    setSelectedDate(date);
    setActiveTab('checklist');
  };

  const handleConfirmWaterIntake = () => {
    if (!user) return;
    const uid = user.uid;
    const currentCount = parseInt(localStorage.getItem(`health_${uid}_water_intake_count`) || '0', 10);
    const nextCount = currentCount + 1;
    localStorage.setItem(`health_${uid}_water_intake_count`, nextCount.toString());
    setHealthWaterCount(nextCount);

    // Dismiss the water trigger
    const currentTriggers = JSON.parse(localStorage.getItem(`health_${uid}_triggered_alarms`) || '[]');
    const nextTriggers = currentTriggers.filter((id: string) => id !== 'water');
    localStorage.setItem(`health_${uid}_triggered_alarms`, JSON.stringify(nextTriggers));
    setHealthTriggeredAlarms(nextTriggers);

    try {
      const savedMapStr = localStorage.getItem(`health_${uid}_reminders_map`);
      if (savedMapStr) {
        const nextMap = JSON.parse(savedMapStr);
        if (nextCount >= 8) {
          // Reached 2L/8 cups! Show blue congrats modal
          const randomQuote = WATER_QUOTES[Math.floor(Math.random() * WATER_QUOTES.length)];
          setHealthRandomQuote(randomQuote);
          localStorage.setItem(`health_${uid}_show_water_congrats`, 'true');
          setHealthShowCongrats(true);
          
          // Stop water timer countdown automatically
          if (nextMap['water']) {
            nextMap['water'].totalSeconds = 0;
            nextMap['water'].remainingSeconds = 0;
            nextMap['water'].isTimerActive = false;
            nextMap['water'].lastTick = Date.now();
          }
        } else {
          // Restart 60 minutes water timer
          if (nextMap['water']) {
            nextMap['water'].totalSeconds = 60 * 60;
            nextMap['water'].remainingSeconds = 60 * 60;
            nextMap['water'].isTimerActive = true;
            nextMap['water'].lastTick = Date.now();
          }
        }
        localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(nextMap));
      }
    } catch (e) {
      console.error(e);
    }

    // Dispatch global sync event
    window.dispatchEvent(new Event('health-sync'));
  };

  const resetWaterTarget = () => {
    if (!user) return;
    const uid = user.uid;
    localStorage.setItem(`health_${uid}_water_intake_count`, '0');
    setHealthWaterCount(0);
    localStorage.setItem(`health_${uid}_show_water_congrats`, 'false');
    setHealthShowCongrats(false);

    try {
      const savedMapStr = localStorage.getItem(`health_${uid}_reminders_map`);
      if (savedMapStr) {
        const nextMap = JSON.parse(savedMapStr);
        if (nextMap['water']) {
          nextMap['water'].totalSeconds = 60 * 60;
          nextMap['water'].remainingSeconds = 60 * 60;
          nextMap['water'].isTimerActive = true;
          nextMap['water'].lastTick = Date.now();
        }
        localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(nextMap));
      }
    } catch (e) {}

    window.dispatchEvent(new Event('health-sync'));
  };

  const stopAllGeneralAlarmsAndLoop = () => {
    if (!user) return;
    const uid = user.uid;
    const currentTriggers = JSON.parse(localStorage.getItem(`health_${uid}_triggered_alarms`) || '[]');
    const nonWaterTriggered = currentTriggers.filter((id: string) => id !== 'water');

    try {
      const savedMapStr = localStorage.getItem(`health_${uid}_reminders_map`);
      if (savedMapStr) {
        const nextMap = JSON.parse(savedMapStr);
        
        // Loop restart parameters
        const presets = [
          { id: 'water', seconds: 60 * 60 },
          { id: 'eyes', seconds: 20 * 60 },
          { id: 'walk', seconds: 45 * 60 },
          { id: 'pomo', seconds: 25 * 60 }
        ];

        nonWaterTriggered.forEach((id: string) => {
          const pr = presets.find(p => p.id === id);
          if (pr && nextMap[id]) {
            nextMap[id] = {
              totalSeconds: pr.seconds,
              remainingSeconds: pr.seconds,
              isTimerActive: true,
              lastTick: Date.now()
            };
          }
        });

        localStorage.setItem(`health_${uid}_reminders_map`, JSON.stringify(nextMap));
      }
    } catch (e) {}

    // Dismiss non-water triggers
    const leftTriggers = currentTriggers.filter((id: string) => id === 'water');
    localStorage.setItem(`health_${uid}_triggered_alarms`, JSON.stringify(leftTriggers));
    setHealthTriggeredAlarms(leftTriggers);

    // Dispatch global sync event
    window.dispatchEvent(new Event('health-sync'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0A0B]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }
  if (!splashDone || !authReady) {
    return null;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (isClosed) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center text-slate-400 font-sans relative overflow-hidden select-none">
        {/* Neon desktop ambient glowing light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 blur-3xl rounded-full" />
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-[#111113] rounded-3xl p-8 border border-white/5 shadow-2xl relative z-10 space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-center text-indigo-550 shadow-inner">
            <CheckSquare size={28} className="text-indigo-400 opacity-40 animate-pulse" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">TaskFlow Đã Đóng</h2>
            <p className="text-xs text-slate-400 leading-relaxed balance">
              Cơ chế mô phỏng cửa sổ ngoại tuyến đã dừng. Toàn bộ dữ liệu của bạn, bao gồm công việc, checklist thành quả, và lịch trình uống nước đều được bảo toàn an toàn trong bộ nhớ máy tính cục bộ này (Local Storage).
            </p>
          </div>

          <button
            onClick={() => setIsClosed(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw size={13} className="animate-spin-hover" />
            Khởi động lại phần mềm
          </button>
        </motion.div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="min-h-screen bg-[#070708] flex items-end justify-center pb-12 p-6 text-slate-400 font-sans relative overflow-hidden select-none">
        {/* Ambient desktop light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 blur-3xl rounded-full" />
        
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          className="bg-[#111113]/90 backdrop-blur-xl border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl py-3.5 px-5 shadow-2xl z-50 cursor-pointer flex items-center gap-3.5 transition-all duration-300 hover:scale-105 active:scale-95 text-left"
        >
          <div className="relative">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md">
              <CheckSquare size={16} />
            </div>
            {/* Pulsing indicator light */}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider block">TaskFlow đang chạy ẩn</span>
            <span className="text-xs text-white font-bold">Bấm vào đây để phóng to khôi phục cửa sổ</span>
          </div>
        </motion.div>
      </div>
    );
  }
  if (!splashDone) {
    return (
      <div className="w-full h-screen bg-transparent flex items-center justify-center select-none">
        <div className="bg-[#111113] border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-6 w-80 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
              <CheckSquare size={32} className="text-indigo-400" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-white tracking-tight">TaskFlow</h1>
              <p className="text-slate-500 text-xs mt-1">Quản lý công việc thông minh</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col items-center gap-3 w-full relative z-10">
            {splashStatus === 'loading' && (
              <>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-indigo-500 rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'easeInOut' }} />
                </div>
                <p className="text-slate-500 text-xs">Đang khởi động...</p>
              </>
            )}
            {splashStatus === 'no-internet' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <AlertTriangle size={14} className="text-rose-400" />
                </div>
                <p className="text-rose-400 text-xs font-semibold">Không có kết nối mạng</p>
                <p className="text-slate-500 text-xs">Tính năng AI sẽ không hoạt động</p>
                <button onClick={() => setSplashDone(true)} className="mt-1 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-xs font-semibold transition-all cursor-pointer">
                  Vào app anyway
                </button>
              </div>
            )}
            {splashStatus === 'done' && (
              <p className="text-indigo-400 text-xs font-semibold">✓ Sẵn sàng!</p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }
  return (
    <div className="font-sans text-slate-300">
      {/* Operating System desktop background wallpapers with blur lights */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* FIXED PC SCREEN APP WRAPPER WINDOW DEVICE */}
      <div className="w-full h-screen bg-[#0A0A0B] flex flex-col overflow-hidden rounded-[24px]">
        {/* PC Window Custom Title Bar (Simulated Window OS frame) */}
        <header className="bg-[#111113] border-b border-white/5 h-14 shrink-0 select-none relative" style={{WebkitAppRegion:'drag'} as any}>
          <div className="w-full px-5 h-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
                <CheckSquare size={16} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-white leading-none">TaskFlow</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Phần mềm quản lý công việc</span>
              </div>
            </div>
            {user && (
              <div className="flex flex-col items-end gap-1.5" style={{WebkitAppRegion:'no-drag'} as any}>
                <span className="text-[11px] font-semibold text-slate-300 leading-none truncate max-w-[200px]">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut size={9} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Main Desktop Workspace Area */}
        <div className="flex-1 overflow-y-auto flex flex-col relative bg-[#09090a]">
          <main className="max-w-[1350px] mx-auto px-16 py-6 pb-28 flex-1 w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'entry' && (
                <motion.div
                  key="entry"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TaskEntryTab user={user} />
                </motion.div>
              )}
              {activeTab === 'plan' && (
                <motion.div
                  key="plan"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <AIPlanTab user={user} onJumpToChecklist={jumpToChecklist} />
                </motion.div>
              )}
              {activeTab === 'checklist' && (
                <motion.div
                  key="checklist"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChecklistTab user={user} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                </motion.div>
              )}
              {activeTab === 'health' && (
                <motion.div
                  key="health"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <HealthTab user={user} />
                </motion.div>
              )}

            </AnimatePresence>

            <FloatingAIChat user={user} />


            {/* Brand/Developer Footer Credits */}
            <footer className="mt-16 pt-8 pb-32 border-t border-white/5 flex flex-col items-start justify-start gap-4 text-left">
              <p className="text-xs text-slate-500 font-medium">
                Ứng dụng được phát triển bởi <span className="text-indigo-400 font-semibold">Phuc Quang</span>.
              </p>
              <div className="flex items-center gap-2">
                <a 
                  href="https://www.facebook.com/phuc257" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/15 hover:border-blue-500/35 text-blue-400 text-[11px] font-semibold transition-all flex items-center gap-1"
                >
                  <span>Facebook</span>
                </a>
                <a 
                  href="https://zalo.me/0818909755" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-sky-600/10 hover:bg-sky-600/20 border border-sky-500/15 hover:border-sky-500/35 text-sky-400 text-[11px] font-semibold transition-all flex items-center gap-1"
                >
                  <span>Zalo</span>
                </a>
              </div>
            </footer>
          </main>
        </div>

        {/* Pinned Tabbed Navigation Bar inside Application Frame Window */}
        <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#111113]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] shadow-2xl p-1.5 flex items-center gap-1 z-40">
        <TabButton 
          active={activeTab === 'entry'} 
          onClick={() => setActiveTab('entry')}
          icon={<PlusCircle size={18} />}
          label="Công việc"
        />
        <TabButton 
          active={activeTab === 'checklist'} 
          onClick={() => setActiveTab('checklist')}
          icon={<CheckSquare size={18} />}
          label="Checklist"
        />
        <TabButton 
          active={activeTab === 'plan'} 
          onClick={() => setActiveTab('plan')}
          icon={<Calendar size={18} />}
          label="Thống kê"
        />
        <TabButton 
          active={activeTab === 'health'} 
          onClick={() => setActiveTab('health')}
          icon={<Heart size={18} />}
          label={(healthMode === 'nightOwl' && isNightOwlActive) ? "Cú đêm" : "Sức khỏe"}
          isNightOwlPulse={healthMode === 'nightOwl' && isNightOwlActive}
        />

      </nav>
      </div>

      {/* GLOBAL HEALTH WARNING OVERLAYS OR ALARMS SCREEN PANELS */}
      
      {/* 1. BLUE WATER DRINK REMINDER MODAL WINDOW (HORIZONTAL REDESIGN, WITHOUT SKIP BUTTON) */}
      <AnimatePresence>
        {healthTriggeredAlarms.includes('water') && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f1423] border-2 border-blue-500/40 rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden"
            >
              {/* Soft Pulsing blue decoration circle background */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full animate-pulse" />

              {/* Water droplet header indicator */}
              <div className="relative mx-auto w-16 h-16 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center">
                <Droplet size={28} className="fill-blue-550/20 text-blue-450 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">Uống nước thôi nào 💧</h3>
              </div>

              {/* HORIZONTAL GLASS BOTTLE INDIVIDUAL SEGMENTS */}
              <div className="bg-[#14192b] border border-white/5 p-5 rounded-3xl flex flex-col items-center justify-center gap-4">
                
                <div className="w-full px-1 flex flex-col items-center">
                  <div className="relative w-full h-16 bg-slate-950/80 rounded-2xl border border-blue-500/20 flex items-center justify-start p-1.5 shadow-inner overflow-hidden">
                    
                    {/* Inner progress indicators: 8 segments, active ones filled with flowing blue color */}
                    <div className="w-full flex h-full gap-1 p-1 z-10">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                        const isActive = displayWaterCount >= idx;
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 h-full rounded-lg transition-all duration-500 relative flex flex-col justify-between p-1 overflow-hidden ${
                              isActive 
                                ? 'bg-gradient-to-br from-blue-500 to-sky-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]' 
                                : 'bg-slate-900/40 border border-white/5'
                            }`}
                          >
                            <span className={`text-[8px] font-mono font-bold self-end leading-none ${isActive ? 'text-white' : 'text-slate-600'}`}>
                              {idx}
                            </span>
                            <span className={`text-[8px] font-mono font-medium block text-center truncate leading-none ${isActive ? 'text-white/95' : 'text-slate-500'}`}>
                              {idx * 250}
                            </span>
                            {/* Wave texture overlay for active segments */}
                            {isActive && (
                              <div className="absolute inset-0 bg-blue-300/10 animate-pulse mix-blend-overlay" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Counter status label */}
                <div className="text-center">
                  <span className="text-2xl font-black text-white block mt-0.5 animate-bounce">
                    {displayWaterCount} <span className="text-sm font-semibold text-blue-400">/ 8 lần</span>
                  </span>
                  <p className="text-[10px] text-blue-400 font-bold mt-1">
                    Đạt {displayWaterCount * 250}ml / 2000ml
                  </p>
                </div>
              </div>

              {/* Interactive confirmation action: incremental water addition & loop timer restart */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConfirmWaterIntake}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl transition-all border border-blue-400/20 shadow-[0_4px_15px_rgba(59,130,246,0.25)] active:scale-95 text-sm uppercase tracking-wider block cursor-pointer"
                >
                  🥛 Đã Uống Xong 250ml Nước
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. CONGRATULATIONS CELEBRATION MODAL FOR REACHING 100% (2 LITERS / 8 CUPS DRANK TARGET) */}
      <AnimatePresence>
        {healthShowCongrats && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-[#0b1329] border-2 border-emerald-500/40 rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_60px_rgba(16,185,129,0.35)] relative overflow-hidden"
            >
              {/* Confetti style neon decorations */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-2xl rounded-full" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-sky-500/5 blur-2xl rounded-full" />

              <div className="relative mx-auto w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center animate-bounce">
                <Trophy size={38} className="text-emerald-400" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  🎉 MỤC TIÊU HOÀN THÀNH
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Tuyệt Vời! Đã Đủ 2 Lít Nước</h3>
                <p className="text-xs text-slate-300">
                  Cơ thể của bạn đã ngập tràn năng lượng hoạt động lành mạnh. Bạn đã hoàn thành xuất sắc 8 lần uống của ngày hôm nay!
                </p>
              </div>

              {/* SPECIAL HEALTH RANDOM QUOTE CONTAINER */}
              <div className="bg-[#121b36] border border-emerald-500/20 p-5 rounded-2xl text-left relative overflow-hidden">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">Lời Khuyên Sức Khỏe Truyền Cảm Hứng</span>
                <p className="text-xs text-slate-200 font-medium italic leading-relaxed">
                  "{healthRandomQuote || WATER_QUOTES[0]}"
                </p>
              </div>

              {/* Actions controls layout */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    localStorage.setItem('health_show_water_congrats', 'false');
                    setHealthShowCongrats(false);
                    window.dispatchEvent(new Event('health-sync'));
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.35)] active:scale-95 text-sm uppercase tracking-wider cursor-pointer"
                >
                  Cảm ơn và tiếp tục làm việc!
                </button>
                
                <button
                  onClick={resetWaterTarget}
                  className="w-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold py-2 px-6 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-white/5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Reset thiết lập uống nước từ đầu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. GENERAL ALARM OVERLAY: (NON-WATER alarms ending count) */}
      <AnimatePresence>
        {healthTriggeredAlarms.filter(id => id !== 'water').length > 0 && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            {(() => {
              const activeAlarms = healthTriggeredAlarms.filter(id => id !== 'water');
              const primaryAlarmId = activeAlarms[0];

              let borderClass = "border-rose-500/40";
              let glowClass = "shadow-[0_0_50px_rgba(239,68,68,0.25)]";
              let bgGlow = "bg-red-500/20";
              let iconColorClass = "text-[#f43f5e]";
              let iconBgClass = "bg-rose-500/10 border-rose-500/20";
              let bannerLabelColor = "text-rose-500";
              let listBulletColor = "text-rose-400 font-bold";
              let audioBorderClass = "bg-rose-500/5 border-rose-500/15";
              let audioTextColor = "text-rose-400";
              let buttonStyleClass = "bg-rose-600 hover:bg-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.25)] text-white";

              // Map colors precisely: White (slaty/white), Orange (cam), Green (xanh lá)
              if (primaryAlarmId === 'eyes') {
                // Trắng / White
                borderClass = "border-white/30";
                glowClass = "shadow-[0_0_50px_rgba(255,255,255,0.15)]";
                bgGlow = "bg-white/10";
                iconColorClass = "text-white";
                iconBgClass = "bg-white/10 border-white/20";
                bannerLabelColor = "text-slate-300";
                listBulletColor = "text-white font-black";
                audioBorderClass = "bg-white/5 border-white/15";
                audioTextColor = "text-slate-300";
                buttonStyleClass = "bg-white text-black hover:bg-slate-200 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.15)]";
              } else if (primaryAlarmId === 'walk') {
                // Cam / Orange
                borderClass = "border-orange-500/40";
                glowClass = "shadow-[0_0_50px_rgba(249,115,22,0.35)]";
                bgGlow = "bg-orange-500/20";
                iconColorClass = "text-orange-400";
                iconBgClass = "bg-orange-500/10 border-orange-500/20";
                bannerLabelColor = "text-orange-500";
                listBulletColor = "text-orange-400 font-bold";
                audioBorderClass = "bg-orange-500/5 border-orange-500/15";
                audioTextColor = "text-orange-400";
                buttonStyleClass = "bg-orange-600 hover:bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] text-white";
              } else if (primaryAlarmId === 'pomo') {
                // Xanh lá / Green
                borderClass = "border-emerald-500/40";
                glowClass = "shadow-[0_0_50px_rgba(16,185,129,0.35)]";
                bgGlow = "bg-emerald-500/20";
                iconColorClass = "text-emerald-400";
                iconBgClass = "bg-emerald-500/10 border-emerald-500/20";
                bannerLabelColor = "text-emerald-500";
                listBulletColor = "text-emerald-400 font-bold";
                audioBorderClass = "bg-emerald-500/5 border-emerald-500/15";
                audioTextColor = "text-emerald-400";
                buttonStyleClass = "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white";
              }

              return (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className={`bg-[#111113] border-2 ${borderClass} rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 ${glowClass} relative overflow-hidden`}
                >
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 ${bgGlow} blur-3xl rounded-full animate-pulse`} />

                  <div className={`relative mx-auto w-20 h-20 ${iconBgClass} border-2 rounded-full flex items-center justify-center animate-bounce`}>
                    <AlertTriangle size={36} className={iconColorClass} />
                  </div>

                  <div className="space-y-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${bannerLabelColor} animate-pulse`}>Thời Gian Bảo Vệ Sức Khỏe Đã Đến Hạn</span>
                    <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
                      Đã Đến Lúc Nghỉ Ngơi!
                    </h3>
                    <div className="text-xs text-slate-400 leading-relaxed text-left space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="font-semibold text-slate-300">Nhắc nhở kết thúc hoàn thành:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {healthTriggeredAlarms.filter(id => id !== 'water').map(id => {
                          const presetsList = [
                            { id: 'water', name: 'UỐNG NƯỚC BÙ NƯỚC' },
                            { id: 'eyes', name: 'QUY TẮC 20-20-20 (MẮT)' },
                            { id: 'walk', name: 'ĐỨNG DẬY VÀ DI CHUYỂN' },
                            { id: 'pomo', name: 'POMODORO TẬP TRUNG' }
                          ];
                          const alarmName = presetsList.find(p => p.id === id)?.name || "Nhắc nhở sức khỏe";
                          return <li key={id} className={listBulletColor}>{alarmName}</li>;
                        })}
                      </ul>
                      <p className="text-[11px] text-slate-400 pt-1.5 border-t border-white/5">
                        Hãy dừng công việc hiện tại, đứng dậy, vươn vai thư giãn bả vai gáy và tập trung nhìn xa tầm mắt để hít thở sâu! Đồng hồ sẽ tự động bắt đầu tính giờ lại sau khi xác nhận.
                      </p>
                    </div>
                  </div>

                  {/* Audio beacon indicator */}
                  <div className={`${audioBorderClass} py-3 px-4 rounded-xl flex items-center justify-center gap-2.5`}>
                    <Volume2 size={16} className={audioTextColor} />
                    <span className={`text-[10px] font-extrabold ${audioTextColor} uppercase tracking-widest`}>
                      Âm thanh cảnh báo đã phát xong...
                    </span>
                  </div>

                  <button
                    onClick={stopAllGeneralAlarmsAndLoop}
                    className={`w-full ${buttonStyleClass} font-bold py-4 px-6 rounded-2xl transition-all outline-none border border-transparent active:scale-95 text-sm uppercase tracking-wider cursor-pointer`}
                  >
                    Đồng ý / Đã Thư Giãn Xong
                  </button>
                </motion.div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  isNightOwlPulse 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  isNightOwlPulse?: boolean; 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer
        ${isNightOwlPulse 
          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-pulse' 
          : active 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
            : 'text-slate-400 hover:text-white hover:bg-white/5'}
      `}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
