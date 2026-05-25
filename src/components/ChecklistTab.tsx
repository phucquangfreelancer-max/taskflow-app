import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Circle, 
  Clock,
  Volume2,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Award
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { format, addDays, getDay, isSameDay, isSameMonth } from 'date-fns';
import { cn, sendNotification, playThreeBeeps } from '../lib/utils';
import { quotes } from '../data/quotes';
import FireworksCanvas from './FireworksCanvas';

const DAY_MAP: Record<number, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7'
};

const CONGRATS_MESSAGES = [
  { title: "Bạn đã hoàn thành tất cả task hôm nay rồi! 🎉🥳", subtitle: "Bạn nghỉ ngơi được rồi 🍀☕" },
  { title: "Xuất sắc! Mọi mục tiêu hôm nay đã hoàn tất! ✨🏆", subtitle: "Nằm lười xem phim thôi nào! 🎬🍿" },
  { title: "Kỷ luật thép đã mang lại chiến thắng hôm nay! 💪🔥", subtitle: "Tận hưởng làn gió mát lành tối nay nhé! 🍃🍹" },
  { title: "Oài, hôm nay bạn làm việc siêu quá! 🚀🌟", subtitle: "Tắt máy tính, thư giãn đầu óc thôi nào! 🧘‍♂️💤" },
  { title: "Bạn đã cày nát checklist hôm nay! 📚🎯", subtitle: "Không còn áp lực gì nữa, xả hơi thôi! 🎮🍕" },
  { title: "Sự kiên trì của bạn thật phi thường! 💖🌷", subtitle: "Nghỉ ngơi và bổ sung chút năng lượng ngọt nhé! 🍰🥤" },
  { title: "100% tiến độ! Bạn là người hùng hôm nay! 🦸‍♂️👸", subtitle: "Đứng dậy vươn vai và nghe bản nhạc yêu thích đi! 🎵🎧" },
  { title: "Chiến thắng rực rỡ dành cho ngày hôm nay! 🏵️🎖️", subtitle: "Dành thời gian hạnh phúc bên gia đình và bạn bè thôi! 🏡❤️" },
  { title: "Mọi việc khó khăn nhất đều đã vượt qua! 🏔️🚲", subtitle: "Chăm sóc bản thân bằng một giấc ngủ thật sâu nhé! 🌙😴" },
  { title: "Năng suất vô song! Bạn quá tuyệt vời! ⚡🥇", subtitle: "Hãy tự thưởng cho mình một món ngon tối nay! 🍲🍣" },
  { title: "Checklist sạch bóng! Quá hoàn hảo! 🧹💎", subtitle: "Thả lỏng cơ thể, gác lại lo âu và nghỉ ngơi thôi! 🛀🕯️" },
  { title: "Tự hào về những nỗ lực hôm nay của bạn! 🌈🥰", subtitle: "Một ly trà ấm ngọt ngào đang chờ đợi bạn đó! 🍵🍪" },
  { title: "Bạn đã chinh phục ngày hôm nay trọn vẹn! 🧗‍♀️🚩", subtitle: "Tận hưởng cảm giác nhẹ nhõm tuyệt hảo này đi! 🪁⛅" },
  { title: "Tuyệt đỉnh! Không một tác vụ nào bị bỏ sót! 🏹🎯", subtitle: "Đi dạo một chút hay đọc vài trang sách thư giãn nhé! 🌳📖" },
  { title: "Mục tiêu đã cán đích thành công tốt đẹp! 🏁🏃‍♂️", subtitle: "Chúc mừng bạn đã có một ngày tràn đầy giá trị! 🌟🌻" },
  { title: "Bạn đã gieo trồng những hạt giống tuyệt vời! 🌱🌾", subtitle: "Giờ là lúc thư thả ngắm nhìn thành quả thôi! 🎨🛋️" },
  { title: "Vượt qua thử thách một cách đầy tự hào! 🥊🏆", subtitle: "Đi ngủ sớm một chút để ngày mai tràn đầy năng lượng! 🛌✨" },
  { title: "Hiệu suất tuyệt đối, kỷ luật tối đa! 🤖🔥", subtitle: "Não bộ của bạn xứng đáng được nghỉ ngơi rồi! 🧠🍦" },
  { title: "Hôm nay bạn đã làm việc cực kỳ chăm chỉ! 🐝🌻", subtitle: "Hãy hít một hơi thật sâu và tận hưởng buổi tối bình yên nhé! 🧘‍♀️🌌" },
  { title: "Khép lại một ngày siêu năng suất thôi nào! 💼🔒", subtitle: "Đắp chăn, nhắm mắt và tự hào về bản thân hôm nay nhé! 🧸💖" }
];

const getDeadlineCountdown = (deadlineStr: string, deadlineTimeStr: string, now: Date) => {
  if (!deadlineStr) return '';
  const parts = deadlineStr.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts.map(Number);
  
  let hours = 23;
  let minutes = 59;
  if (deadlineTimeStr) {
    const timeParts = deadlineTimeStr.split(':');
    if (timeParts.length === 2) {
      hours = Number(timeParts[0]);
      minutes = Number(timeParts[1]);
    }
  }
  
  const deadlineDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs < 0) {
    const absDiffMs = Math.abs(diffMs);
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const overHours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const overMinutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const overSeconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);
    
    const hStr = overHours.toString().padStart(2, '0');
    const mStr = overMinutes.toString().padStart(2, '0');
    const sStr = overSeconds.toString().padStart(2, '0');
    
    if (diffDays > 0) {
      return `Trễ ${diffDays} ngày ${hStr}:${mStr}:${sStr}`;
    }
    return `Trễ ${hStr}:${mStr}:${sStr}`;
  }
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  const hStr = diffHours.toString().padStart(2, '0');
  const mStr = diffMinutes.toString().padStart(2, '0');
  const sStr = diffSeconds.toString().padStart(2, '0');
  
  if (diffDays > 0) {
    return `Còn ${diffDays} ngày ${hStr}:${mStr}:${sStr}`;
  } else {
    return `Còn ${hStr}:${mStr}:${sStr}`;
  }
};

export default function ChecklistTab({ user, selectedDate, setSelectedDate }: { user: any, selectedDate: Date, setSelectedDate: React.Dispatch<React.SetStateAction<Date>> }) {
  const [tasks, setTasks] = useState<any[]>([]);
  
  // AI Quotes state
  const [quoteIndex, setQuoteIndex] = useState(() => {
    const savedIndex = localStorage.getItem("taskflow_quote_index");
    if (savedIndex !== null) return Number(savedIndex);
    return Math.floor(Date.now() / (25 * 60 * 1000)) % 100;
  });

  const handleNextQuote = () => {
    let nextIndex = Math.floor(Math.random() * 100);
    while (nextIndex === quoteIndex && quotes.length > 1) {
      nextIndex = Math.floor(Math.random() * 100);
    }
    const timeSlotIndex = Math.floor(Date.now() / (25 * 60 * 1000)) % 100;
    localStorage.setItem("taskflow_last_auto_index", String(timeSlotIndex));
    localStorage.setItem("taskflow_quote_index", String(nextIndex));
    setQuoteIndex(nextIndex);
  };

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Load initial states from localStorage for persistence across tab closure and navigation
  const [timer, setTimer] = useState(() => {
    return Number(localStorage.getItem("taskflow_timer_base_seconds")) || 0;
  });
  const [isTimerRunning, setIsTimerRunning] = useState(() => {
    return localStorage.getItem("taskflow_timer_running") === "true";
  });
  const [startTimestamp, setStartTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem("taskflow_timer_start_timestamp")) || 0;
  });

  const [todayWorkSeconds, setTodayWorkSeconds] = useState<number>(() => {
    const key = `taskflow_today_work_seconds_${user.uid}_${dateStr}`;
    return Number(localStorage.getItem(key)) || 0;
  });

  const [taskTimers, setTaskTimers] = useState<Record<string, {
    taskId: string;
    elapsedSeconds: number;
    monthlyElapsed?: Record<string, number>;
    isTimerRunning: boolean;
    startTimestamp: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem(`taskflow_task_timers_${user.uid}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const timerRef = useRef<any>(null);
  const [expandedProgressId, setExpandedProgressId] = useState<string | null>(null);
  const [viewingDonePct, setViewingDonePct] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(new Date());
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsIndex, setCongratsIndex] = useState(0);

  const loadedDateRef = useRef<string>(dateStr);

  // Load date's work seconds on mount or change of dateStr (guarantees separate values and daily reset)
  useEffect(() => {
    const key = `taskflow_today_work_seconds_${user.uid}_${dateStr}`;
    let stored = Number(localStorage.getItem(key)) || 0;

    // Self-correct on mount if stopwatch is active and has been running
    const mainRunning = localStorage.getItem("taskflow_timer_running") === "true";
    if (mainRunning) {
      const baseSec = Number(localStorage.getItem("taskflow_timer_base_seconds")) || 0;
      const startMs = Number(localStorage.getItem("taskflow_timer_start_timestamp")) || 0;
      if (startMs > 0) {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        const stopwatchVal = baseSec + elapsed;
        if (stopwatchVal > stored) {
          stored = stopwatchVal;
          localStorage.setItem(key, String(stored));
        }
      }
    }

    setTodayWorkSeconds(stored);
    loadedDateRef.current = dateStr;
  }, [dateStr, user.uid]);

  const syncTimersFromLocalStorage = React.useCallback(() => {
    const isRunning = localStorage.getItem("taskflow_timer_running") === "true";
    const baseSecs = Number(localStorage.getItem("taskflow_timer_base_seconds")) || 0;
    const startTs = Number(localStorage.getItem("taskflow_timer_start_timestamp")) || 0;
    
    setIsTimerRunning(isRunning);
    setTimer(baseSecs);
    setStartTimestamp(startTs);

    const todaySecs = Number(localStorage.getItem(`taskflow_today_work_seconds_${user.uid}_${dateStr}`)) || 0;
    setTodayWorkSeconds(todaySecs);

    const timersKey = `taskflow_task_timers_${user.uid}`;
    try {
      const storedTimers = localStorage.getItem(timersKey);
      setTaskTimers(storedTimers ? JSON.parse(storedTimers) : {});
    } catch (err) {
      console.error("Failed to parse stored task timers", err);
    }
  }, [user.uid, dateStr]);

  // Synchronize state on local database / AI command updates or across multiple tabs
  useEffect(() => {
    const handleStorageChange = (e: any) => {
      if (e instanceof StorageEvent) {
        if (e.key === "taskflow_timer_running") {
          setIsTimerRunning(e.newValue === "true");
        } else if (e.key === "taskflow_timer_base_seconds") {
          setTimer(Number(e.newValue) || 0);
        } else if (e.key === "taskflow_timer_start_timestamp") {
          setStartTimestamp(Number(e.newValue) || 0);
        } else if (e.key === `taskflow_today_work_seconds_${user.uid}_${dateStr}`) {
          setTodayWorkSeconds(Number(e.newValue) || 0);
        } else if (e.key === `taskflow_task_timers_${user.uid}`) {
          try {
            setTaskTimers(e.newValue ? JSON.parse(e.newValue) : {});
          } catch (err) {}
        } else if (e.key === "taskflow_quote_index") {
          setQuoteIndex(Number(e.newValue) || 0);
        }
      } else {
        syncTimersFromLocalStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-db-tasks-updated', syncTimersFromLocalStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-db-tasks-updated', syncTimersFromLocalStorage);
    };
  }, [user.uid, dateStr, syncTimersFromLocalStorage]);

  // Automated 25-minute boundary transition observer
  useEffect(() => {
    const handleInterval = () => {
      const timeSlotIndex = Math.floor(Date.now() / (25 * 60 * 1000)) % 100;
      const lastKnownAutoSlot = localStorage.getItem("taskflow_last_auto_index");
      
      if (lastKnownAutoSlot !== String(timeSlotIndex)) {
        localStorage.setItem("taskflow_last_auto_index", String(timeSlotIndex));
        localStorage.setItem("taskflow_quote_index", String(timeSlotIndex));
        setQuoteIndex(timeSlotIndex);
      }
    };

    handleInterval();
    const interval = setInterval(handleInterval, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute today's progress stats dynamically
  const completedTasksCount = tasks.filter(t => t.completedDates?.includes(dateStr)).length;
  const totalTasksCount = tasks.length;
  const progressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Clear congrats state on future date change if the user has unchecked a task
  useEffect(() => {
    if (totalTasksCount > 0 && progressPct < 100) {
      const key = `taskflow_congrats_${dateStr}`;
      localStorage.removeItem(key);
    }
  }, [progressPct, totalTasksCount, dateStr]);

  // Compute precise real-time values to bypass browser setInterval background throttling
  const getStopwatchValue = () => {
    if (!isTimerRunning || startTimestamp === 0) {
      return timer;
    }
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    return timer + elapsed;
  };

  const isAnyTimerRunning = () => {
    if (isTimerRunning) return true;
    return Object.values(taskTimers).some(t => t.isTimerRunning);
  };

  const syncTodayWorkBeforeStateChange = () => {
    const running = isAnyTimerRunning();
    if (!running) return;
    
    const nowMs = Date.now();
    const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
    const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
    
    if (lastTickVal > 0) {
      const elapsedSec = Math.floor((nowMs - lastTickVal) / 1000);
      if (elapsedSec > 0) {
        setTodayWorkSeconds(prev => {
          const stopwatchVal = getStopwatchValue();
          const nextVal = Math.max(prev + elapsedSec, stopwatchVal);
          localStorage.setItem(`taskflow_today_work_seconds_${user.uid}_${dateStr}`, String(nextVal));
          return nextVal;
        });
        localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(lastTickVal + (elapsedSec * 1000)));
      }
    }
  };

  const getTodayWorkValue = () => {
    const stopwatchVal = getStopwatchValue();
    const running = isAnyTimerRunning();
    let baseVal = todayWorkSeconds;
    if (running) {
      const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
      const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
      if (lastTickVal > 0) {
        const elapsedSec = Math.floor((Date.now() - lastTickVal) / 1000);
        baseVal = todayWorkSeconds + Math.max(0, elapsedSec);
      }
    }
    return Math.max(baseVal, stopwatchVal);
  };

  // Keep today's work seconds ticking when any timer is running
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const running = isAnyTimerRunning();
      const nowMs = Date.now();
      
      if (running) {
        const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
        const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
        
        if (lastTickVal > 0) {
          const elapsedSec = Math.floor((nowMs - lastTickVal) / 1000);
          if (elapsedSec > 0) {
            setTodayWorkSeconds(prev => {
              const stopwatchVal = getStopwatchValue();
              const nextVal = Math.max(prev + elapsedSec, stopwatchVal);
              localStorage.setItem(`taskflow_today_work_seconds_${user.uid}_${dateStr}`, String(nextVal));
              return nextVal;
            });
            localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(lastTickVal + (elapsedSec * 1000)));
          }
        } else {
          localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(nowMs));
        }
      } else {
        localStorage.removeItem(`taskflow_last_tick_time_${user.uid}`);
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      const running = isAnyTimerRunning();
      if (running) {
        const nowMs = Date.now();
        const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
        const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
        if (lastTickVal > 0) {
          const elapsedSec = Math.floor((nowMs - lastTickVal) / 1000);
          if (elapsedSec > 0) {
            setTodayWorkSeconds(prev => {
              const stopwatchVal = getStopwatchValue();
              const nextVal = Math.max(prev + elapsedSec, stopwatchVal);
              localStorage.setItem(`taskflow_today_work_seconds_${user.uid}_${dateStr}`, String(nextVal));
              return nextVal;
            });
            localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(lastTickVal + (elapsedSec * 1000)));
          }
        }
      }
    };
  }, [isTimerRunning, taskTimers, user.uid, dateStr]);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const dayName = DAY_MAP[getDay(selectedDate)];
      const filtered = allTasks.filter((task: any) => {
        const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date();
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const isCompletedOnThisDay = task.completedDates?.includes(dateStr);

        // If it is a short-term task, we don't limit it by the creation month.
        // It is visible on any day that has a positive chunk allocated, or was completed on that day.
        if (task.isShortTerm) {
          const isAllocated = task.shortTermAllocations && typeof task.shortTermAllocations[dateStr] === 'number' && task.shortTermAllocations[dateStr] > 0;
          return isAllocated || isCompletedOnThisDay;
        }

        // For regular tasks, check if it was created in the selected month
        const inSelectedMonth = isSameMonth(createdAt, selectedDate);
        if (!inSelectedMonth && !isCompletedOnThisDay) return false;

        const isTaskActiveOnDate = (t: any, d: Date) => {
          const createdVal = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
          const pCreated = new Date(createdVal.getFullYear(), createdVal.getMonth(), createdVal.getDate());
          const pDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return pDay >= pCreated;
        };

        if (!isTaskActiveOnDate(task, selectedDate) && !isCompletedOnThisDay) {
          return false;
        }

        if (task.cycle && Array.isArray(task.cycle)) {
          return task.cycle.includes(dayName);
        }
        
        if (!task.cycle) {
           return isSameDay(createdAt, selectedDate) || isCompletedOnThisDay;
        }
        return false;
      });

      setTasks(filtered);
    });
    return unsubscribe;
  }, [user.uid, selectedDate]);

  // unified timer ticking and countdown completion observer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  const toggleTask = async (task: any) => {
    const isCompleted = task.completedDates?.includes(dateStr);
    
    let newCompletedDates = task.completedDates || [];
    if (isCompleted) {
      newCompletedDates = newCompletedDates.filter((d: string) => d !== dateStr);
      // Untoggling a task resets the congrats shown status so they can trigger it again when re-completed
      const congratsKey = `taskflow_congrats_${dateStr}`;
      localStorage.removeItem(congratsKey);
    } else {
      newCompletedDates = [...newCompletedDates, dateStr];
      sendNotification("Công việc hoàn thành!", `Bạn đã hoàn thành: ${task.name}`);

      // Manual checking completion congrats trigger
      const totalTasksCount = tasks.length;
      const completedCount = tasks.filter(t => t.completedDates?.includes(dateStr)).length;
      if (totalTasksCount > 0 && completedCount + 1 === totalTasksCount) {
        const congratsKey = `taskflow_congrats_${dateStr}`;
        const alreadyShown = localStorage.getItem(congratsKey);
        if (!alreadyShown) {
          setCongratsIndex(Math.floor(Math.random() * CONGRATS_MESSAGES.length));
          setShowCongrats(true);
          localStorage.setItem(congratsKey, "true");
        }
      }
    }

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completedDates: newCompletedDates
      });
      // Pause task timer if it was running and task is completed
      if (!isCompleted && taskTimers[task.id]?.isTimerRunning) {
        const timerData = taskTimers[task.id];
        if (timerData) {
          syncTodayWorkBeforeStateChange();
          const elapsed = Math.floor((Date.now() - timerData.startTimestamp) / 1000);
          const newElapsed = (timerData.elapsedSeconds || 0) + elapsed;
          
          const currentMonthStr = dateStr.substring(0, 7);
          const updatedMonthlyElapsed = { ...(timerData.monthlyElapsed || {}) };
          updatedMonthlyElapsed[currentMonthStr] = (updatedMonthlyElapsed[currentMonthStr] || 0) + elapsed;

          const updated = {
            ...taskTimers,
            [task.id]: {
              ...timerData,
              isTimerRunning: false,
              elapsedSeconds: newElapsed,
              monthlyElapsed: updatedMonthlyElapsed,
              startTimestamp: 0
            }
          };
          setTaskTimers(updated);
          localStorage.setItem(`taskflow_task_timers_${user.uid}`, JSON.stringify(updated));
        }
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const startStopwatch = () => {
    setIsTimerRunning(true);
    setStartTimestamp(Date.now());
    localStorage.setItem("taskflow_timer_running", "true");
    localStorage.setItem("taskflow_timer_start_timestamp", String(Date.now()));
    localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(Date.now()));
  };

  const stopStopwatch = () => {
    if (isTimerRunning && startTimestamp > 0) {
      syncTodayWorkBeforeStateChange();
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const nextTimer = timer + elapsed;

      setTimer(nextTimer);
      setIsTimerRunning(false);
      setStartTimestamp(0);

      localStorage.setItem("taskflow_timer_base_seconds", String(nextTimer));
      localStorage.setItem("taskflow_timer_running", "false");
      localStorage.setItem("taskflow_timer_start_timestamp", "0");
    }
  };

  const resetStopwatch = () => {
    if (isTimerRunning) {
      stopStopwatch();
    }
    setTimer(0);
    localStorage.setItem("taskflow_timer_base_seconds", "0");
  };

  const getTaskTimerDisplay = (task: any) => {
    const timerData = taskTimers[task.id];
    if (!timerData) {
      return {
        elapsed: 0,
        isTimerRunning: false
      };
    }

    if (timerData.isTimerRunning) {
      const elapsed = Math.floor((Date.now() - timerData.startTimestamp) / 1000);
      const totalElapsed = (timerData.elapsedSeconds || 0) + elapsed;
      return {
        elapsed: totalElapsed,
        isTimerRunning: true
      };
    } else {
      return {
        elapsed: timerData.elapsedSeconds || 0,
        isTimerRunning: false
      };
    }
  };

  const toggleTaskTimer = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const taskId = task.id;
    const currentTimerData = taskTimers[taskId];

    const isRunning = currentTimerData?.isTimerRunning || false;
    let updatedTimers = { ...taskTimers };

    if (isRunning) {
      syncTodayWorkBeforeStateChange();
      const elapsed = Math.floor((Date.now() - currentTimerData.startTimestamp) / 1000);
      const newElapsed = (currentTimerData.elapsedSeconds || 0) + elapsed;

      const currentMonthStr = dateStr.substring(0, 7);
      const updatedMonthlyElapsed = { ...(currentTimerData.monthlyElapsed || {}) };
      updatedMonthlyElapsed[currentMonthStr] = (updatedMonthlyElapsed[currentMonthStr] || 0) + elapsed;

      updatedTimers[taskId] = {
        taskId,
        elapsedSeconds: newElapsed,
        monthlyElapsed: updatedMonthlyElapsed,
        isTimerRunning: false,
        startTimestamp: 0
      };
    } else {
      const currentElapsed = currentTimerData ? (currentTimerData.elapsedSeconds || 0) : 0;
      const currentMonthly = currentTimerData ? (currentTimerData.monthlyElapsed || {}) : {};

      updatedTimers[taskId] = {
        taskId,
        elapsedSeconds: currentElapsed,
        monthlyElapsed: currentMonthly,
        isTimerRunning: true,
        startTimestamp: Date.now()
      };

      localStorage.setItem(`taskflow_last_tick_time_${user.uid}`, String(Date.now()));

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    setTaskTimers(updatedTimers);
    localStorage.setItem(`taskflow_task_timers_${user.uid}`, JSON.stringify(updatedTimers));
  };

  const pauseAllTimers = React.useCallback(() => {
    const nowMs = Date.now();
    let finalTimer = timer;
    let changed = false;

    if (isTimerRunning && startTimestamp > 0) {
      const elapsed = Math.floor((nowMs - startTimestamp) / 1000);
      finalTimer = timer + elapsed;
      changed = true;

      localStorage.setItem("taskflow_timer_base_seconds", String(finalTimer));
      localStorage.setItem("taskflow_timer_running", "false");
      localStorage.setItem("taskflow_timer_start_timestamp", "0");
    }

    let taskTimersChanged = false;
    const updatedTaskTimers = { ...taskTimers };

    Object.keys(updatedTaskTimers).forEach(taskId => {
      const timerData = updatedTaskTimers[taskId];
      if (timerData && timerData.isTimerRunning) {
        const elapsed = Math.floor((nowMs - timerData.startTimestamp) / 1000);
        const newElapsed = (timerData.elapsedSeconds || 0) + elapsed;
        taskTimersChanged = true;

        const currentMonthStr = dateStr.substring(0, 7);
        const updatedMonthlyElapsed = { ...(timerData.monthlyElapsed || {}) };
        updatedMonthlyElapsed[currentMonthStr] = (updatedMonthlyElapsed[currentMonthStr] || 0) + elapsed;

        updatedTaskTimers[taskId] = {
          ...timerData,
          isTimerRunning: false,
          elapsedSeconds: newElapsed,
          monthlyElapsed: updatedMonthlyElapsed,
          startTimestamp: 0
        };
      }
    });

    // Flush today's work seconds to localStorage
    const running = isTimerRunning || Object.values(taskTimers).some(t => t.isTimerRunning);
    if (running) {
      const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
      const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
      if (lastTickVal > 0) {
        const elapsedSec = Math.floor((nowMs - lastTickVal) / 1000);
        if (elapsedSec > 0) {
          const finalTodayWorkSeconds = todayWorkSeconds + elapsedSec;
          localStorage.setItem(`taskflow_today_work_seconds_${user.uid}_${dateStr}`, String(finalTodayWorkSeconds));
        }
      }
      localStorage.removeItem(`taskflow_last_tick_time_${user.uid}`);
    }

    if (taskTimersChanged) {
      localStorage.setItem(`taskflow_task_timers_${user.uid}`, JSON.stringify(updatedTaskTimers));
    }
  }, [isTimerRunning, startTimestamp, timer, todayWorkSeconds, taskTimers, user.uid, dateStr]);

  useEffect(() => {
    const handleUnload = () => {
      pauseAllTimers();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [pauseAllTimers]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const changeDate = (offset: number) => {
    setSelectedDate(prev => addDays(prev, offset));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 max-w-[1350px] mx-auto items-start">
      {/* Cột trái: Focus Timer (Sticky) */}
      <div className="w-full lg:w-[400px] lg:sticky lg:top-8 space-y-6">
        <div className={cn(
          "p-8 rounded-2xl border transition-all duration-500 relative overflow-hidden flex flex-col items-center shadow-xl",
          isTimerRunning 
            ? "bg-indigo-950/40 border-indigo-500/30 text-white shadow-indigo-600/10" 
            : "bg-[#0B0B0C] border-white/5 text-slate-300 shadow-sm"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10 text-center w-full">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border",
                isTimerRunning ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-white/5 border-white/10 text-slate-500"
              )}>
                BỘ ĐẾM GIỜ
              </span>
            </div>
            
            <h3 
              className="text-6xl font-black tracking-tighter mb-8 font-mono text-white select-none"
            >
              {formatTime(getStopwatchValue())}
            </h3>

            <div className="flex items-center gap-6 justify-center">
              {!isTimerRunning ? (
                <button
                  onClick={startStopwatch}
                  className="w-16 h-16 rounded-full bg-white text-[#0A0A0B] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
                >
                  <Play fill="currentColor" size={24} className="translate-x-0.5" />
                </button>
              ) : (
                <button
                  onClick={stopStopwatch}
                  className="w-16 h-16 rounded-full bg-white text-[#0A0A0B] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl"
                >
                  <Pause fill="currentColor" size={24} />
                </button>
              )}
              <button
                onClick={resetStopwatch}
                className={cn(
                  "p-4 rounded-full transition-all border border-transparent",
                  isTimerRunning ? "text-slate-500" : "text-slate-600 hover:bg-white/5 hover:border-white/5"
                )}
              >
                <RotateCcw size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* HÔM NAY BẠN ĐÃ LÀM (BỘ ĐẾM NGÀY NGAY DƯỚI BỘ ĐẾM GIỜ) */}
        <div className="bg-[#0B0B0C] border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col items-start shadow-xl hover:border-emerald-500/10 transition-colors group/work">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none transition-all duration-700 ease-in-out group-hover/work:bg-emerald-500/10" />
          
          <div className="flex items-center justify-between w-full mb-3 pb-2.5 border-b border-white/5 relative z-10">
            <div className="flex items-center gap-2 select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_1.5s_infinite]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Tổng thời gian hôm nay</span>
            </div>
            <Award size={14} className="text-emerald-400" />
          </div>
          
          <div className="w-full relative z-10 flex flex-col items-start select-none">
            <span className="font-mono text-3xl text-emerald-400 font-extrabold leading-none tracking-tight">
              {formatTime(getTodayWorkValue())}
            </span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1.5 leading-relaxed">
              Tích lũy từ tất cả bộ đếm tập trung & stopwatch hôm nay
            </span>
          </div>
        </div>

        {/* TIẾN ĐỘ HÔM NAY */}
        <div className="bg-[#0B0B0C] border border-white/5 rounded-2xl p-6 shadow-xl hover:border-purple-500/10 transition-colors">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3 text-center">Tiến độ hôm nay</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/5 rounded-full relative">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-purple-600 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(168,85,247,0.6)] relative" 
                  style={{ width: `${progressPct}%` }} 
                >
                  {progressPct > 0 && (
                    <motion.div 
                      className="absolute right-0 top-1/2 translate-x-1/2 z-10 flex items-center justify-center pointer-events-none text-base"
                      style={{ y: "-50%" }}
                      animate={{ 
                        scale: [1, 1.25, 0.95, 1.25, 1],
                        filter: [
                          "drop-shadow(0 0 4px rgba(239,68,68,0.7))",
                          "drop-shadow(0 0 10px rgba(168,85,247,0.9))",
                          "drop-shadow(0 0 4px rgba(239,68,68,0.7))"
                        ]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1,
                        ease: "easeInOut"
                      }}
                    >
                      🔥
                    </motion.div>
                  )}
                </div>
              </div>
              <span className="text-xs font-black text-purple-400">{progressPct}%</span>
            </div>
        </div>

        {/* LỜI KHUYÊN AI (QUOTES) */}
        <div id="ai-quotes-container" className="bg-[#0B0B0C] border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col items-start shadow-xl hover:border-indigo-500/10 transition-colors group/quote">
          {/* Subtle glowing accent background */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none transition-all duration-700 ease-in-out group-hover/quote:bg-indigo-500/10" />
          
          <div className="flex items-center justify-between w-full mb-3 pb-2.5 border-b border-white/5 relative z-10">
            <div className="flex items-center gap-2 select-none">
              <Sparkles size={13} className="text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Lời khuyên AI</span>
            </div>
            <button
              id="btn-shuffle-quote"
              onClick={handleNextQuote}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all duration-200 border border-transparent hover:border-white/5 focus:outline-none"
              title="Đổi lời khuyên"
            >
              <RefreshCw size={13} className="transition-transform duration-500 ease-out active:rotate-180 text-indigo-400/85 hover:text-white" />
            </button>
          </div>
          
          <div className="w-full relative z-10 min-h-[50px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={quoteIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-slate-300 font-sans italic leading-relaxed text-left select-none"
              >
                "{quotes[quoteIndex]?.text}"
              </motion.p>
            </AnimatePresence>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex + '-author'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-2 px-2 py-0.5 rounded bg-indigo-500/5 border border-indigo-500/10 self-end select-none"
              >
                {quotes[quoteIndex]?.author}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Cột phải: Danh sách Checklist */}
      <div className="flex-1 space-y-6 w-full">
        {/* Date Selector Header */}
        <div className="flex items-center justify-between px-2 pt-2 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3 shrink-0">
              CHECKLIST 
              <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20">{tasks.length}</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{DAY_MAP[getDay(selectedDate)]}</span>
          </div>
          
          <div className="h-0.5 flex-1 bg-gradient-to-r from-white/5 to-transparent rounded-full" />
          
          <div className="flex items-center bg-[#0B0B0C] border border-white/5 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg text-slate-500 text-[9px] font-bold uppercase tracking-wider transition-all"
            >
              Hiện tại
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button 
              onClick={() => changeDate(-1)}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-4 flex items-center gap-2">
              <CalendarIcon size={12} className="text-indigo-500" />
              <span className="text-[11px] font-black text-white">{format(selectedDate, 'dd/MM/yyyy')}</span>
            </div>
            <button 
              onClick={() => changeDate(1)}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {tasks.map((task) => {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const isCompleted = task.completedDates?.includes(dateStr);
            const currentDuration = task.isShortTerm && task.shortTermAllocations?.[dateStr]
              ? task.shortTermAllocations[dateStr]
              : task.duration;
            
            // Calculate short-term task statistics
            const totalDuration = task.duration || (task.shortTermAllocations ? Object.values(task.shortTermAllocations).reduce((sum: number, m: any) => sum + (Number(m) || 0), 0) : 0) || 1;
            const currentAllocation = (task.isShortTerm && task.shortTermAllocations?.[dateStr]) || 0;
            const dayPct = Math.round((currentAllocation / totalDuration) * 100);
            
            let completedMins = 0;
            if (task.isShortTerm && task.shortTermAllocations) {
              Object.entries(task.shortTermAllocations).forEach(([dVal, dMins]) => {
                if (task.completedDates?.includes(dVal) && typeof dMins === 'number') {
                  completedMins += dMins;
                }
              });
            }
            const totalCompletedPct = Math.round((completedMins / totalDuration) * 100);
            const showDone = !!viewingDonePct[task.id];
            
            // Calculate short-term countdown and completion status
            const isShortTermExpired = task.isShortTerm && task.shortTermDeadline && (
              new Date(task.shortTermDeadline + 'T' + (task.shortTermDeadlineTime || '23:59') + ':00').getTime() - now.getTime() < 0
            );
            const isShortTermCompleted = task.isShortTerm && totalCompletedPct >= 100;
            const isTaskCrossedOut = (isCompleted && !task.isShortTerm) || (task.isShortTerm && (isShortTermCompleted || isShortTermExpired));
            
             return (
              <motion.div
                layout
                key={task.id}
                id={`task-item-${task.id}`}
                className={cn(
                  "group bg-[#0B0B0C] border-2 p-4 rounded-xl transition-all flex flex-col justify-center relative overflow-hidden cursor-pointer",
                  getTaskTimerDisplay(task).isTimerRunning 
                    ? "border-sky-500/50 bg-sky-950/20 shadow-[0_0_15px_rgba(14,165,233,0.3)] animate-[pulse_1.5s_infinite]" 
                    : "border-white/5 hover:border-indigo-500/40",
                  isTaskCrossedOut && "opacity-60"
                )}
                onClick={() => toggleTask(task)}
              >
                {/* Main Card Content Row */}
                <div className="flex items-center gap-4 w-full">
                  <div className="shrink-0 transition-transform active:scale-90">
                    {isCompleted || isTaskCrossedOut ? (
                      <CheckCircle2 size={24} className={task.isShortTerm ? "text-purple-300" : "text-indigo-400"} />
                    ) : (
                      <Circle size={24} className="text-slate-600 group-hover:text-slate-400" />
                    )}
                  </div>
 
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("font-bold text-sm truncate transition-colors", isTaskCrossedOut ? "text-slate-500 line-through" : "text-white group-hover:text-indigo-400")}>{task.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-medium">
                      {(() => {
                        const { elapsed, isTimerRunning: isTaskTimerRunning } = getTaskTimerDisplay(task);
                        if (elapsed > 0 || isTaskTimerRunning) {
                          return (
                            <span className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] tracking-tight transition-all",
                              isTaskTimerRunning 
                                ? "bg-sky-500/20 border border-sky-400/30 text-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.3)]" 
                                : "bg-white/5 border border-white/5 text-slate-400"
                            )}>
                              <span>⚡</span>
                              <span>{formatTime(elapsed)}</span>
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {task.isShortTerm ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-purple-400 font-extrabold uppercase tracking-widest bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded text-[8px] shadow-[0_0_8px_rgba(168,85,247,0.25)] animate-text-blink-purple select-none animate-[pulse_1.5s_infinite]">
                            ⚡ TIẾN ĐỘ THỰC TẾ: {totalCompletedPct}%
                          </span>
                        </div>
                      ) : task.cycle && Array.isArray(task.cycle) && task.cycle.length > 0 ? (
                        <span className="flex items-center gap-1.5 text-amber-500/70">
                          <RefreshCw size={12} />
                          {task.cycle.length === 7 ? 'Cả tuần' : task.cycle.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  </div>
 
                  <div className="flex items-center gap-4 md:gap-8 shrink-0 text-right">
                    {/* Cột 1: Lịch Air */}
                    <div className="hidden md:flex flex-col items-end gap-0.5 w-[75px] shrink-0 text-right">
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block text-right">Lịch Air</span>
                      <span className="text-xs font-bold text-emerald-500 block text-right">
                        {task.airVideoSchedule ? task.airVideoSchedule.time : "—"}
                      </span>
                    </div>

                    {/* Cột 2: Deadline */}
                    <div className="hidden md:flex flex-col items-end gap-0.5 w-[75px] shrink-0 text-right">
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block text-right">Deadline</span>
                      <span className="text-xs font-bold text-rose-500 block text-right">
                        {task.deadline ? (task.deadlineTime || '09:00') : "—"}
                      </span>
                    </div>

                    {/* Cột 3: Đếm ngược */}
                    <div className="flex flex-col items-end gap-0.5 w-[85px] md:w-[100px] shrink-0 select-none text-right">
                      {(() => {
                        if (!task.isShortTerm && task.deadlineTime) {
                          const [hours, minutes] = task.deadlineTime.split(':').map(Number);
                          const deadlineDate = new Date(selectedDate);
                          deadlineDate.setHours(hours, minutes, 0, 0);
                          
                          const diffMs = deadlineDate.getTime() - now.getTime();
                          const isOver = diffMs < 0;
                          
                          if (isOver) {
                            return (
                              <>
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-none">Đếm ngược</span>
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-wide text-right select-none animate-pulse">
                                  ⚠️ Hết giờ
                                </span>
                              </>
                            );
                          } else {
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                            
                            const hStr = diffHours.toString().padStart(2, '0');
                            const mStr = diffMinutes.toString().padStart(2, '0');
                            const sStr = diffSeconds.toString().padStart(2, '0');
                            
                            const countdownText = diffHours > 0 ? `${hStr}:${mStr}:${sStr}` : `${mStr}:${sStr}`;
                            
                            return (
                              <>
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">Đếm ngược</span>
                                <span className="text-xs font-black text-amber-400 font-mono">
                                  {countdownText}
                                </span>
                              </>
                            );
                          }
                        } else if (task.isShortTerm && task.shortTermDeadline) {
                          const diffMs = new Date(task.shortTermDeadline + 'T' + (task.shortTermDeadlineTime || '23:59') + ':00').getTime() - now.getTime();
                          const isOver = diffMs < 0;
                          if (isOver) {
                            if (totalCompletedPct >= 100) {
                              return (
                                <>
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-none">Đếm ngược</span>
                                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-wide text-right select-none font-sans">
                                    🏆 Xong
                                  </span>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-none">Đếm ngược</span>
                                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wide text-right select-none animate-pulse font-sans">
                                    ⚠️ Trễ
                                  </span>
                                </>
                              );
                            }
                          } else {
                            return (
                              <>
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">Đếm ngược</span>
                                <span className="text-xs font-black text-amber-400 font-mono">
                                  {getDeadlineCountdown(task.shortTermDeadline, task.shortTermDeadlineTime || '23:59', now)}
                                </span>
                              </>
                            );
                          }
                        }
                        
                        return (
                          <>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-none">Đếm ngược</span>
                            <span className="text-xs font-bold text-slate-600 font-mono block text-right">—</span>
                          </>
                        );
                      })()}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTaskCrossedOut) return;
                        toggleTaskTimer(task, e);
                      }}
                      className={cn(
                        "p-2.5 rounded-lg transition-all border shrink-0",
                        isTaskCrossedOut 
                          ? "invisible pointer-events-none"
                          : cn(
                              "opacity-0 group-hover:opacity-100",
                              getTaskTimerDisplay(task).isTimerRunning 
                                ? "bg-sky-500/10 border-sky-500/30 text-sky-400 opacity-100 animate-pulse" 
                                : "bg-white/5 text-white border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/10"
                            )
                      )}
                      disabled={isTaskCrossedOut}
                    >
                      {getTaskTimerDisplay(task).isTimerRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {tasks.length === 0 && (
            <div className="py-24 text-center bg-[#0B0B0C] rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center gap-4">
              <CheckCircle2 size={40} className="text-emerald-500/10" />
              <p className="font-bold uppercase text-[10px] tracking-[0.2em] text-slate-600">Tuyệt vời! Không có việc nào cần làm!</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCongrats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Lighter backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCongrats(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px]"
            />
            
            {/* Beautiful launching Fireworks Canvas overlay */}
            <FireworksCanvas />
            
            {/* Modal box */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 12, stiffness: 220 }}
              className="bg-gradient-to-br from-red-700 to-purple-600 rounded-2xl p-[1.5px] max-w-sm w-full relative z-30 shadow-[0_0_50px_rgba(168,85,247,0.35)]"
            >
              <div className="bg-[#0B0B0C] rounded-[15px] p-8 text-center relative overflow-hidden w-full">
                {/* Decorative glowing background glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col items-center">
                  {/* Sparkly / Trophy Icons */}
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 text-red-500 relative">
                    <Sparkles size={28} className="animate-pulse" />
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                      className="absolute inset-0 border border-dashed border-purple-500/20 rounded-full scale-110"
                    />
                  </div>
                  
                  <h3 className="text-lg font-black text-white tracking-tight leading-snug mb-3">
                    {CONGRATS_MESSAGES[congratsIndex]?.title || "Bạn đã hoàn thành tất cả task hôm nay rồi! 🎉🥳"}
                  </h3>
                  <p className="text-sm font-medium text-indigo-200/70 leading-relaxed mb-8">
                    {CONGRATS_MESSAGES[congratsIndex]?.subtitle || "Bạn nghỉ ngơi được rồi 🍀☕"}
                  </p>
                  
                  <button
                    onClick={() => setShowCongrats(false)}
                    className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 active:scale-98 transition-all duration-200 border border-white/10 uppercase tracking-widest"
                  >
                    Tuyệt vời!
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
