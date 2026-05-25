import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Send, 
  Trash2, 
  Clock, 
  Calendar as CalendarIcon, 
  Repeat, 
  Tv, 
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Copy,
  CheckSquare,
  Square,
  Undo2,
  X,
  RotateCcw,
  Pencil,
  Save,
  Flame
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, orderBy, writeBatch, Timestamp, getDocs, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { format, startOfMonth, addMonths, isSameMonth } from 'date-fns';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const computeShortTermAllocations = (deadlineStr: string, totalMinutes: number) => {
  const allocations: Record<string, number> = {};
  
  if (!deadlineStr || totalMinutes <= 0) return allocations;

  // Today local
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Deadline date
  const deadlineDate = parseLocalDate(deadlineStr);
  deadlineDate.setHours(0, 0, 0, 0);

  // Target end date (deadline minus 1 day)
  const targetEndDate = new Date(deadlineDate.getTime());
  targetEndDate.setDate(targetEndDate.getDate() - 1);

  // Collect days starting from today up to targetEndDate
  const daysList: string[] = [];
  const runner = new Date(today.getTime());

  if (targetEndDate < today) {
    // Fallback: if targetEndDate is in the past, use today as the single working day
    daysList.push(format(today, 'yyyy-MM-dd'));
  } else {
    while (runner <= targetEndDate) {
      daysList.push(format(runner, 'yyyy-MM-dd'));
      runner.setDate(runner.getDate() + 1);
    }
  }

  const N = daysList.length;

  // Requirement: "chia đều THỜI GIAN ƯỚC LƯỢNG HOÀN THÀNH ít nhất 1 tiếng 1 ngày"
  const avg = Math.floor(totalMinutes / N);
  const remainder = totalMinutes % N;

  if (avg >= 60) {
    // If average is at least 60, split evenly
    daysList.forEach((dayStr, idx) => {
      allocations[dayStr] = avg + (idx === 0 ? remainder : 0);
    });
  } else {
    // If average is less than 60, pack into 60-second chunks (at least 1 hour)
    let minutesLeft = totalMinutes;
    daysList.forEach((dayStr) => {
      if (minutesLeft >= 60) {
        allocations[dayStr] = 60;
        minutesLeft -= 60;
      } else if (minutesLeft > 0) {
        allocations[dayStr] = minutesLeft;
        minutesLeft = 0;
      } else {
        allocations[dayStr] = 0;
      }
    });

    // If there is still remainder
    if (minutesLeft > 0) {
      const lastDay = daysList[daysList.length - 1];
      allocations[lastDay] = (allocations[lastDay] || 0) + minutesLeft;
    }
  }

  return allocations;
};

const getFormattedShortTermDeadline = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

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
      return `Trễ ${diffDays} ng ${hStr}:${mStr}:${sStr} 🔥`;
    }
    return `Quá hạn ${hStr}:${mStr}:${sStr} 🔥`;
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

export default function TaskEntryTab({ user }: { user: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [deadlineDays, setDeadlineDays] = useState<string[]>([]);
  const [deadlineTime, setDeadlineTime] = useState('09:00');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [cycleDays, setCycleDays] = useState<string[]>([]);
  const [airDays, setAirDays] = useState<string[]>([]);
  const [airTime, setAirTime] = useState('20:00');

  // Short term task states
  const [isShortTerm, setIsShortTerm] = useState(false);
  const [shortTermDeadline, setShortTermDeadline] = useState('');
  const [shortTermDeadlineTime, setShortTermDeadlineTime] = useState('23:59');

  const [selectedMonth, setSelectedMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); // Current month
  const [addTaskMonth, setAddTaskMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); // Month for adding task
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targetMonth, setTargetMonth] = useState(format(addMonths(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 1), 'yyyy-MM'));
  const [lastDeletedTasks, setLastDeletedTasks] = useState<any[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = React.useRef<any>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000); // update every 1 second for live countdown
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter by month for list view
      const filtered = allTasks.filter((t: any) => {
        const date = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
        return isSameMonth(date, selectedMonth);
      });

      filtered.sort((a: any, b: any) => {
        if (a.deadlineTime && !b.deadlineTime) return -1;
        if (!a.deadlineTime && b.deadlineTime) return 1;
        if (a.deadlineTime && b.deadlineTime) return a.deadlineTime.localeCompare(b.deadlineTime);
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });
      setTasks(filtered);
      setLoading(false);
    });
    return unsubscribe;
  }, [user.uid, selectedMonth]);

  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedTaskIds.length > 0) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map(t => t.id));
    }
  };

  const copyTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    setCopying(true);
    try {
      const batch = writeBatch(db);
      const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
      const [year, month] = targetMonth.split('-').map(Number);
      
      // Create a date in the target month (e.g., 1st of that month)
      const targetDate = new Date(year, month - 1, 1, 12, 0, 0);

      selectedTasks.forEach(task => {
        const newTaskRef = doc(collection(db, 'tasks'));
        const { id, ...taskData } = task;
        batch.set(newTaskRef, {
          ...taskData,
          completedDates: [],
          createdAt: Timestamp.fromDate(targetDate)
        });
      });

      await batch.commit();
      setSelectedTaskIds([]);
    } catch (error) {
      console.error("Error copying tasks:", error);
    } finally {
      setCopying(false);
    }
  };

  const deleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    
    const tasksToDelete = tasks.filter(t => selectedTaskIds.includes(t.id));
    setLastDeletedTasks(tasksToDelete);
    setShowUndo(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 8000);

    setDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedTaskIds.forEach(id => {
        batch.delete(doc(db, 'tasks', id));
      });
      await batch.commit();
      setSelectedTaskIds([]);
    } catch (error) {
      console.error("Error deleting tasks:", error);
    } finally {
      setDeleting(false);
    }
  };

  const deleteSingleTask = async (task: any) => {
    setLastDeletedTasks([task]);
    setShowUndo(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 8000);

    try {
      await deleteDoc(doc(db, 'tasks', task.id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const undoDelete = async () => {
    if (lastDeletedTasks.length === 0) return;
    try {
      const batch = writeBatch(db);
      lastDeletedTasks.forEach(task => {
        const { id, ...data } = task;
        batch.set(doc(db, 'tasks', id), data);
      });
      await batch.commit();
      setLastDeletedTasks([]);
      setShowUndo(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    } catch (error) {
      console.error("Error undoing delete:", error);
    }
  };

  const monthOptions = Array.from({ length: 12 }).map((_, i) => new Date(2026, i, 1));

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

    try {
      const today = new Date();
      let taskCreatedAt;
      if (addTaskMonth.getMonth() === today.getMonth() && addTaskMonth.getFullYear() === today.getFullYear()) {
        taskCreatedAt = serverTimestamp();
      } else {
        const midMonthDate = new Date(addTaskMonth.getFullYear(), addTaskMonth.getMonth(), 15, 12, 0, 0);
        taskCreatedAt = Timestamp.fromDate(midMonthDate);
      }

      const taskData: any = {
        userId: user.uid,
        name,
        duration: totalMinutes,
        completedDates: [],
        createdAt: taskCreatedAt
      };

      if (isShortTerm) {
        taskData.isShortTerm = true;
        taskData.shortTermDeadline = shortTermDeadline;
        taskData.shortTermDeadlineTime = shortTermDeadlineTime || '23:59';
        taskData.shortTermAllocations = computeShortTermAllocations(shortTermDeadline, totalMinutes);
        taskData.cycle = null;
        taskData.airVideoSchedule = null;
        taskData.deadline = null;
        taskData.deadlineTime = null;
      } else {
        taskData.isShortTerm = false;
        taskData.shortTermDeadline = null;
        taskData.shortTermDeadlineTime = null;
        taskData.shortTermAllocations = null;
        taskData.cycle = cycleDays.length > 0 ? cycleDays : null;
        taskData.airVideoSchedule = airDays.length > 0 ? { days: airDays, time: airTime } : null;
        taskData.deadline = deadlineDays.length > 0 ? `${deadlineDays.join(', ')} ${deadlineTime}` : null;
        taskData.deadlineTime = deadlineDays.length > 0 ? deadlineTime : null;
      }

      await addDoc(collection(db, 'tasks'), taskData);
      
      // Auto switch back to target month to see the added task
      setSelectedMonth(new Date(addTaskMonth.getFullYear(), addTaskMonth.getMonth(), 1));

      setName('');
      setDeadlineDays([]);
      setDeadlineTime('09:00');
      setHours('0');
      setMinutes('30');
      setCycleDays([]);
      setAirDays([]);
      setShortTermDeadline('');
      setShortTermDeadlineTime('23:59');
      setIsShortTerm(false);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('30');
  const [editCycleDays, setEditCycleDays] = useState<string[]>([]);
  const [editAirDays, setEditAirDays] = useState<string[]>([]);
  const [editAirTime, setEditAirTime] = useState('20:00');
  const [editDeadlineDays, setEditDeadlineDays] = useState<string[]>([]);
  const [editDeadlineTime, setEditDeadlineTime] = useState('09:00');
  const [editIsShortTerm, setEditIsShortTerm] = useState(false);
  const [editShortTermDeadline, setEditShortTermDeadline] = useState('');
  const [editShortTermDeadlineTime, setEditShortTermDeadlineTime] = useState('23:59');

  const startEditing = (task: any) => {
    setEditingTaskId(task.id);
    setEditName(task.name);
    
    const h = Math.floor((task.duration || 0) / 60).toString();
    const m = ((task.duration || 0) % 60).toString();
    setEditHours(h);
    setEditMinutes(m);
    
    setEditCycleDays(task.cycle || []);
    setEditAirDays(task.airVideoSchedule?.days || []);
    setEditAirTime(task.airVideoSchedule?.time || '20:00');
    setEditIsShortTerm(!!task.isShortTerm);
    setEditShortTermDeadline(task.shortTermDeadline || '');
    setEditShortTermDeadlineTime(task.shortTermDeadlineTime || '23:59');
    
    const daysFound: string[] = [];
    if (task.deadline) {
      DAYS.forEach(d => {
        if (task.deadline.includes(d)) {
          daysFound.push(d);
        }
      });
    }
    setEditDeadlineDays(daysFound);
    setEditDeadlineTime(task.deadlineTime || '09:00');
  };

  const saveTask = async (taskId: string) => {
    if (!editName.trim()) return;
    const totalMinutes = (parseInt(editHours) || 0) * 60 + (parseInt(editMinutes) || 0);

    try {
      const updateData: any = {
        name: editName.trim(),
        duration: totalMinutes,
      };

      if (editIsShortTerm) {
        updateData.isShortTerm = true;
        updateData.shortTermDeadline = editShortTermDeadline;
        updateData.shortTermDeadlineTime = editShortTermDeadlineTime || '23:59';
        updateData.shortTermAllocations = computeShortTermAllocations(editShortTermDeadline, totalMinutes);
        updateData.cycle = null;
        updateData.airVideoSchedule = null;
        updateData.deadline = null;
        updateData.deadlineTime = null;
      } else {
        updateData.isShortTerm = false;
        updateData.shortTermDeadline = null;
        updateData.shortTermDeadlineTime = null;
        updateData.shortTermAllocations = null;
        updateData.cycle = editCycleDays.length > 0 ? editCycleDays : null;
        updateData.airVideoSchedule = editAirDays.length > 0 ? { days: editAirDays, time: editAirTime } : null;
        updateData.deadline = editDeadlineDays.length > 0 ? `${editDeadlineDays.join(', ')} ${editDeadlineTime}` : null;
        updateData.deadlineTime = editDeadlineDays.length > 0 ? editDeadlineTime : null;
      }

      await updateDoc(doc(db, 'tasks', taskId), updateData);
      setEditingTaskId(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const TimePicker = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label?: string }) => {
    const [h, m] = value.split(':');
    
    const adjust = (type: 'h' | 'm', amount: number) => {
      if (type === 'h') {
        let num = (parseInt(h) + amount + 24) % 24;
        onChange(`${num.toString().padStart(2, '0')}:${m}`);
      } else {
        let num = (parseInt(m) + amount + 60) % 60;
        onChange(`${h}:${num.toString().padStart(2, '0')}`);
      }
    };

    return (
      <div className="flex items-center gap-1.5 select-none shrink-0 bg-transparent">
        {/* Hour block */}
        <div className="flex items-center gap-1">
          <div className="w-[4.5rem] flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden h-7 group transition-all focus-within:border-indigo-500/40">
            <button 
              type="button" 
              onClick={() => adjust('h', 1)} 
              className="w-5 h-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors border-r border-white/10 active:scale-95"
              title="Tăng giờ"
            >
              <Plus size={10} />
            </button>
            <input 
              type="text" 
              className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-extrabold text-center text-[11px] pointer-events-none select-none" 
              value={h} 
              readOnly
            />
            <button 
              type="button" 
              onClick={() => adjust('h', -1)} 
              className="w-5 h-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors border-l border-white/10 active:scale-95"
              title="Giảm giờ"
            >
              <Minus size={10} />
            </button>
          </div>
          <span className="text-[8px] font-bold text-slate-500 uppercase select-none shrink-0 font-mono">g</span>
        </div>

        <span className="text-slate-700 font-bold text-xs select-none">:</span>

        {/* Minute block */}
        <div className="flex items-center gap-1">
          <div className="w-[4.5rem] flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden h-7 group transition-all focus-within:border-indigo-500/40">
            <button 
              type="button" 
              onClick={() => adjust('m', 5)} 
              className="w-5 h-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors border-r border-white/10 active:scale-95"
              title="Tăng phút"
            >
              <Plus size={10} />
            </button>
            <input 
              type="text" 
              className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-extrabold text-center text-[11px] pointer-events-none select-none" 
              value={m} 
              readOnly
            />
            <button 
              type="button" 
              onClick={() => adjust('m', -5)} 
              className="w-5 h-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors border-l border-white/10 active:scale-95"
              title="Giảm phút"
            >
              <Minus size={10} />
            </button>
          </div>
          <span className="text-[8px] font-bold text-slate-500 uppercase select-none shrink-0 font-mono">p</span>
        </div>
      </div>
    );
  };

  const toggleDay = (day: string, type: 'cycle' | 'air' | 'deadline') => {
    if (type === 'cycle') setCycleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    else if (type === 'air') setAirDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    else setDeadlineDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const selectAll = (type: 'cycle' | 'air' | 'deadline') => {
    if (type === 'cycle') setCycleDays(cycleDays.length === DAYS.length ? [] : [...DAYS]);
    else if (type === 'air') setAirDays(airDays.length === DAYS.length ? [] : [...DAYS]);
    else setDeadlineDays(deadlineDays.length === DAYS.length ? [] : [...DAYS]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1350px] mx-auto items-start">
      {/* Cột trái: Form nhập liệu (Sticky on desktop) */}
      <div className="w-full lg:w-[420px] lg:sticky lg:top-8 bg-[#0B0B0C] border border-white/5 rounded-xl p-5 shadow-xl space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <Plus size={16} className="text-indigo-500" /> THÊM TASK
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAddTaskMonth(new Date())}
                className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-1 rounded border border-indigo-500/20 cursor-pointer transition-all shrink-0 uppercase tracking-tight"
              >
                Hiện tại
              </button>
              <div className="relative shrink-0">
                <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 w-3 h-3" />
                <select 
                  className="bg-black/40 border border-white/10 rounded-lg py-1 pl-7 pr-6 outline-none text-white font-bold appearance-none cursor-pointer text-[9px] min-w-[90px]"
                  value={format(addTaskMonth, 'yyyy-MM')}
                  onChange={e => setAddTaskMonth(new Date(e.target.value))}
                >
                  {monthOptions.map((date, idx) => (
                    <option key={idx} value={format(date, 'yyyy-MM')} className="bg-[#0B0B0C] text-white">
                      T{format(date, 'MM/yyyy')}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronDown size={8} />
                </div>
              </div>
            </div>
          </h2>
        </div>

        <form onSubmit={addTask} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Loại Task</label>
            <div className="relative">
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 outline-none focus:border-indigo-500/40 transition-all font-semibold text-white text-xs appearance-none cursor-pointer"
                value={isShortTerm ? 'short' : 'cycle'}
                onChange={e => setIsShortTerm(e.target.value === 'short')}
              >
                <option value="cycle" className="bg-[#0B0B0C] text-xs text-white">📊 TASK ĐỊNH KỲ</option>
                <option value="short" className="bg-[#0B0B0C] text-xs text-white">🔥 TASK NGẮN HẠN</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={11} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tên task</label>
            <input
              type="text"
              placeholder={isShortTerm ? "Tên task ngắn hạn..." : "Tên công việc..."}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 outline-none focus:border-indigo-500/40 transition-all font-semibold text-white text-xs placeholder:text-slate-700/75"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 font-sans leading-none">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-left block">THỜI GIAN ƯỚC LƯỢNG HOÀN THÀNH</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-[5.2rem] flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden group h-7">
                  <button type="button" onClick={() => setHours(prev => (Math.max(0, parseInt(prev || '0') - 1)).toString())} className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-r border-white/10"><Minus size={10} /></button>
                  <input type="number" className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-bold text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={hours} onChange={e => setHours(e.target.value)} />
                  <button type="button" onClick={() => setHours(prev => (Math.max(0, parseInt(prev || '0') + 1)).toString())} className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-l border-white/10"><Plus size={10} /></button>
                </div>
                <span className="text-[8px] font-bold text-slate-600 uppercase">giờ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[5.2rem] flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden group h-7">
                  <button type="button" onClick={() => setMinutes(prev => (Math.max(0, parseInt(prev || '0') - 5)).toString())} className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-r border-white/10"><Minus size={10} /></button>
                  <input type="number" className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-bold text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={minutes} onChange={e => setMinutes(e.target.value)} />
                  <button type="button" onClick={() => setMinutes(prev => (Math.max(0, parseInt(prev || '0') + 5)).toString())} className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-l border-white/10"><Plus size={10} /></button>
                </div>
                <span className="text-[8px] font-bold text-slate-600 uppercase">phút</span>
              </div>
            </div>
          </div>

          {isShortTerm ? (
            <div className="space-y-1.5 pt-2.5 border-t border-white/5">
              <div className="flex items-center justify-between gap-2 h-6">
                <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest ml-1 shrink-0">Deadline (Ngày & Giờ)</label>
                <TimePicker value={shortTermDeadlineTime} onChange={setShortTermDeadlineTime} />
              </div>
              <input
                type="date"
                required
                className="w-full bg-[#111113] border border-white/10 rounded-lg py-1.5 px-2.5 outline-none focus:border-purple-500/40 transition-all font-semibold text-white text-xs scheme-dark cursor-pointer text-left"
                value={shortTermDeadline}
                onChange={e => setShortTermDeadline(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between h-6">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <Repeat size={12} className="text-amber-500" /> Ngày làm việc
                  </label>
                  <button type="button" onClick={() => selectAll('cycle')} className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase transition-colors">Tất cả</button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(day => (
                    <button 
                      key={day} 
                      type="button" 
                      onClick={() => toggleDay(day, 'cycle')} 
                      className={cn(
                        "h-6.5 rounded-md text-[9px] font-bold transition-all border outline-none",
                        cycleDays.includes(day) 
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]" 
                          : "bg-white/5 border-transparent text-slate-700 hover:border-white/10"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 h-6">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                      <Tv size={11} className="text-emerald-500" /> Lịch đăng bài
                    </label>
                    <TimePicker value={airTime} onChange={setAirTime} />
                  </div>
                  <button type="button" onClick={() => selectAll('air')} className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase transition-colors shrink-0">Tất cả</button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(day => (
                    <button 
                      key={`air-${day}`} 
                      type="button" 
                      onClick={() => toggleDay(day, 'air')}
                      className={cn(
                        "h-6.5 rounded-md text-[9px] font-bold transition-all border outline-none",
                        airDays.includes(day) 
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                          : "bg-white/5 border-transparent text-slate-700 hover:border-white/10"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 h-6">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase tracking-widest shrink-0">
                      <CalendarIcon size={11} /> Deadline
                    </label>
                    <TimePicker value={deadlineTime} onChange={setDeadlineTime} />
                  </div>
                  <button type="button" onClick={() => selectAll('deadline')} className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase transition-colors shrink-0">Tất cả</button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(day => (
                    <button 
                      key={`deadline-${day}`} 
                      type="button" 
                      onClick={() => toggleDay(day, 'deadline')}
                      className={cn(
                        "h-6.5 rounded-md text-[9px] font-bold transition-all border outline-none",
                        deadlineDays.includes(day) 
                          ? "bg-rose-500/10 border-rose-500/40 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.1)]" 
                          : "bg-white/5 border-transparent text-slate-700 hover:border-white/10"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button type="submit" className="w-full bg-[#4f39f6] text-white hover:bg-[#4f39f6]/90 font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg group mt-2">
            <Send size={13} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-white uppercase tracking-widest text-[9px]">THÊM TASK</span>
          </button>
        </form>
      </div>

      {/* Cột phải: Danh sách công việc */}
      <div className="flex-1 space-y-6 w-full">
        <div className="flex items-center justify-between px-2 pt-2 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3 shrink-0">
              TASK CÔNG VIỆC 
              <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20">{tasks.length}</span>
            </h3>
            {tasks.length > 0 && (
              <button 
                onClick={toggleAll}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase underline decoration-indigo-500/30 underline-offset-4 transition-colors"
              >
                {selectedTaskIds.length > 0 ? 'Bỏ tick tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>
          <div className="h-0.5 flex-1 bg-gradient-to-r from-white/5 to-transparent rounded-full" />
          
          {/* Month Selector in the red area */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedMonth(new Date())}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded-xl border border-indigo-500/20 transition-all cursor-pointer shrink-0"
            >
              Hiện tại
            </button>
            <div className="relative group">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 w-3.5 h-3.5" />
              <select 
                className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-8 outline-none text-white font-bold appearance-none cursor-pointer text-[12px] min-w-[120px]"
                value={format(selectedMonth, 'yyyy-MM')}
                onChange={e => setSelectedMonth(new Date(e.target.value))}
              >
                {monthOptions.map(m => (
                  <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')} className="bg-[#111113]">
                    T{format(m, 'MM/yyyy')}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-3.5 h-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedTaskIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-indigo-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Đã chọn {selectedTaskIds.length} task</span>
              </div>
              
              <button 
                onClick={() => setSelectedTaskIds([])}
                title="Bỏ chọn tất cả"
                className="p-1.5 text-[#ff4a4a] hover:text-[#ff6b6b] bg-red-500/10 hover:bg-rose-500/20 border border-red-500/15 hover:border-rose-500/25 rounded-lg transition-all active:scale-95 shadow-[0_0_8px_rgba(239,68,68,0.05)]"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                className="bg-black/60 border border-white/10 rounded-lg py-1.5 px-3 outline-none text-white font-bold text-[10px] cursor-pointer"
                value={targetMonth}
                onChange={e => setTargetMonth(e.target.value)}
              >
                {monthOptions.map(m => (
                  <option key={`target-${format(m, 'yyyy-MM')}`} value={format(m, 'yyyy-MM')} className="bg-[#111113]">
                    Sang T{format(m, 'MM/yyyy')}
                  </option>
                ))}
              </select>
              <button 
                onClick={copyTasks}
                disabled={copying}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Copy size={14} />
                {copying ? 'ĐANG SAO CHÉP...' : 'COPY'}
              </button>

              <div className="w-px h-6 bg-white/10 mx-1" />

              <button 
                onClick={deleteSelectedTasks}
                disabled={deleting}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {deleting ? 'ĐANG XÓA...' : 'XÓA'}
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-1">
              <motion.div 
                layout 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => toggleTaskSelection(task.id)}
                className={cn(
                  "group border p-4 rounded-xl flex items-center gap-4 transition-all relative overflow-hidden cursor-pointer",
                  task.isShortTerm 
                    ? selectedTaskIds.includes(task.id)
                      ? "bg-gradient-to-r from-purple-950/35 via-[#0c0415] to-[#0B0B0C] shadow-[0_0_22px_rgba(168,85,247,0.35)] animate-blink-purple-selected"
                      : "bg-[#0B0B0C] shadow-[0_0_12px_rgba(168,85,247,0.05)] hover:border-purple-500/70 hover:shadow-[0_0_18px_rgba(168,85,247,0.25)] animate-blink-purple"
                    : selectedTaskIds.includes(task.id)
                      ? "border-indigo-500/50 bg-indigo-500/5 hover:border-indigo-500/70"
                      : "bg-[#0B0B0C] border-white/5 hover:border-indigo-500/30"
                )}
              >
                {/* Subtle ambient purple background wave for short-term tasks */}
                {task.isShortTerm && (
                  <div className="absolute right-0 bottom-0 top-0 w-32 bg-gradient-to-l from-purple-500/8 via-transparent to-transparent pointer-events-none rounded-r-xl" />
                )}

                {/* Checkbox */}
                <div className={cn(
                  "transition-colors shrink-0",
                  task.isShortTerm
                    ? selectedTaskIds.includes(task.id) ? "text-purple-400" : "text-purple-500/40 group-hover:text-purple-400"
                    : selectedTaskIds.includes(task.id) ? "text-indigo-500" : "text-slate-600 group-hover:text-indigo-400 animate-none"
                )}>
                  {selectedTaskIds.includes(task.id) ? (
                    <CheckSquare size={20} className={task.isShortTerm ? "text-purple-400" : "text-indigo-500"} />
                  ) : (
                    <Square size={20} />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className={cn(
                    "font-bold text-sm truncate transition-colors",
                    task.isShortTerm 
                      ? "text-purple-100 group-hover:text-purple-300" 
                      : "text-white group-hover:text-indigo-300"
                  )}>
                    {task.name}
                    {task.isShortTerm && (
                      <span className="ml-2 inline-flex items-center text-[8px] bg-purple-500/20 text-purple-300 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-purple-500/35 gap-0.5 shadow-[0_0_8px_rgba(168,85,247,0.3)] animate-text-blink-purple">
                        <Flame size={8} className="text-purple-300 animate-bounce" /> Ngắn hạn
                      </span>
                    )}
                  </h4>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium select-none">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className={task.isShortTerm ? "text-purple-400 animate-pulse" : "text-indigo-500"} /> 
                        <span>{Math.floor(task.duration / 60)}h {task.duration % 60}p</span>
                      </div>
                      {task.cycle && (
                        <div className="flex items-center gap-1.5">
                          <Repeat size={12} className="text-amber-500" /> 
                          <span>{task.cycle.length === 7 ? 'hàng ngày' : task.cycle.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    {task.createdAt && (
                      <div className="text-[9px] text-slate-500/50 font-semibold select-none mt-0.5">
                        Tạo ngày: {format(task.createdAt.toDate ? task.createdAt.toDate() : new Date(), 'dd/MM/yyyy')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 z-10">
                  {task.isShortTerm ? (
                    <>
                      {/* Bộ đếm ngược */}
                      <div className="hidden md:flex flex-col items-end gap-0.5">
                        <span className="text-[9px] font-bold text-purple-400/90 uppercase tracking-widest flex items-center gap-1">
                          <Flame size={10} className="text-purple-400 animate-bounce" /> Đếm ngược
                        </span>
                        <span className={cn(
                          "text-xs font-black font-mono text-amber-400",
                          task.shortTermDeadline && new Date(task.shortTermDeadline + "T" + (task.shortTermDeadlineTime || "23:59") + ":00").getTime() - now.getTime() < 0 && "text-purple-500 animate-pulse font-black"
                        )}>
                          {getDeadlineCountdown(task.shortTermDeadline, task.shortTermDeadlineTime || '23:59', now)}
                        </span>
                      </div>

                      {/* Dòng Deadline ngày tháng năm */}
                      {task.shortTermDeadline && (
                        <div className="hidden md:flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold text-purple-500/60 uppercase tracking-widest">Deadline</span>
                          <span className="text-xs font-black text-purple-400 flex items-center gap-1 border border-purple-500/25 bg-purple-500/5 px-2 py-0.5 rounded-lg shadow-[0_0_8px_rgba(168,85,247,0.15)] animate-text-blink-purple">
                            <CalendarIcon size={12} className="text-purple-400" />
                            {getFormattedShortTermDeadline(task.shortTermDeadline)} {task.shortTermDeadlineTime || '23:59'}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {task.airVideoSchedule && (
                        <div className="hidden md:flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Lịch Air</span>
                          <span className="text-xs font-bold text-emerald-500">
                            {task.airVideoSchedule.time} giờ {Array.isArray(task.airVideoSchedule.days) ? (task.airVideoSchedule.days.length === 7 ? 'hàng ngày' : task.airVideoSchedule.days.join(', ')) : ''}
                          </span>
                        </div>
                      )}
                      {task.deadline && (
                        <div className="hidden md:flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Deadline</span>
                          <span className="text-xs font-bold text-rose-500">
                            {task.deadlineTime} giờ {(() => {
                              const daysPart = task.deadline.replace(/\s\d{2}:\d{2}$/, '').trim();
                              const days = daysPart.split(',').map((d: string) => d.trim()).filter(Boolean);
                              return days.length === 7 ? 'hàng ngày' : days.join(', ');
                            })()}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Edit and Delete button column */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingTaskId === task.id) {
                          setEditingTaskId(null);
                        } else {
                          startEditing(task);
                        }
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-all border border-transparent",
                        task.isShortTerm
                          ? editingTaskId === task.id
                            ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                            : "text-slate-700 hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/20"
                          : editingTaskId === task.id
                            ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                            : "text-slate-700 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/20"
                      )}
                      title="Sửa công việc"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        deleteSingleTask(task);
                      }}
                      className={cn(
                        "p-2 text-slate-700 rounded-lg transition-all border border-transparent",
                        task.isShortTerm
                          ? "hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
                          : "hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
                      )}
                      title="Xóa công việc"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Collapsible Edit form */}
              {editingTaskId === task.id && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-[#121214] border border-indigo-500/20 rounded-xl p-5 mt-1 space-y-4 shadow-inner"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left">Tên task</label>
                      <input 
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 outline-none text-white text-xs font-semibold focus:border-indigo-500/40"
                        placeholder="Nhập tên..."
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left">Thời gian làm</label>
                      <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-28 flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden h-9 shrink-0">
                            <button type="button" onClick={() => setEditHours(h => Math.max(0, parseInt(h || '0') - 1).toString())} className="w-9 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-r border-white/10"><Minus size={14} /></button>
                            <input type="number" className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-bold text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={editHours} onChange={e => setEditHours(e.target.value)} />
                            <button type="button" onClick={() => setEditHours(h => Math.max(0, parseInt(h || '0') + 1).toString())} className="w-9 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-l border-white/10"><Plus size={14} /></button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Giờ</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="w-28 flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden h-9 shrink-0">
                            <button type="button" onClick={() => setEditMinutes(m => Math.max(0, parseInt(m || '0') - 5).toString())} className="w-9 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-r border-white/10"><Minus size={14} /></button>
                            <input type="number" className="w-0 min-w-0 flex-1 bg-transparent text-white outline-none font-bold text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} />
                            <button type="button" onClick={() => setEditMinutes(m => Math.max(0, parseInt(m || '0') + 5).toString())} className="w-9 h-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-l border-white/10"><Plus size={14} /></button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Phút</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Loại Task & Short term Deadline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left font-black">Loại Task</label>
                      <select 
                        value={editIsShortTerm ? 'short' : 'cycle'}
                        onChange={e => setEditIsShortTerm(e.target.value === 'short')}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 outline-none text-white text-xs font-semibold focus:border-indigo-500/40 appearance-none cursor-pointer"
                      >
                        <option value="cycle">📊 Task định kỳ</option>
                        <option value="short">🔥 Task ngắn hạn</option>
                      </select>
                    </div>
                    {editIsShortTerm && (
                      <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <div className="flex items-center justify-between gap-2 h-7">
                          <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block text-left font-black shrink-0">Deadline (Ngày & Giờ)</label>
                          <TimePicker value={editShortTermDeadlineTime} onChange={setEditShortTermDeadlineTime} />
                        </div>
                        <input 
                          type="date"
                          value={editShortTermDeadline}
                          onChange={e => setEditShortTermDeadline(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 px-2.5 outline-none text-white text-xs font-semibold focus:border-purple-500/40 scheme-dark cursor-pointer text-left"
                        />
                      </div>
                    )}
                  </div>

                  {!editIsShortTerm && (
                    <>
                      {/* Hàng 1: Lịch đăng & Deadline */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
                        {/* Lịch đăng bài */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1 h-7">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                <Tv size={11} /> Lịch đăng
                              </label>
                              <button 
                                type="button" 
                                onClick={() => setEditAirDays(editAirDays.length === DAYS.length ? [] : [...DAYS])}
                                className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase shrink-0"
                              >
                                Tất cả
                              </button>
                            </div>
                            <TimePicker value={editAirTime} onChange={setEditAirTime} />
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {DAYS.map(day => (
                              <button
                                key={`edit-air-${day}`}
                                type="button"
                                onClick={() => setEditAirDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                className={cn(
                                  "h-7 rounded-md text-[8px] font-bold transition-all border outline-none",
                                  editAirDays.includes(day)
                                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                                    : "bg-white/5 border-transparent text-slate-600 hover:border-white/10"
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Deadline */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1 h-7">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                <CalendarIcon size={11} /> Deadline
                              </label>
                              <button 
                                type="button" 
                                onClick={() => setEditDeadlineDays(editDeadlineDays.length === DAYS.length ? [] : [...DAYS])}
                                className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase shrink-0"
                              >
                                Tất cả
                              </button>
                            </div>
                            <TimePicker value={editDeadlineTime} onChange={setEditDeadlineTime} />
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {DAYS.map(day => (
                              <button
                                key={`edit-deadline-${day}`}
                                type="button"
                                onClick={() => setEditDeadlineDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                className={cn(
                                  "h-7 rounded-md text-[8px] font-bold transition-all border outline-none",
                                  editDeadlineDays.includes(day)
                                    ? "bg-rose-500/10 border-rose-500/40 text-rose-500"
                                    : "bg-white/5 border-transparent text-slate-600 hover:border-white/10"
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Hàng 2: Ngày làm việc */}
                      <div className="border-t border-white/5 pt-4 space-y-2">
                        <div className="flex items-center gap-3 h-6">
                           <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                            <Repeat size={10} /> Ngày làm việc
                          </label>
                          <button 
                            type="button" 
                            onClick={() => setEditCycleDays(editCycleDays.length === DAYS.length ? [] : [...DAYS])}
                            className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 uppercase shrink-0"
                          >
                            Tất cả
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 max-w-sm">
                          {DAYS.map(day => (
                            <button
                              key={`edit-cycle-${day}`}
                              type="button"
                              onClick={() => setEditCycleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                              className={cn(
                                "h-7 rounded-md text-[8px] font-bold transition-all border outline-none",
                                editCycleDays.includes(day)
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                                  : "bg-white/5 border-transparent text-slate-600 hover:border-white/10"
                              )}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setEditingTaskId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 text-[10px] font-bold uppercase transition-all"
                    >
                      Hủy
                    </button>
                    <button 
                      type="button"
                      onClick={() => saveTask(task.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                    >
                      <Save size={12} />
                      Lưu thay đổi
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ))}

          {tasks.length === 0 && !loading && (
            <div className="py-20 text-center bg-[#0B0B0C] rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-700">
                <Plus size={24} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Chưa có dữ liệu công việc</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Undo Toast */}
      {showUndo && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-[#111113] border border-indigo-500/30 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[320px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Trash2 size={16} />
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-tight">
              Đã xóa {lastDeletedTasks.length} task
            </span>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
            <button 
              onClick={undoDelete}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              <Undo2 size={14} />
              Hoàn tác
            </button>
            <button 
              onClick={() => setShowUndo(false)}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
