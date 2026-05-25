import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  CheckCircle2, 
  Calendar as CalendarIcon,
  ChevronDown,
  Trash2,
  Clock,
  Timer,
  RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { cn } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth,
  getDay
} from 'date-fns';

const DAY_MAP: Record<number, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7'
};

const formatDeadlineText = (deadline: string) => {
  if (!deadline) return "";
  const days = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];
  const lower = deadline.toLowerCase();
  const hasAllDays = days.every(d => lower.includes(d));
  
  if (hasAllDays) {
    const timeMatch = deadline.match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9]/);
    const timeStr = timeMatch ? ` lúc ${timeMatch[0]}` : "";
    return `Cả tuần${timeStr}`;
  }
  
  let formatted = deadline;
  formatted = formatted.replace(/\bcn\b/gi, 'CN');
  formatted = formatted.replace(/\bt2\b/gi, 'T2');
  formatted = formatted.replace(/\bt3\b/gi, 'T3');
  formatted = formatted.replace(/\bt4\b/gi, 'T4');
  formatted = formatted.replace(/\bt5\b/gi, 'T5');
  formatted = formatted.replace(/\bt6\b/gi, 'T6');
  formatted = formatted.replace(/\bt7\b/gi, 'T7');
  
  return formatted;
};

const getFormattedShortTermDeadline = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const parseSafeDate = (createdAtField: any): Date => {
  if (!createdAtField) return new Date();
  if (typeof createdAtField.toDate === 'function') {
    return createdAtField.toDate();
  }
  if (createdAtField.seconds && typeof createdAtField.seconds === 'number') {
    return new Date(createdAtField.seconds * 1000);
  }
  const parsed = new Date(createdAtField);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
};

const isTaskActiveOnDate = (task: any, day: Date) => {
  const createdAt = parseSafeDate(task.createdAt);
  const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
  const currentDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return currentDay >= createdDay;
};

export default function AIPlanTab({ user, onJumpToChecklist }: { user: any, onJumpToChecklist: (date: Date) => void }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<'schedule' | 'stats'>('schedule');
  const [taskTimers, setTaskTimers] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`taskflow_task_timers_${user.uid}`);
      if (saved) {
        setTaskTimers(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, [user.uid]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetStats = async () => {
    setIsResetting(true);
    try {
      // 1. Remove all localStorage keys related to work seconds for the current user
      const workPrefix = `taskflow_today_work_seconds_${user.uid}_`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(workPrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Reset active timer metadata and user-specific last tick parameter
      localStorage.removeItem(`taskflow_task_timers_${user.uid}`);
      localStorage.removeItem(`taskflow_last_tick_time_${user.uid}`);
      localStorage.removeItem("taskflow_timer_running");
      localStorage.removeItem("taskflow_timer_start_timestamp");
      setTaskTimers({});

      // Reset water intake statistics to 0 and empty the daily water logs
      localStorage.setItem(`health_${user.uid}_water_intake_count`, '0');
      localStorage.setItem(`health_${user.uid}_show_water_congrats`, 'false');
      localStorage.setItem(`health_${user.uid}_water_logs`, JSON.stringify({}));
      localStorage.setItem(`health_${user.uid}_water_last_date`, new Date().toLocaleDateString('sv'));

      // 2. Clear all task completions in Firestore for current user
      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, { completedDates: [] });
      });
      await batch.commit();

      // 3. Re-fetch clean states
      await fetchData();
      setShowResetConfirm(false);

      // Dispatch storage events to alert other parts of the application to refresh
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('health-sync'));
    } catch (err) {
      console.error("Lỗi khi reset thống kê:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const [stats, setStats] = useState({ 
    expectedSoFar: 0, 
    expectedFullMonth: 0, 
    completed: 0, 
    performancePercent: 0, 
    completionPercent: 0 
  });
  const [dailyStats, setDailyStats] = useState<{ day: number, percent: number, completed: number, expected: number }[]>([]);

  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * 5));
    fetchData();
  }, [user.uid, selectedMonth]);

  const fetchData = async () => {
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Local meta-registry storage configuration to preserve deleted tasks with recorded work time
    let registry: Record<string, any> = {};
    try {
      const savedRegistry = localStorage.getItem(`taskflow_tasks_metadata_registry_${user.uid}`);
      if (savedRegistry) {
        registry = JSON.parse(savedRegistry);
      }
    } catch (_) {}

    const activeTaskIds = new Set(allTasks.map(t => t.id));

    allTasks.forEach((task: any) => {
      registry[task.id] = {
        id: task.id,
        name: task.name,
        duration: task.duration || 60,
        isShortTerm: !!task.isShortTerm,
        cycle: task.cycle || null,
        createdAt: task.createdAt,
        completedDates: task.completedDates || []
      };
    });

    try {
      localStorage.setItem(`taskflow_tasks_metadata_registry_${user.uid}`, JSON.stringify(registry));
    } catch (_) {}

    let localTimers: Record<string, any> = {};
    try {
      const savedTimers = localStorage.getItem(`taskflow_task_timers_${user.uid}`);
      if (savedTimers) {
        localTimers = JSON.parse(savedTimers);
      }
    } catch (_) {}

    const deletedTasksWithTime: any[] = [];
    Object.keys(registry).forEach(taskId => {
      if (!activeTaskIds.has(taskId)) {
        const timerData = localTimers[taskId];
        let hasTime = false;
        if (timerData) {
          if (timerData.elapsedSeconds > 0) hasTime = true;
          if (timerData.monthlyElapsed && Object.values(timerData.monthlyElapsed).some((sec: any) => typeof sec === 'number' && sec > 0)) {
            hasTime = true;
          }
        }
        if (hasTime) {
          const originalTask = registry[taskId];
          deletedTasksWithTime.push({
            ...originalTask,
            name: `${originalTask.name} (Đã xóa)`,
            isDeleted: true
          });
        }
      }
    });

    const mergedAllTasks = [...allTasks, ...deletedTasksWithTime];

    const getSafeDate = (createdAtField: any): Date => {
      if (!createdAtField) return new Date();
      if (typeof createdAtField.toDate === 'function') {
        return createdAtField.toDate();
      }
      if (createdAtField.seconds && typeof createdAtField.seconds === 'number') {
        return new Date(createdAtField.seconds * 1000);
      }
      const parsed = new Date(createdAtField);
      if (!isNaN(parsed.getTime())) return parsed;
      return new Date();
    };

    const today = new Date();
    const monthStart = startOfMonth(selectedMonth);
    const monthEndOfMonth = endOfMonth(selectedMonth);
    
    // Performance limit is today if current month, otherwise end of that month
    const endLimit = isSameMonth(selectedMonth, today) ? today : monthEndOfMonth;

    const daysSoFar = eachDayOfInterval({ start: monthStart, end: endLimit });
    const daysFullMonth = eachDayOfInterval({ start: monthStart, end: monthEndOfMonth });

    let totalExpectedSoFar = 0;
    let totalExpectedFullMonth = 0;
    let totalCompleted = 0;

    // Filter tasks by selectedMonth first
    const filteredTasks = mergedAllTasks.filter((task: any) => {
      const createdAt = getSafeDate(task.createdAt);
      const createdInSelectedMonth = isSameMonth(createdAt, selectedMonth);
      if (createdInSelectedMonth) return true;
      if (task.isShortTerm && task.shortTermAllocations) {
        return Object.keys(task.shortTermAllocations).some(dateStr => {
          const allocDate = new Date(dateStr);
          return isSameMonth(allocDate, selectedMonth);
        });
      }
      return false;
    });

    // Calculate overall stats
    filteredTasks.forEach((task: any) => {
      // 1. Expected So Far (for Performance %)
      if (task.isShortTerm) {
        if (task.shortTermAllocations) {
          daysSoFar.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (isTaskActiveOnDate(task, day) && typeof task.shortTermAllocations[dateStr] === 'number' && task.shortTermAllocations[dateStr] > 0) {
              totalExpectedSoFar++;
            }
          });
        }
      } else if (task.cycle && Array.isArray(task.cycle)) {
        daysSoFar.forEach(day => {
          const dayName = DAY_MAP[getDay(day)];
          if (isTaskActiveOnDate(task, day) && task.cycle.includes(dayName)) {
            totalExpectedSoFar++;
          }
        });
      } else {
        const createdAt = getSafeDate(task.createdAt);
        const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
        daysSoFar.forEach(day => {
          const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          if (dayDate.getTime() === createdDay.getTime()) {
            totalExpectedSoFar++;
          }
        });
      }

      // 2. Expected Full Month (for Completion %)
      if (task.isShortTerm) {
        if (task.shortTermAllocations) {
          daysFullMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (isTaskActiveOnDate(task, day) && typeof task.shortTermAllocations[dateStr] === 'number' && task.shortTermAllocations[dateStr] > 0) {
              totalExpectedFullMonth++;
            }
          });
        }
      } else if (task.cycle && Array.isArray(task.cycle)) {
        daysFullMonth.forEach(day => {
          const dayName = DAY_MAP[getDay(day)];
          if (isTaskActiveOnDate(task, day) && task.cycle.includes(dayName)) {
            totalExpectedFullMonth++;
          }
        });
      } else {
        const createdAt = getSafeDate(task.createdAt);
        const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
        daysFullMonth.forEach(day => {
          const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          if (dayDate.getTime() === createdDay.getTime()) {
            totalExpectedFullMonth++;
          }
        });
      }

      // 3. Completed
      if (task.completedDates && Array.isArray(task.completedDates)) {
        task.completedDates.forEach((dateStr: string) => {
          const compDate = new Date(dateStr);
          if (isSameMonth(compDate, selectedMonth)) {
            totalCompleted++;
          }
        });
      }
    });

    // Calculate daily stats for calendar
    const dailyData = daysFullMonth.map(day => {
      let expectedForDay = 0;
      let completedForDay = 0;
      const dayName = DAY_MAP[getDay(day)];
      const dateStr = format(day, 'yyyy-MM-dd');

      filteredTasks.forEach((task: any) => {
        // Expected
        if (task.isShortTerm) {
          if (isTaskActiveOnDate(task, day) && task.shortTermAllocations && typeof task.shortTermAllocations[dateStr] === 'number' && task.shortTermAllocations[dateStr] > 0) {
            expectedForDay++;
          }
        } else if (task.cycle && Array.isArray(task.cycle)) {
          if (isTaskActiveOnDate(task, day) && task.cycle.includes(dayName)) expectedForDay++;
        } else {
          const createdAt = getSafeDate(task.createdAt);
          const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
          const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          if (dayDate.getTime() === createdDay.getTime()) expectedForDay++;
        }

        // Completed
        if (task.completedDates && Array.isArray(task.completedDates)) {
          if (task.completedDates.some(dStr => dStr === dateStr)) {
            completedForDay++;
          }
        }
      });

      return {
        day: day.getDate(),
        completed: completedForDay,
        expected: expectedForDay,
        percent: expectedForDay > 0 ? Math.round((completedForDay / expectedForDay) * 100) : 0
      };
    });

    const performancePercent = totalExpectedSoFar > 0 ? Math.round((totalCompleted / totalExpectedSoFar) * 100) : 0;
    const completionPercent = totalExpectedFullMonth > 0 ? Math.round((totalCompleted / totalExpectedFullMonth) * 100) : 0;

    setStats({ 
      expectedSoFar: totalExpectedSoFar, 
      expectedFullMonth: totalExpectedFullMonth, 
      completed: totalCompleted, 
      performancePercent, 
      completionPercent 
    });
    setDailyStats(dailyData);
    setTasks(filteredTasks);
  };

  const getRating = (percent: number) => {
    if (percent >= 90) return { grade: 'S+', icon: '🏆', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
    if (percent >= 80) return { grade: 'S', icon: '🥇', color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10' };
    if (percent >= 70) return { grade: 'A', icon: '🔥', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' };
    if (percent >= 50) return { grade: 'B', icon: '⚡', color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' };
    if (percent >= 30) return { grade: 'C', icon: '⚠️', color: 'text-rose-300', border: 'border-rose-400/30', bg: 'bg-rose-400/10' };
    if (percent >= 15) return { grade: 'D', icon: '🔻', color: 'text-rose-500', border: 'border-rose-500/30', bg: 'bg-rose-500/10' };
    return { grade: 'F', icon: '💀', color: 'text-slate-400', border: 'border-white/5', bg: 'bg-white/5' };
  };

  const rating = getRating(stats.performancePercent);

  const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const getWeekDates = () => {
    const today = new Date();
    let baseDate = today;
    
    if (!isSameMonth(selectedMonth, today)) {
      baseDate = startOfMonth(selectedMonth);
    }
    
    const dayOfWeek = baseDate.getDay(); // 0 is Sunday, 1 is Monday, ...
    // Calculate distance to current week's Monday (which is T2 in Vietnamese, index 1)
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + distanceToMonday);
    
    return Array.from({ length: 7 }).map((_, i) => {
      return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    });
  };

  const weekDates = getWeekDates();

  const getTaskCompletionMinutes = (task: any) => {
    return task.isShortTerm
      ? Number(task.allocatedDurationForDay || task.duration) || 0
      : Number(task.duration) || 0;
  };

  const getAirTimeSortValue = (task: any) => {
    const time = task.airVideoSchedule?.time || '23:59';
    const [hours = 23, minutes = 59] = String(time).split(':').map(Number);
    return (Number.isFinite(hours) ? hours : 23) * 60 + (Number.isFinite(minutes) ? minutes : 59);
  };

  const hasAirScheduleOnDay = (task: any, day: string) => {
    return !!(
      task.airVideoSchedule &&
      Array.isArray(task.airVideoSchedule.days) &&
      task.airVideoSchedule.days.includes(day)
    );
  };

  const shouldRenderMainTaskOnDay = (task: any, day: string) => {
    if (task.isShortTerm) return true;

    const hasCycle = task.cycle && Array.isArray(task.cycle) && task.cycle.length > 0;
    if (hasCycle) return task.cycle.includes(day);

    const deadlineStr = (task.deadline || "").toLowerCase();
    const hasDeadlineDayMatch = deadlineStr.includes(day.toLowerCase());
    if (hasDeadlineDayMatch) return true;

    const hasAnyFocusAssigned = DAYS_OF_WEEK.some(d => deadlineStr.includes(d.toLowerCase()));
    if (hasAnyFocusAssigned) return false;

    const createdAt = parseSafeDate(task.createdAt);
    const dayName = DAY_MAP[getDay(createdAt)];
    return dayName === day;
  };

  // Automatically compute the schedule from tasks
  const getWeeklySchedule = (dates: Date[]) => {
    const weeklyPlan: Record<string, any[]> = {};
    DAYS_OF_WEEK.forEach(day => {
      weeklyPlan[day] = [];
    });

    tasks.forEach(task => {
      if (task.isShortTerm) {
        // Short-term tasks: allocate to specific dates of the week
        DAYS_OF_WEEK.forEach((day, idx) => {
          const dateOfThisDay = dates[idx];
          const dateStr = format(dateOfThisDay, 'yyyy-MM-dd');
          
          const allocationMinutes = task.shortTermAllocations?.[dateStr] || 0;
          const isCompletedOnThisDay = task.completedDates?.includes(dateStr);
          
          if (allocationMinutes > 0 || isCompletedOnThisDay) {
            weeklyPlan[day].push({
              ...task,
              allocatedDurationForDay: allocationMinutes || task.duration || 0
            });
          }
        });
      } else {
        // Regular tasks:
        const activeDays = new Set<string>();
        
        // 1. Cycle days
        if (task.cycle && Array.isArray(task.cycle)) {
          task.cycle.forEach((day: string) => {
            activeDays.add(day);
          });
        }
        
        // 2. Air scheduled days
        if (task.airVideoSchedule && Array.isArray(task.airVideoSchedule.days)) {
          task.airVideoSchedule.days.forEach((day: string) => {
            activeDays.add(day);
          });
        }
        
        // 3. Deadline days match
        const deadlineStr = (task.deadline || "").toLowerCase();
        DAYS_OF_WEEK.forEach(day => {
          if (deadlineStr.includes(day.toLowerCase())) {
            activeDays.add(day);
          }
        });
        
        if (activeDays.size > 0) {
          activeDays.forEach(day => {
            if (weeklyPlan[day]) {
              // Ensure we don't push duplicates
              if (!weeklyPlan[day].some(t => t.id === task.id)) {
                weeklyPlan[day].push(task);
              }
            }
          });
        } else {
          // If not assigned by any schedule, maybe they appear based on created day or just today
          const createdAt = parseSafeDate(task.createdAt);
          const dayName = DAY_MAP[getDay(createdAt)];
          if (weeklyPlan[dayName]) {
            weeklyPlan[dayName].push(task);
          }
        }
      }
    });

    // 3. Sort each day: main tasks by completion time, Air schedules by air time.
    DAYS_OF_WEEK.forEach(day => {
      weeklyPlan[day].sort((a, b) => {
        const aIsAirOnly = hasAirScheduleOnDay(a, day) && !shouldRenderMainTaskOnDay(a, day);
        const bIsAirOnly = hasAirScheduleOnDay(b, day) && !shouldRenderMainTaskOnDay(b, day);

        if (aIsAirOnly && !bIsAirOnly) return 1;
        if (!aIsAirOnly && bIsAirOnly) return -1;

        if (aIsAirOnly && bIsAirOnly) {
          return getAirTimeSortValue(a) - getAirTimeSortValue(b);
        }

        return getTaskCompletionMinutes(a) - getTaskCompletionMinutes(b);
      });
    });

    return weeklyPlan;
  };

  const weeklySchedule = getWeeklySchedule(weekDates);
  const todayDayName = DAY_MAP[getDay(new Date())];

  const getEstimatedDailyMinutes = (task: any) => {
    return Number(task.duration) || 0;
  };

  const getEstimatedMonthlyMinutes = (task: any, monthDate: Date) => {
    if (task.isShortTerm) {
      let monthlyAlloc = 0;
      if (task.shortTermAllocations) {
        Object.entries(task.shortTermAllocations).forEach(([dStr, mVal]) => {
          try {
            const dateObj = new Date(dStr);
            if (isSameMonth(dateObj, monthDate)) {
              monthlyAlloc += (Number(mVal) || 0);
            }
          } catch (_) {}
        });
      }
      return monthlyAlloc > 0 ? monthlyAlloc : (Number(task.duration) || 0);
    } else if (task.cycle && Array.isArray(task.cycle) && task.cycle.length > 0) {
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });
      let activeDaysCount = 0;
      days.forEach(d => {
        const dayName = DAY_MAP[getDay(d)];
        if (task.cycle.includes(dayName)) {
          activeDaysCount++;
        }
      });
      return activeDaysCount * (Number(task.duration) || 0);
    } else {
      const createdAt = parseSafeDate(task.createdAt);
      if (isSameMonth(createdAt, monthDate)) {
        return Number(task.duration) || 0;
      }
      return 0;
    }
  };

  const rankedTasks = tasks.map((task) => {
    const dailyMins = getEstimatedDailyMinutes(task);
    const monthlyMins = getEstimatedMonthlyMinutes(task, selectedMonth);
    const timerData = taskTimers[task.id];
    
    let actualSeconds = 0;
    if (timerData) {
      const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
      let baseSeconds = 0;
      if (timerData.monthlyElapsed && typeof timerData.monthlyElapsed[selectedMonthStr] === 'number') {
        baseSeconds = timerData.monthlyElapsed[selectedMonthStr];
      } else {
        const todayStr = format(new Date(), 'yyyy-MM');
        if (selectedMonthStr === todayStr) {
          baseSeconds = timerData.elapsedSeconds || 0;
        }
      }

      if (timerData.isTimerRunning && timerData.startTimestamp > 0) {
        const liveElapsed = Math.floor((Date.now() - timerData.startTimestamp) / 1000);
        const activeMonthStr = format(new Date(), 'yyyy-MM');
        if (selectedMonthStr === activeMonthStr) {
          actualSeconds = baseSeconds + liveElapsed;
        } else {
          actualSeconds = baseSeconds;
        }
      } else {
        actualSeconds = baseSeconds;
      }
    }

    return {
      ...task,
      dailyMins,
      monthlyMins,
      actualSeconds,
      actualMins: Math.round(actualSeconds / 60)
    };
  }).sort((a, b) => {
    if (b.actualSeconds !== a.actualSeconds) {
      return b.actualSeconds - a.actualSeconds;
    }
    return a.name.localeCompare(b.name);
  });

  const maxMonthlyMins = rankedTasks.length > 0 ? Math.max(...rankedTasks.map(t => t.monthlyMins)) : 1;

  const formatMinsText = (mins: number) => {
    if (mins < 60) return `${mins} phút`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} giờ ${rem} phút` : `${hrs} giờ`;
  };

  const getMonthlyActualSeconds = () => {
    const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
    const prefix = `taskflow_today_work_seconds_${user.uid}_`;
    let totalSeconds = 0;

    // 1. Scan and sum up all matching days
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const datePart = key.slice(prefix.length); // e.g. "2026-05-21"
        if (datePart.startsWith(selectedMonthStr)) {
          const val = Number(localStorage.getItem(key)) || 0;
          totalSeconds += val;
        }
      }
    }

    // 2. Add currently running live seconds if selected month is this month
    const today = new Date();
    if (isSameMonth(selectedMonth, today)) {
      const mainRunning = localStorage.getItem("taskflow_timer_running") === "true";
      const mainStartStr = localStorage.getItem("taskflow_timer_start_timestamp");
      const mainStart = mainStartStr ? Number(mainStartStr) : 0;

      let anyTaskRunning = false;
      let earliestTaskStart = 0;
      Object.values(taskTimers).forEach((t: any) => {
        if (t.isTimerRunning && t.startTimestamp > 0) {
          anyTaskRunning = true;
          if (earliestTaskStart === 0 || t.startTimestamp < earliestTaskStart) {
            earliestTaskStart = t.startTimestamp;
          }
        }
      });

      if (mainRunning || anyTaskRunning) {
        const lastTickStr = localStorage.getItem(`taskflow_last_tick_time_${user.uid}`);
        const lastTickVal = lastTickStr ? Number(lastTickStr) : 0;
        let liveElapsedSec = 0;
        
        if (lastTickVal > 0) {
          liveElapsedSec = Math.floor((Date.now() - lastTickVal) / 1000);
        } else {
          const activeStart = mainRunning && mainStart > 0 ? mainStart : earliestTaskStart;
          if (activeStart > 0) {
            liveElapsedSec = Math.floor((Date.now() - activeStart) / 1000);
          }
        }
        if (liveElapsedSec > 0) {
          totalSeconds += liveElapsedSec;
        }
      }
    }

    return totalSeconds;
  };

  const totalActualSeconds = getMonthlyActualSeconds();
  const totalActualHours = totalActualSeconds / 3600;

  const totalDaysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const averageHoursPerDay = totalActualHours / totalDaysInMonth;

  const formatDisplayHours = (hrs: number) => {
    if (hrs === 0) return "0 giờ";
    const formatted = hrs.toFixed(1).replace(/\.0$/, "").replace('.', ',');
    return `${formatted} giờ`;
  };

  const formatActualTimeText = (seconds: number) => {
    const hrs = seconds / 3600;
    if (hrs < 0.1 && seconds > 0) {
      return "0,1 giờ";
    }
    const formatted = hrs.toFixed(1).replace(/\.0$/, "").replace('.', ',');
    return `${formatted} giờ`;
  };

  const getRankStyles = (idx: number) => {
    switch (idx) {
      case 0: // 1 (Đỏ lấp lánh)
        return {
          cardClass: "animate-sparkle-red border-red-500/50 hover:border-red-500",
          hoverTitle: "group-hover/rank:text-red-400",
          itemNumClass: "bg-red-500/20 border-red-500/30 text-red-300",
          tagClass: "bg-red-500/15 text-red-400 border-red-500/30"
        };
      case 1: // 2 (đỏ thường)
        return {
          cardClass: "bg-red-500/10 border-red-500/20 hover:border-red-500/50 hover:bg-red-500/15",
          hoverTitle: "group-hover/rank:text-red-400",
          itemNumClass: "bg-red-500/10 border-red-500/10 text-red-400",
          tagClass: "bg-red-500/10 text-red-400 border-red-500/20"
        };
      case 2: // 3 (cam)
        return {
          cardClass: "bg-orange-500/10 border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/15",
          hoverTitle: "group-hover/rank:text-orange-400",
          itemNumClass: "bg-orange-500/10 border-orange-500/10 text-orange-400",
          tagClass: "bg-orange-500/10 text-orange-400 border-orange-500/20"
        };
      case 3: // 4 (vàng)
        return {
          cardClass: "bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/50 hover:bg-yellow-500/15",
          hoverTitle: "group-hover/rank:text-yellow-400",
          itemNumClass: "bg-yellow-500/10 border-yellow-500/10 text-yellow-400",
          tagClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
        };
      case 4: // 5 (tím)
        return {
          cardClass: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/15",
          hoverTitle: "group-hover/rank:text-purple-400",
          itemNumClass: "bg-purple-500/10 border-purple-500/10 text-purple-400",
          tagClass: "bg-purple-500/10 text-purple-400 border-purple-500/20"
        };
      case 5: // 6 (xanh lam)
        return {
          cardClass: "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/15",
          hoverTitle: "group-hover/rank:text-blue-400",
          itemNumClass: "bg-blue-500/10 border-blue-500/10 text-blue-400",
          tagClass: "bg-blue-500/10 text-blue-400 border-blue-500/20"
        };
      case 6: // 7 (xanh lục)
        return {
          cardClass: "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/15",
          hoverTitle: "group-hover/rank:text-emerald-400",
          itemNumClass: "bg-emerald-500/10 border-emerald-500/10 text-emerald-400",
          tagClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        };
      default: // 8,9,... (trắng xám)
        return {
          cardClass: "bg-[#18181b]/30 border-white/5 hover:border-white/10 hover:bg-[#202024]/30",
          hoverTitle: "group-hover/rank:text-slate-200",
          itemNumClass: "bg-white/5 border-white/10 text-slate-400",
          tagClass: "bg-white/5 text-slate-400 border-white/10"
        };
    }
  };


  const getTaskStyles = (task: any) => {
    const COLOR_PALETTE = [
      {
        cardClass: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.05)] hover:shadow-[0_0_18px_rgba(99,102,241,0.2)]",
        durColor: "text-indigo-400",
        indicatorClass: "bg-indigo-500",
        hoverTitle: "text-indigo-300"
      },
      {
        cardClass: "bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.05)] hover:shadow-[0_0_18px_rgba(249,115,22,0.2)]",
        durColor: "text-orange-400",
        indicatorClass: "bg-orange-500",
        hoverTitle: "text-orange-300"
      },
      {
        cardClass: "bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.05)] hover:shadow-[0_0_18px_rgba(244,63,94,0.2)]",
        durColor: "text-rose-400",
        indicatorClass: "bg-rose-500",
        hoverTitle: "text-rose-300"
      },
      {
        cardClass: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.05)] hover:shadow-[0_0_18px_rgba(245,158,11,0.2)]",
        durColor: "text-amber-400",
        indicatorClass: "bg-amber-500",
        hoverTitle: "text-amber-300"
      },
      {
        cardClass: "bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.05)] hover:shadow-[0_0_18px_rgba(6,182,212,0.2)]",
        durColor: "text-cyan-400",
        indicatorClass: "bg-cyan-500",
        hoverTitle: "text-cyan-300"
      },
      {
        cardClass: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.05)] hover:shadow-[0_0_18px_rgba(168,85,247,0.2)]",
        durColor: "text-purple-400",
        indicatorClass: "bg-purple-500",
        hoverTitle: "text-purple-300"
      },
      {
        cardClass: "bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40 shadow-[0_0_12px_rgba(236,72,153,0.05)] hover:shadow-[0_0_18px_rgba(236,72,153,0.2)]",
        durColor: "text-pink-400",
        indicatorClass: "bg-pink-500",
        hoverTitle: "text-pink-300"
      },
      {
        cardClass: "bg-sky-500/10 border-sky-500/20 hover:border-sky-500/40 shadow-[0_0_12px_rgba(14,165,233,0.05)] hover:shadow-[0_0_18px_rgba(14,165,233,0.2)]",
        durColor: "text-sky-400",
        indicatorClass: "bg-sky-500",
        hoverTitle: "text-sky-300"
      }
    ];

    // Compute consistent hash key using string representations of ID or name
    const str = task.id || task.name || "";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
  };

  const chartData = [
    { name: 'Hoàn thành', value: stats.completed },
    { name: 'Còn lại', value: Math.max(0, stats.expectedFullMonth - stats.completed) },
  ];

  const COLORS = ['#6366f1', '#1e1b4b'];

  const getAdvice = (percent: number) => {
    // Ensure index is within range [0, 4]
    const idx = Math.min(Math.max(0, quoteIndex), 4);

    if (percent >= 90) {
      const quotes = [
        "Bạn giỏi quá, hãy tiếp tục giữ vững sự nhiệt huyết này nhé! 🔥🚀 Chúc mừng một tháng bùng nổ, hãy tự thưởng cho bản thân một món quà nhỏ!",
        "Tuyệt vời không tưởng! Bạn đang dẫn đầu cuộc đua với chính mình. Cột mốc hoàn hảo này xứng đáng được vinh danh! 🥳🏆",
        "Năng suất vượt bậc! Bạn đang biến những kỳ vọng khó khăn nhất thành hiện thực. Hãy tiếp tục tỏa sáng rực rỡ nhé! ✨🌟",
        "Không thể tin nổi! Bạn đã chạm gần tới mức hoàn hảo tuyệt đối rồi. Sức bền và sự kỷ luật của bạn thật đáng nể phục! 🧠🔥",
        "Siêu sao năng suất là đây! Mỗi bước đi của bạn đều chứng minh năng lực vượt trội. Hãy tự hào về hành trình tuyệt vời này! 👑🛸"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-emerald-500/10 to-transparent",
        borderColor: "border-emerald-500/20",
        tag: "BẬC THẦY HIỆU SUẤT ✨",
        colorClass: "text-emerald-400"
      };
    }
    if (percent >= 80) {
      const quotes = [
        "Xuất sắc! Hiệu suất tuyệt vời, bạn đang làm chủ công việc cực tốt! 💪 Hãy duy trì phong độ đỉnh cao này nhé!",
        "Phong độ cực kỳ ấn tượng! Bạn đang kiểm soát mọi công việc một cách hoàn hảo. Chỉ còn một chút nữa là đạt điểm tối đa rồi! 🎯🔥",
        "Bạn hành động vô cùng quyết liệt và bài bản! Tiếp tục giữ vững tinh thần thép này để chạm mốc Bậc Thầy nhé! 🚀🦁",
        "Nhịp độ làm việc cực kỳ đáng học hỏi! Sự tập trung cao độ đã mang lại quả ngọt xứng đáng cho nỗ lực của bạn. 🌟🔋",
        "Hiệu quả công việc ở mức tuyệt hảo! Không gì có thể làm khó được bạn một khi đã tập trung hết sức mình. Cố lên nhé! 💪✨"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-sky-500/10 to-transparent",
        borderColor: "border-sky-500/20",
        tag: "XUẤT SẮC 🥇",
        colorClass: "text-sky-400"
      };
    }
    if (percent >= 70) {
      const quotes = [
        "Rất tốt! Bạn đang tiến gần tới vạch đích với năng suất đáng gờm. Hãy bứt phá mạnh mẽ hơn nữa vào các ngày tới nhé! 🌟",
        "Hiệu suất vô cùng tích cực! Những nỗ lực liên tục của bạn đang tạo nên kết quả rất rõ rệt. Hãy bứt tốc nào! 🚀⚡",
        "Tiến triển xuất sắc! Bạn đang duy trì một phong độ cực kỳ hứa hẹn. Tiếp tục kiên trì để chinh phục cột mốc cao hơn nhé! 🎯📈",
        "Năng lượng làm việc dồi dào! Bạn đã hoàn thành phần lớn mục tiêu một cách suôn sẻ. Hãy giữ lửa tinh thần này! 💡🔥",
        "Bạn đang đi đúng hướng với tốc độ tuyệt vời! Hãy duy trì thói quen tốt này và tăng tốc về đích rực rỡ nhé! 🏃‍♂️🌟"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-orange-500/10 to-transparent",
        borderColor: "border-orange-500/20",
        tag: "NĂNG ĐỘNG 🔥",
        colorClass: "text-orange-400"
      };
    }
    if (percent >= 50) {
      const quotes = [
        "Phong độ khá ổn định! Bạn đã hoàn thành được một nửa chặng đường. Hãy nỗ lực thêm chút nữa để đạt kết quả xuất sắc! 📈⚡",
        "Hơn một nửa chặng đường đã được chinh phục! Bạn đang làm rất tốt, hãy dốc thêm chút sức để tạo bất ngờ nhé! 🌟💪",
        "Sự kiên trì đang mang lại thành quả! Đừng dừng lại lúc này, mục tiêu lớn đang ở ngay trước mắt bạn rồi kìa! 🎯👟",
        "Từng bước vững chắc! Bạn đã vượt qua cột mốc quan trọng nhất. Hãy giữ vững nhịp độ hiện tại để bứt phá mạnh mẽ! ✨🔋",
        "Kết quả rất khả quan! Hãy tập trung cao độ hơn vào những hạng mục quan trọng tiếp theo để nâng tầm hiệu suất nhé! 🚀🧠"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-yellow-400/10 to-transparent",
        borderColor: "border-yellow-400/20",
        tag: "KIÊN TRÌ ⚡",
        colorClass: "text-yellow-400"
      };
    }
    if (percent >= 30) {
      const quotes = [
        "Cố gắng lên nhé! Vẫn còn khá nhiều mục tiêu cần chinh phục trong tháng này. Hãy tập trung ưu tiên các công việc quan trọng trước! 🎯👣",
        "Trở ngại chỉ là thử thách! Hãy tìm lại nhịp điệu bằng những mục tiêu đơn giản trước tiên để tạo đà quay lại. ⚡💭",
        "Mỗi ngày mới là một cơ hội làm lại tốt hơn! Tập trung giải quyết từng nhiệm vụ một, bạn sẽ bất ngờ với kết quả đấy! 🌱💪",
        "Đừng quá lo lắng về con số! Hãy bắt đầu tích lũy từng chiến thắng nhỏ ngay hôm nay để đảo chiều phong độ nào! 🔋🏃‍♂️",
        "Bầu trời chỉ tối trước khi hừng đông! Hãy lên kế hoạch chi tiết, loại bỏ xao nhãng và bứt phá ngay từ hôm nay nhé! 🦁🌅"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-rose-400/10 to-transparent",
        borderColor: "border-rose-400/20",
        tag: "ÁP LỰC ⚠️",
        colorClass: "text-rose-300"
      };
    }
    if (percent >= 15) {
      const quotes = [
        "Hiệu suất đang có dấu hiệu đi xuống. Đừng nản lòng, hãy chia nhỏ công việc ra và hoàn thành từng phần nhỏ mỗi ngày để lấy lại nhịp độ nhé! 🌱🔋",
        "Hãy dừng lại một chút để tái nạp năng lượng! Lập một danh sách cực kỳ ngắn gọn và bắt đầu từng bước cực nhỏ nhé! ⏳🔌",
        "Mọi hành trình vạn dặm đều bắt đầu từ một bước đi đầu tiên. Hãy chọn việc dễ nhất trong Checklist và xử lý ngay nào! 👣💡",
        "Sự trì hoãn chỉ là tạm thời, năng lực của bạn là mãi mãi! Hãy bật chế độ tập trung 15 phút và hành động ngay nhé! ⏱️🔥",
        "Hiệu suất chưa được như ý cũng không sao, quan trọng là bạn không bỏ cuộc! Hãy khởi động lại nhẹ nhàng hôm nay nào! 🌱🔋"
      ];
      return {
        text: quotes[idx],
        bgColor: "from-rose-500/10 to-transparent",
        borderColor: "border-rose-500/20",
        tag: "CẦN CẢI THIỆN 🔻",
        colorClass: "text-rose-500"
      };
    }
    const quotes = [
      "Hãy bắt đầu ngay hôm nay nào! Chỉ cần mở Checklist và hoàn thành một việc nhỏ nhất để giải tỏa áp lực và lấy lại đà phát triển! 💀🚀",
      "Trang sách mới đang chờ bạn viết nên! Đừng để sự trì hoãn làm lu mờ khả năng thực sự của bạn. Hành động ngay thôi! 📖🔥",
      "Hãy đánh thức chiến binh bên trong bạn! Chỉ cần hoàn thành 1 việc trong checklist hôm nay là bạn đã chiến thắng rồi! ⚔️🔋",
      "Đã đến lúc lấy lại quyền kiểm soát thời gian! Tắt mọi thông báo, chọn 1 nhiệm vụ và tập trung hoàn thành nó nào! 🔇🎯",
      "Bắt đầu sớm luôn tốt hơn là không bao giờ! Hãy gạt đi áp lực, làm nhẹ nhõm tâm trí và bắt tay vào việc thôi nào! 🌱🏃‍♂️"
    ];
    return {
      text: quotes[idx],
      bgColor: "from-slate-500/10 to-transparent",
      borderColor: "border-white/5",
      tag: "BẮT ĐẦU NGAY 🌱",
      colorClass: "text-slate-400"
    };
  };

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    return new Date(2026, i, 1);
  });

  return (
    <div className="space-y-8">
      {/* Month Selection & Stats Grid */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="bg-[#111113] p-4 rounded-2xl border border-white/5 relative group w-full md:max-w-xs shrink-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Chọn tháng</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMonth(new Date())}
                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1"
                >
                  Hiện tại
                </button>
              </div>
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 w-4 h-4" />
              <select 
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none text-white font-bold appearance-none cursor-pointer text-sm"
                value={format(selectedMonth, 'yyyy-MM')}
                onChange={e => setSelectedMonth(new Date(e.target.value))}
              >
                {monthOptions.map(m => (
                  <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')} className="bg-[#111113]">
                    {format(m, 'MM/yyyy')}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          {/* Advice card next to month select */}
          <motion.div 
            key={stats.performancePercent}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex-1 w-full bg-[#111113]/40 border rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden bg-gradient-to-r md:h-[90px]",
              getAdvice(stats.performancePercent).bgColor,
              getAdvice(stats.performancePercent).borderColor
            )}
          >
            <div className="relative z-10 space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-[9px] font-black bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider", getAdvice(stats.performancePercent).colorClass)}>
                  {getAdvice(stats.performancePercent).tag}
                </span>
                <span className="text-[9px] font-bold text-slate-500 tracking-wider">LỜI KHUYÊN HIỆU SUẤT</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                "{getAdvice(stats.performancePercent).text}"
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Rating Card */}
          <div className={cn("p-6 rounded-[2rem] border shadow-lg transition-all duration-500 h-[340px] flex flex-col justify-between", rating.bg, rating.border)}>
             <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-white">Hiệu suất tháng</p>
             <div className="flex flex-col items-center my-auto">
               <h3 className={cn("font-black drop-shadow-sm flex items-center justify-center gap-1.5", rating.color)}>
                 <span className="text-7xl md:text-8xl tracking-tight">{stats.performancePercent}%</span>
                 <span className="text-6xl md:text-7xl font-sans ml-1">{rating.grade}</span>
                 <span className="text-5xl md:text-6xl ml-1">{rating.icon}</span>
               </h3>
             </div>
             <div className="w-full">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-1000")} style={{ width: `${stats.performancePercent}%`, backgroundColor: 'currentColor' }} />
              </div>
              <p className="text-xs text-slate-500 mt-4 font-medium uppercase tracking-wider">{stats.completed} đã xong / {stats.expectedSoFar} dự kiến</p>
             </div>
          </div>

          {/* Pie Chart Card (Same size now) */}
          <div className="bg-[#111113] rounded-[2rem] border border-white/5 p-6 h-[340px] relative overflow-hidden flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hoàn tất của tháng</p>
              <div className="flex-1 relative my-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{stats.completionPercent}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Xong</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-950" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Còn lại</span>
                </div>
              </div>
          </div>

          {/* Monthly Calendar Card (New) */}
          <div className="bg-[#111113] rounded-[2rem] border border-white/5 p-6 h-[340px] flex flex-col">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Hiệu suất mỗi ngày</p>
            <div className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-7 gap-1 content-start overflow-hidden">
                {dailyStats.map((d, i) => (
                  <div 
                    key={i} 
                    onClick={() => onJumpToChecklist(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), d.day))}
                    className={cn(
                      "aspect-square rounded-md flex flex-col items-center justify-center border transition-all relative group/day cursor-pointer hover:scale-105 active:scale-95",
                      d.percent === 100 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                      d.percent > 50 ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" :
                      d.percent > 0 ? "bg-red-500/20 border-red-500/30 text-red-500" :
                      "bg-white/5 border-transparent text-slate-700 hover:bg-white/10"
                    )}
                    title={`Ngày ${d.day}: ${d.percent}%`}
                  >
                    <span className="text-[8px] font-bold opacity-30 absolute top-1 left-1.5 leading-none">{d.day}</span>
                    <div className="flex flex-col items-center justify-center mt-1">
                      <span className={cn(
                        "font-black transition-all leading-none",
                        d.percent > 0 ? "text-[9px]" : "text-[8px] opacity-10"
                      )}>
                        {d.percent}%
                      </span>
                      {d.expected > 0 && (
                        <span className="text-[5px] font-bold opacity-45 mt-0.5 leading-none uppercase">
                          {d.completed}/{d.expected}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tasks Hoàn Thành</p>
              <h3 className="text-3xl font-bold mt-1 text-emerald-400">{stats.completed}</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={24} />
            </div>
          </div>
          
          <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dự Kiến Còn Lại</p>
              <h3 className="text-3xl font-bold mt-1 text-yellow-500">{Math.max(0, stats.expectedFullMonth - stats.completed)}</h3>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center text-yellow-500 shadow-lg shadow-yellow-500/10">
              <BarChart3 size={24} />
            </div>
          </div>

          <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tổng Thời gian</p>
              <h3 className="text-3xl font-bold mt-1 text-purple-400">{formatDisplayHours(totalActualHours)}</h3>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TB Làm Việc 1 Ngày</p>
              <h3 className="text-3xl font-bold mt-1 text-sky-400">{formatDisplayHours(averageHoursPerDay)}</h3>
            </div>
            <div className="w-12 h-12 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Timer size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Schedule Section */}
      <div className="bg-[#111113] rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/5 bg-black/10 flex flex-col sm:flex-row sm:items-center justify-start gap-4">
          <div className="flex bg-[#0e0e11] p-1.5 rounded-2xl border border-white/5 w-fit max-w-full overflow-x-auto scrollbar-none gap-1">
            {/* Tab 1 button */}
            <button 
              onClick={() => setActiveSection('schedule')}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3 rounded-xl transition-all duration-300 cursor-pointer text-xs font-bold uppercase tracking-wider select-none outline-none focus:outline-none shrink-0",
                activeSection === 'schedule' 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/10" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              <CalendarIcon size={15} />
              <span>Task làm việc trong tuần</span>
            </button>

            {/* Tab 2 button */}
            <button 
              onClick={() => setActiveSection('stats')}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3 rounded-xl transition-all duration-300 cursor-pointer text-xs font-bold uppercase tracking-wider select-none outline-none focus:outline-none shrink-0",
                activeSection === 'stats' 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/10" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              <BarChart3 size={15} />
              <span>Thời gian làm việc các task</span>
            </button>
          </div>
        </div>
        
        {activeSection === 'schedule' ? (
          <div className="overflow-x-auto scrollbar-none">
            <div className="min-w-[1000px]">
              {/* Table Header */}
              <div className="grid grid-cols-7 bg-[#0A0A0B] border-b border-white/5 select-none">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const isToday = day === todayDayName;
                  return (
                    <div key={day} className={cn(
                      "p-4 text-center border-r border-[#1e1e24] last:border-r-0 transition-all duration-300 flex flex-col justify-center items-center min-h-[68px]",
                      isToday ? "bg-indigo-600/20 text-white font-black z-10 border-b-2 border-b-indigo-500" : "opacity-40 hover:opacity-100",
                      !isToday && idx === 0 && "bg-blue-600/5 text-blue-400/80",
                      !isToday && idx === 1 && "bg-emerald-600/5 text-emerald-400/80",
                      !isToday && idx === 2 && "bg-purple-600/5 text-purple-400/80",
                      !isToday && idx === 3 && "bg-orange-600/5 text-orange-400/80",
                      !isToday && idx === 4 && "bg-rose-600/5 text-rose-400/80",
                      !isToday && idx === 5 && "bg-cyan-600/5 text-cyan-400/80",
                      !isToday && idx === 6 && "bg-slate-800/5 text-slate-400/80"
                    )}>
                      <span className={cn(
                        "text-xs uppercase tracking-wider block",
                        isToday ? "font-black text-indigo-300" : "font-extrabold"
                      )}>
                        {day}
                      </span>
                      {isToday && (
                        <span className="text-[9px] text-indigo-400 block font-extrabold tracking-tight mt-0.5 animate-pulse">
                          (Hôm nay)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Table Body */}
              <div className="relative min-h-[500px] grid grid-cols-7 divide-x divide-white/5">
                {tasks.length === 0 && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] p-20 text-center space-y-4">
                    <BarChart3 size={64} className="text-slate-800" />
                    <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Chưa có công việc nào để sắp xếp.</p>
                  </div>
                )}
                
                {DAYS_OF_WEEK.map((day) => {
                  const dayTasks = weeklySchedule[day] || [];
                  const isToday = day === todayDayName;
                  const mainTasks = dayTasks
                    .filter((task: any) => shouldRenderMainTaskOnDay(task, day))
                    .sort((a: any, b: any) => getTaskCompletionMinutes(a) - getTaskCompletionMinutes(b));
                  const airTasks = dayTasks
                    .filter((task: any) => hasAirScheduleOnDay(task, day))
                    .sort((a: any, b: any) => getAirTimeSortValue(a) - getAirTimeSortValue(b));
                  const visibleTaskCount = mainTasks.length + airTasks.length;
                  
                  return (
                    <div 
                      key={day} 
                      className={cn(
                        "p-3 space-y-3 min-h-full transition-all duration-300",
                        isToday ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/10" : "bg-[#0e0e10]/20 opacity-30 hover:opacity-95"
                      )}
                    >
                      {mainTasks.map((task: any, idx: number) => {
                        const styles = getTaskStyles(task);
                        const hasLichAirOnDay = false;

                        const isShortTerm = !!task.isShortTerm;
                        let shouldRenderMainCard = false;
                        if (isShortTerm) {
                          shouldRenderMainCard = true;
                        } else {
                          // Regular task focus determination
                          const hasCycle = task.cycle && Array.isArray(task.cycle) && task.cycle.length > 0;
                          if (hasCycle) {
                            shouldRenderMainCard = task.cycle.includes(day);
                          } else {
                            // Check deadline day
                            const deadlineStr = (task.deadline || "").toLowerCase();
                            const hasDeadlineDayMatch = deadlineStr.includes(day.toLowerCase());
                            if (hasDeadlineDayMatch) {
                              shouldRenderMainCard = true;
                            } else {
                              // If they don't have any matching assigned focus schedule (no cycle and no deadline), fall back to created day
                              const hasAnyFocusAssigned = DAYS_OF_WEEK.some(d => deadlineStr.includes(d.toLowerCase()));
                              if (!hasAnyFocusAssigned) {
                                const createdAt = parseSafeDate(task.createdAt);
                                const dayName = DAY_MAP[getDay(createdAt)];
                                shouldRenderMainCard = dayName === day;
                              }
                            }
                          }
                        }

                        if (!shouldRenderMainCard && !hasLichAirOnDay) return null;

                        return (
                          <React.Fragment key={task.id + idx}>
                            {shouldRenderMainCard && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={cn(
                                  "p-4 rounded-2xl border flex flex-col gap-2 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group/item",
                                  styles.cardClass
                                )}
                              >
                                <div className="flex items-center justify-between">
                                   {task.allocatedDurationForDay ? (
                                     <span className={cn("text-[10px] font-extrabold pb-0.5 border-b border-purple-500/20", styles.durColor)}>
                                       {task.allocatedDurationForDay} phút
                                     </span>
                                   ) : task.duration ? (
                                     <span className={cn("text-[9px] font-black", styles.durColor)}>
                                       {task.duration} phút
                                     </span>
                                   ) : (
                                     <div />
                                   )}
                                </div>

                                <p className={cn("text-[11px] font-bold text-white leading-relaxed line-clamp-3 transition-colors", `group-hover/item:${styles.hoverTitle}`)}>
                                  {task.name}
                                </p>

                                {!task.isShortTerm && (task.deadline || task.deadlineTime) && (
                                  <div className="mt-1 pt-2 border-t border-white/5">
                                    <p className="text-[10px] text-red-400 font-normal leading-tight">
                                      deadline lúc {task.deadlineTime || '09:00'}
                                    </p>
                                  </div>
                                )}

                                {task.isShortTerm && task.shortTermDeadline && (
                                  <div className="mt-1 pt-2 border-t border-purple-500/20">
                                    <p className="text-[9px] text-purple-400 font-black leading-tight flex items-center gap-1 animate-text-blink-purple">
                                      <span className="animate-bounce">⚡</span> {getFormattedShortTermDeadline(task.shortTermDeadline)} {task.shortTermDeadlineTime || '23:59'}
                                    </p>
                                  </div>
                                )}
                                
                                <div className={cn("absolute top-0 right-0 w-1 h-full", styles.indicatorClass)} />
                              </motion.div>
                            )}

                            {/* Glowing Green Lịch Air Secondary Card */}
                            {hasLichAirOnDay && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: (idx * 0.05) + 0.02 }}
                                className="p-2.5 rounded-xl border border-emerald-500/40 bg-[#061c12]/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.55)] flex flex-col gap-1 transition-all hover:scale-[1.02] relative overflow-hidden cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-1 animate-pulse">
                                    ● Lịch Air
                                  </span>
                                  <span className="text-[9px] font-black font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    {task.airVideoSchedule.time}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold text-emerald-100/90 leading-snug line-clamp-2">
                                  {task.name}
                                </p>
                              </motion.div>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {airTasks.map((task: any, idx: number) => (
                        <motion.div
                          key={`air-${task.id}-${idx}`}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: ((mainTasks.length + idx) * 0.05) + 0.02 }}
                          className="p-2.5 rounded-xl border border-emerald-500/40 bg-[#061c12]/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.55)] flex flex-col gap-1 transition-all hover:scale-[1.02] relative overflow-hidden cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-1 animate-pulse">
                              ● Lịch Air
                            </span>
                            <span className="text-[9px] font-black font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {task.airVideoSchedule.time}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-emerald-100/90 leading-snug line-clamp-2">
                            {task.name}
                          </p>
                        </motion.div>
                      ))}
                      {visibleTaskCount === 0 && tasks.length > 0 && (
                        <div className="h-full flex items-center justify-center opacity-10">
                           <span className="text-[10px] text-slate-500 font-bold uppercase rotate-90 tracking-widest">Trống</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h4 className="text-xl font-bold text-white tracking-tight">Thời gian làm việc thực tế của các task</h4>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">Sắp xếp các công việc theo tổng thời gian thực tế bạn làm việc trong tháng này.</p>
              </div>
            </div>

            {rankedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <BarChart3 size={64} className="text-slate-800 animate-pulse" />
                <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Chưa có dữ liệu thống kê.</p>
              </div>
            ) : (
              <>
                {/* BIỂU ĐỒ THỐNG KÊ (CỘT & TRÒN) */}
                {(() => {
                  const chartTasks = rankedTasks.filter(t => t.actualSeconds > 0);
                  const totalWorkSeconds = chartTasks.reduce((sum, t) => sum + t.actualSeconds, 0);
                  const chartData = chartTasks.map((t, idx) => {
                    const mins = Math.round(t.actualSeconds / 60);
                    const hours = Number((t.actualSeconds / 3600).toFixed(1));
                    const pct = totalWorkSeconds > 0 ? (t.actualSeconds / totalWorkSeconds) * 100 : 0;
                    return {
                      name: t.name.length > 15 ? t.name.slice(0, 13) + '..' : t.name,
                      fullName: t.name,
                      hours,
                      minutes: mins,
                      percent: Number(pct.toFixed(1)),
                      color: idx === 0 ? '#6366f1' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#ec4899' : idx === 4 ? '#8b5cf6' : '#64748b'
                    };
                  });

                  if (chartTasks.length === 0) return null;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-950/40 p-6 border border-white/5 rounded-[2rem] shadow-xl">
                      {/* Biểu đồ tròn - Tỉ lệ % giờ làm việc */}
                      <div className="bg-[#111113]/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[340px]">
                        <div>
                          <h5 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-1">Tỉ lệ phần trăm giờ làm việc (%)</h5>
                          <p className="text-[10px] text-slate-500">Phân bố năng suất đóng góp của từng công việc con</p>
                        </div>
                        <div className="h-48 relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="percent"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0d0d0e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff', fontSize: '11px' }}
                                formatter={(value: any, name: any, props: any) => [`${value}% (${props.payload.hours}h)`, props.payload.fullName]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Legend row list */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-[10px] text-slate-400">
                          {chartData.slice(0, 5).map((entry, index) => (
                            <span key={index} className="flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              {entry.name}: {entry.percent}%
                            </span>
                          ))}
                          {chartData.length > 5 && (
                            <span className="text-slate-500 font-medium">+{chartData.length - 5} khác</span>
                          )}
                        </div>
                      </div>

                      {/* Biểu đồ cột - Tổng số giờ làm việc thực tế */}
                      <div className="bg-[#111113]/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[340px]">
                        <div>
                          <h5 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-1">Tổng số giờ làm việc thực tế (Giờ)</h5>
                          <p className="text-[10px] text-slate-500">Thống kê tích lũy thời gian của từng công việc</p>
                        </div>
                        <div className="h-48 mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                              <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0d0d0e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff', fontSize: '11px' }}
                                formatter={(value: any, name: any, props: any) => [`${value} giờ (${props.payload.minutes} phút)`, props.payload.fullName]}
                              />
                              <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={`bar-cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-[10.5px] text-slate-500 text-center font-medium">
                          Tổng cộng thời gian tập trung làm việc: <strong className="text-purple-400">{(totalWorkSeconds / 3600).toFixed(1)} giờ</strong> (~{Math.round(totalWorkSeconds / 60)} phút)
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {rankedTasks.map((task, idx) => {
                    const rankStyles = getRankStyles(idx);

                    return (
                      <motion.div
                        key={task.id + '-rank'}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          "p-4 rounded-[1.25rem] border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group/rank min-h-[175px]",
                          rankStyles.cardClass
                        )}
                      >
                        {/* Top Row: Simple Number + Tag */}
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold select-none",
                            rankStyles.itemNumClass
                          )}>
                            {idx + 1}
                          </div>
                          <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border select-none shrink-0",
                              task.isShortTerm 
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse" 
                                : task.cycle 
                                  ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/20" 
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            )}
                          >
                            {task.isShortTerm ? 'N.Hạn' : task.cycle ? 'Định kỳ' : 'Một lần'}
                          </span>
                        </div>

                        {/* Middle: Task Name with nice typography + Estimated Duration */}
                        <div className="my-2.5 flex-grow flex flex-col justify-start min-w-0">
                          <h5 className={cn(
                            "font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug transition-colors uppercase tracking-tight break-words",
                            rankStyles.hoverTitle
                          )}>
                            {task.name}
                          </h5>
                          <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400 font-bold tracking-tight">
                            <span>Ước lượng:</span>
                            <span className="text-slate-300">
                              {task.duration ? formatMinsText(task.duration) : 'Chưa nhập'}
                            </span>
                          </div>
                        </div>

                        {/* Bottom section: Actual time made much larger, pulsing, and purple */}
                        <div className="border-t border-white/5 pt-3 mt-auto flex flex-col gap-1 w-full">
                          <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wider leading-none">Thực tế</span>
                          {task.actualSeconds > 0 ? (
                            <span className="text-lg sm:text-xl font-bold text-purple-400 tracking-tight leading-none mt-1 animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                              {formatActualTimeText(task.actualSeconds)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-600 leading-none mt-1">
                              Chưa ghi nhận
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reset Confirmation Overlay */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-[2rem] p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-rose-500/10 blur-2xl rounded-full" />
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-xl relative z-10">
              ⚠️
            </div>
            <div className="space-y-2 relative z-10">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Xác nhận Reset Thống Kê</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Bạn có chắc chắn muốn reset toàn bộ thông số thống kê, số giờ làm việc, và lịch sử hoàn thành các nhiệm vụ của mình về 0 không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2 relative z-10">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetStats}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Đang reset...
                  </>
                ) : (
                  "Đồng ý reset"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
