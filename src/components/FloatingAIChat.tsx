import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Trash2, Sparkles, CheckCircle, Clock, Minus } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

interface FloatingAIChatProps {
  user: any;
}

export default function FloatingAIChat({ user }: FloatingAIChatProps) {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('taskflow_chat_widget_enabled') === 'true';
  });
  const [isOpen, setIsOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string; timestamp: string }>>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync API Key state
  useEffect(() => {
    setHasApiKey(true);
  }, []);

  // Sync state with storage and handle toggle event
  useEffect(() => {
    const checkEnabled = () => {
      setIsEnabled(localStorage.getItem('taskflow_chat_widget_enabled') === 'true');
    };
    
    window.addEventListener('taskflow-chat-toggle', checkEnabled);
    window.addEventListener('storage', checkEnabled);
    return () => {
      window.removeEventListener('taskflow-chat-toggle', checkEnabled);
      window.removeEventListener('storage', checkEnabled);
    };
  }, []);

  // Load chat history from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`taskflow_ai_chat_history_${user.uid}`);
      if (stored) {
        try {
          setChatHistory(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse chat history:", e);
        }
      } else {
        setChatHistory([
          {
            sender: 'ai',
            text: 'Chào bạn! Tôi là Trợ lý AI của TaskFlow. Tôi có thể can thiệp trực tiếp để hỗ trợ bạn như: tự động tạo task, bấm giờ làm việc, hoặc gạch hoàn thành task rảnh tay. Bạn muốn làm gì?',
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    }
  }, [user]);

  // Save chat history to localStorage
  const saveHistory = (history: any[]) => {
    setChatHistory(history);
    if (user) {
      localStorage.setItem(`taskflow_ai_chat_history_${user.uid}`, JSON.stringify(history));
    }
  };

  // Scroll to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isOpen]);

  // Overrun timer checker - AI asks "Bạn đã xong việc chưa?" when a task duration estimates is surpassed
  useEffect(() => {
    if (!user) return;

    let tasksCache: any[] = [];
    
    // Fetch user tasks to know their estimated duration
    const fetchTasks = async () => {
      try {
        const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        tasksCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      } catch (err) {
        console.error("Error fetching tasks for overrun checker:", err);
      }
    };

    fetchTasks();
    
    // Also listen to task update events to refresh the cache instantly
    const handleUpdate = () => {
      fetchTasks();
    };
    window.addEventListener('local-db-tasks-updated', handleUpdate);

    // Run interval to check active timers
    const interval = setInterval(() => {
      const timersKey = `taskflow_task_timers_${user.uid}`;
      const existingTimersStr = localStorage.getItem(timersKey);
      if (!existingTimersStr) return;

      try {
        const taskTimers = JSON.parse(existingTimersStr);
        Object.keys(taskTimers).forEach(taskId => {
          const timer = taskTimers[taskId];
          if (timer && timer.isTimerRunning && timer.startTimestamp) {
            // Find task in cache
            const t = tasksCache.find(task => task.id === taskId);
            if (t) {
              const estimatedSeconds = (t.duration || 30) * 60;
              const elapsed = (timer.elapsedSeconds || 0) + Math.floor((Date.now() - timer.startTimestamp) / 1000);
              const overrunKey = `taskflow_task_overrun_${taskId}_${timer.startTimestamp}`;

              if (elapsed >= estimatedSeconds && localStorage.getItem(overrunKey) !== 'true') {
                localStorage.setItem(overrunKey, 'true'); // mark as notified

                // Play simple beeps
                try {
                  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                  if (AudioContextClass) {
                    const ctx = new AudioContextClass();
                    [523.25, 597.8, 659.25].forEach((freq, idx) => {
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.type = 'sine';
                      osc.frequency.value = freq;
                      gain.gain.setValueAtTime(0.1, ctx.currentTime);
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.start(ctx.currentTime + idx * 0.15);
                      osc.stop(ctx.currentTime + idx * 0.15 + 0.12);
                    });
                  }
                } catch (e) {
                  console.log(e);
                }

                // Append alert message into chat logs beautifully
                const msgText = `🚨 Bạn ơi! Bạn đang chạy đồng hồ tính giờ cho công việc **"${t.name}"** và đã vượt quá mốc thời gian ước lượng **(${t.duration} phút)**. Bạn đã xong việc chưa?`;
                const storedHistoryStr = localStorage.getItem(`taskflow_ai_chat_history_${user.uid}`);
                let parsedHistory = [];
                if (storedHistoryStr) {
                  try { parsedHistory = JSON.parse(storedHistoryStr); } catch (e) {}
                }
                const updated = [
                  ...parsedHistory,
                  {
                    sender: 'ai' as const,
                    text: msgText,
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  }
                ];
                setChatHistory(updated);
                localStorage.setItem(`taskflow_ai_chat_history_${user.uid}`, JSON.stringify(updated));

                // Open chat widget panel automatically so they can see the prompt!
                setIsOpen(true);

                // Show native window Notification if permitted
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("TaskFlow AI nhắc nhở làm việc", {
                    body: `Công việc "${t.name}" đã hoàn thành cột mốc ${t.duration} phút. Bạn đã xong việc chưa?`,
                  });
                }
              }
            }
          }
        });
      } catch (err) {
        console.error("Overrun checker parsing error:", err);
      }
    }, 2000);

    return () => {
      window.removeEventListener('local-db-tasks-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [user]);

  if (!isEnabled || !user) return null;

  // Clear chat history
  const handleClearHistory = () => {
    const initial = [
      {
        sender: 'ai',
        text: 'Đã tạo phiên hội thoại mới. Tôi có thể giúp gì cho bạn hôm nay?',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ];
    saveHistory(initial);
  };

  // Execute AI action command of interest
  const executeCommand = async (commandStr: string) => {
    try {
      console.log("Executing extracted command:", commandStr);

      // 1. CREATE_TASK command
      if (commandStr.includes('CREATE_TASK')) {
        const nameMatch = commandStr.match(/name="([^"]+)"/);
        const durationMatch = commandStr.match(/duration=(\d+)/);
        const isShortTermMatch = commandStr.match(/isShortTerm=(true|false)/);
        const cycleMatch = commandStr.match(/cycle="([^"]+)"/);
        const shortTermDeadlineMatch = commandStr.match(/shortTermDeadline="([^"]+)"/);
        const shortTermDeadlineTimeMatch = commandStr.match(/shortTermDeadlineTime="([^"]+)"/);
        const airDaysMatch = commandStr.match(/airDays="([^"]+)"/);
        const airTimeMatch = commandStr.match(/airTime="([^"]+)"/);
        const deadlineMatch = commandStr.match(/deadline="([^"]+)"/);
        const deadlineTimeMatch = commandStr.match(/deadlineTime="([^"]+)"/);

        if (nameMatch) {
          const name = nameMatch[1];
          const duration = durationMatch ? parseInt(durationMatch[1]) : 30;
          const isShortTerm = isShortTermMatch ? isShortTermMatch[1] === 'true' : false;
          
          let taskData: any = {
            userId: user.uid,
            name,
            duration,
            completedDates: [],
            createdAt: serverTimestamp()
          };

          const airVideoSchedule = airDaysMatch ? {
            days: airDaysMatch[1].split(',').map(d => d.trim()),
            time: airTimeMatch ? airTimeMatch[1] : '20:00'
          } : null;

          const deadlineVal = deadlineMatch ? deadlineMatch[1] : null;
          const deadlineTimeVal = deadlineTimeMatch ? deadlineTimeMatch[1] : null;

          if (isShortTerm) {
            taskData.isShortTerm = true;
            taskData.shortTermDeadline = shortTermDeadlineMatch ? shortTermDeadlineMatch[1] : new Date().toISOString().substring(0, 10);
            taskData.shortTermDeadlineTime = shortTermDeadlineTimeMatch ? shortTermDeadlineTimeMatch[1] : '23:59';
            taskData.shortTermAllocations = {};
            
            // Build default allocations for today and deadline days list
            const dateStr = new Date().toISOString().substring(0, 10);
            taskData.shortTermAllocations[dateStr] = duration;

            taskData.cycle = null;
            taskData.airVideoSchedule = airVideoSchedule;
            taskData.deadline = deadlineVal;
            taskData.deadlineTime = deadlineTimeVal;
          } else {
            taskData.isShortTerm = false;
            taskData.shortTermDeadline = null;
            taskData.shortTermDeadlineTime = null;
            taskData.shortTermAllocations = null;
            
            const daysString = cycleMatch ? cycleMatch[1] : "T2,T3,T4,T5,T6,T7,CN";
            taskData.cycle = daysString.split(',').map(d => d.trim());
            taskData.airVideoSchedule = airVideoSchedule;
            taskData.deadline = deadlineVal;
            taskData.deadlineTime = deadlineTimeVal;
          }

          await addDoc(collection(db, 'tasks'), taskData);
          window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
          console.log("Task created successfully by AI command:", name);
        }
      }

      // 2. START_TIMER command
      if (commandStr.includes('START_TIMER')) {
        // Bật bộ đếm giờ tổng
        localStorage.setItem('taskflow_timer_running', 'true');
        localStorage.setItem('taskflow_timer_start_timestamp', String(Date.now()));
        window.dispatchEvent(new Event('storage'));

        const nameMatch = commandStr.match(/name="([^"]+)"/);
        if (nameMatch) {
          const targetName = nameMatch[1].toLowerCase();
          
          // Pull existing tasks of user to match (from localStorage)
          const raw = localStorage.getItem('taskflow_local_tasks');
          const userTasks = raw ? JSON.parse(raw) : [];
          
          const matchTask = userTasks.find(t => t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase()));
          
          if (matchTask) {
            const timersKey = `taskflow_task_timers_${user.uid}`;
            const existingTimersStr = localStorage.getItem(timersKey);
            const taskTimers = existingTimersStr ? JSON.parse(existingTimersStr) : {};
            
            // Pause any currently running task timers first to be clean
            Object.keys(taskTimers).forEach(id => {
              if (taskTimers[id]?.isTimerRunning) {
                taskTimers[id].isTimerRunning = false;
                const activeTime = Math.floor((Date.now() - (taskTimers[id].startTimestamp || Date.now())) / 1000);
                taskTimers[id].elapsedSeconds = (taskTimers[id].elapsedSeconds || 0) + activeTime;
                taskTimers[id].startTimestamp = 0;
              }
            });

            const current = taskTimers[matchTask.id] || { elapsedSeconds: 0, monthlyElapsed: {} };
            taskTimers[matchTask.id] = {
              taskId: matchTask.id,
              elapsedSeconds: current.elapsedSeconds || 0,
              monthlyElapsed: current.monthlyElapsed || {},
              isTimerRunning: true,
              startTimestamp: Date.now()
            };

            localStorage.setItem(timersKey, JSON.stringify(taskTimers));
            localStorage.setItem(`taskflow_timer_running`, 'false'); // Pause main countdown to avoid overlap
            localStorage.setItem(`taskflow_timer_active_task`, JSON.stringify(matchTask));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
            console.log("Task timer started by AI command:", matchTask.name);
          }
        }
      }

      // 3. PAUSE_TIMER command — dừng bộ đếm tổng + tất cả task timer đang chạy
      if (commandStr.includes('PAUSE_TIMER')) {
        const timersKey = `taskflow_task_timers_${user.uid}`;
        const existingTimersStr = localStorage.getItem(timersKey);
        const taskTimers = existingTimersStr ? JSON.parse(existingTimersStr) : {};
        const nowMs = Date.now();

        // Dừng bộ đếm tổng (stopwatch chính)
        const isMainRunning = localStorage.getItem('taskflow_timer_running') === 'true';
        if (isMainRunning) {
          const baseSecs = Number(localStorage.getItem('taskflow_timer_base_seconds')) || 0;
          const startTs = Number(localStorage.getItem('taskflow_timer_start_timestamp')) || 0;
          const elapsed = startTs > 0 ? Math.floor((nowMs - startTs) / 1000) : 0;
          localStorage.setItem('taskflow_timer_base_seconds', String(baseSecs + elapsed));
          localStorage.setItem('taskflow_timer_running', 'false');
          localStorage.setItem('taskflow_timer_start_timestamp', '0');
        }

        // Dừng tất cả task timer đang chạy
        let changed = false;
        Object.keys(taskTimers).forEach(taskId => {
          const t = taskTimers[taskId];
          if (t?.isTimerRunning) {
            const elapsed = Math.floor((nowMs - (t.startTimestamp || nowMs)) / 1000);
            taskTimers[taskId] = {
              ...t,
              elapsedSeconds: (t.elapsedSeconds || 0) + elapsed,
              isTimerRunning: false,
              startTimestamp: 0
            };
            changed = true;
          }
        });
        if (changed) localStorage.setItem(timersKey, JSON.stringify(taskTimers));

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
        console.log('PAUSE_TIMER executed by AI');
      }

      // 4. STOP_TIMER command — reset hoàn toàn bộ đếm tổng về 0
      if (commandStr.includes('STOP_TIMER')) {
        const timersKey = `taskflow_task_timers_${user.uid}`;
        const existingTimersStr = localStorage.getItem(timersKey);
        const taskTimers = existingTimersStr ? JSON.parse(existingTimersStr) : {};
        const nowMs = Date.now();

        // Reset bộ đếm tổng
        localStorage.setItem('taskflow_timer_running', 'false');
        localStorage.setItem('taskflow_timer_base_seconds', '0');
        localStorage.setItem('taskflow_timer_start_timestamp', '0');
        localStorage.setItem('taskflow_timer_active_task', '');

        // Dừng & lưu tất cả task timer
        Object.keys(taskTimers).forEach(taskId => {
          const t = taskTimers[taskId];
          if (t?.isTimerRunning) {
            const elapsed = Math.floor((nowMs - (t.startTimestamp || nowMs)) / 1000);
            taskTimers[taskId] = {
              ...t,
              elapsedSeconds: (t.elapsedSeconds || 0) + elapsed,
              isTimerRunning: false,
              startTimestamp: 0
            };
          }
        });
        localStorage.setItem(timersKey, JSON.stringify(taskTimers));

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
        console.log('STOP_TIMER executed by AI');
      }

      // 5. DELETE_TASK command
      if (commandStr.includes('DELETE_TASK')) {
        const nameMatch = commandStr.match(/name="([^"]+)"/);
        if (nameMatch) {
          const targetName = nameMatch[1].toLowerCase();
          const { deleteDoc } = await import('firebase/firestore');

          const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const userTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const matchTask = userTasks.find(t =>
            t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase())
          );

          if (matchTask) {
            await deleteDoc(doc(db, 'tasks', matchTask.id));

            // Xóa timer của task này nếu có
            const timersKey = `taskflow_task_timers_${user.uid}`;
            const existingTimersStr = localStorage.getItem(timersKey);
            if (existingTimersStr) {
              const taskTimers = JSON.parse(existingTimersStr);
              delete taskTimers[matchTask.id];
              localStorage.setItem(timersKey, JSON.stringify(taskTimers));
            }

            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
            console.log('DELETE_TASK executed by AI:', matchTask.name);
          }
        }
      }

      // 6. COMPLETE_TASK command
      if (commandStr.includes('COMPLETE_TASK')) {
        const nameMatch = commandStr.match(/name="([^"]+)"/);
        if (nameMatch) {
          const targetName = nameMatch[1].toLowerCase();
          
          const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const userTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const matchTask = userTasks.find(t => t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase()));
          
          if (matchTask) {
            const dateStr = new Date().toLocaleDateString('sv'); // yyyy-MM-dd
            const currentCompleted = matchTask.completedDates || [];
            if (!currentCompleted.includes(dateStr)) {
              const updatedCompleted = [...currentCompleted, dateStr];
              await updateDoc(doc(db, 'tasks', matchTask.id), {
                completedDates: updatedCompleted
              });
              
              // Also pause its timer if running
              const timersKey = `taskflow_task_timers_${user.uid}`;
              const existingTimersStr = localStorage.getItem(timersKey);
              const taskTimers = existingTimersStr ? JSON.parse(existingTimersStr) : {};
              if (taskTimers[matchTask.id]?.isTimerRunning) {
                taskTimers[matchTask.id].isTimerRunning = false;
                const activeTime = Math.floor((Date.now() - (taskTimers[matchTask.id].startTimestamp || Date.now())) / 1000);
                taskTimers[matchTask.id].elapsedSeconds = (taskTimers[matchTask.id].elapsedSeconds || 0) + activeTime;
                taskTimers[matchTask.id].startTimestamp = 0;
                localStorage.setItem(timersKey, JSON.stringify(taskTimers));
              }

              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
              console.log("Task completed successfully by AI command:", matchTask.name);
            }
          }
        }
      }

    } catch (e) {
      console.error("Failed to execute parsed AI command:", e);
    }
  };

  // Helper to parse double-asterisk tags for bold rendering
  const parseBold = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/);
    if (parts.length === 1) return text;
    return parts.map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="text-white font-[700]">{part}</strong> : part
    ));
  };

  // Run chat message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat) return;

    const userMsgText = chatMessage.trim();
    setChatMessage('');
    
    const userTimestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...chatHistory,
      { sender: 'user' as const, text: userMsgText, timestamp: userTimestamp }
    ];
    saveHistory(updatedHistory);
    setSendingChat(true);

    try {
      // Pull user tasks list to support dynamic task identification
      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const userTasks = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          duration: data.duration,
          completedDates: data.completedDates || []
        };
      });

      // API key
      const apiKeyVal = localStorage.getItem('taskflow_gemini_api_key') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKeyVal) {
        headers['x-gemini-key'] = apiKeyVal;
      }

      // Invoke AI Chat mapping
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMsgText,
          history: updatedHistory.map(h => ({
            role: h.sender === 'user' ? 'user' : 'model',
            text: h.text
          })),
          currentTasks: userTasks
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error || '';
        if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) {
          throw new Error('⚠️ Đã vượt giới hạn Gemini API (rate limit / hết quota). Chờ 1 phút rồi thử lại, hoặc kiểm tra quota tại https://aistudio.google.com');
        }
        throw new Error(errMsg || `Lỗi máy chủ AI (${response.status})`);
      }

      const resData = await response.json();
      let replyText = resData.reply || 'Kết nối gián đoạn.';

      // Extract raw action command block if present before display
      const cmdRegex = /\[CMD:[^\]]+\]/g;
      const commands = replyText.match(cmdRegex) || [];
      
      // Strip CMD chunks to leave only clean, friendly text for UI
      const cleanReplyText = replyText.replace(cmdRegex, '').trim();

      // Instantly apply tasks changes
      for (const cmd of commands) {
        await executeCommand(cmd);
      }

      const aiTimestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      saveHistory([
        ...updatedHistory,
        { sender: 'ai', text: cleanReplyText, timestamp: aiTimestamp }
      ]);

    } catch (err: any) {
      const aiTimestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      saveHistory([
        ...updatedHistory,
        { 
          sender: 'ai', 
          text: err?.message || 'Rất tiếc, tôi đang gặp khó khăn kết nối với máy chủ AI. Xin hãy thử lại sau ít phút.', 
          timestamp: aiTimestamp 
        }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
      {/* Floating Chat Panel Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-[335px] h-[460px] bg-[#111113]/98 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3.5 relative"
            style={{ backdropFilter: 'blur(16px)' }}
          >
            {/* Confirmation Dialog to Disable Widget */}
            {showDeactivateConfirm && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-5 text-center">
                <div className="bg-[#18181b] border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl max-w-[270px]">
                  <h5 className="text-xs font-black text-white">Xác định tắt hỗ trợ?</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Bong bóng AI rảnh tay này sẽ ẩn đi hoàn toàn. Bạn có thể kích hoạt lại bong bóng bất cứ lúc nào trong tab <strong>Trợ lý AI</strong>.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('taskflow_chat_widget_enabled', 'false');
                        window.dispatchEvent(new CustomEvent('taskflow-chat-toggle'));
                        setShowDeactivateConfirm(false);
                        setIsOpen(false);
                        setIsEnabled(false);
                      }}
                      className="flex-grow bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                    >
                      Xác định tắt
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeactivateConfirm(false)}
                      className="flex-grow bg-white/5 hover:bg-white/10 border border-white/5 text-slate-305 font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Panel Header */}
            <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900/40 border-b border-white/5 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6.5 h-6.5 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-400/20">
                  <Bot size={14} className="text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight leading-tight">Chat với AI TaskFlow</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
                    <span className={`text-[9px] font-medium ${hasApiKey ? "text-emerald-400" : "text-slate-500"}`}>
                      {hasApiKey ? "Hỗ trợ tự động" : "Hỗ trợ tự động (Tắt)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearHistory}
                  title="Xóa phiên trò chuyện"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Thu nhỏ"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => setShowDeactivateConfirm(true)}
                  title="Tắt hẳn bong bóng chat"
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 rounded-lg transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Chat list views */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/5 py-4">
              {chatHistory.map((h, i) => (
                <div key={i} className={`flex items-start gap-2.5 ${h.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {h.sender === 'ai' && (
                    <div className="w-6.5 h-6.5 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/15 text-indigo-400 shrink-0 text-[10px] mt-0.5">
                      AI
                    </div>
                  )}

                  <div className={`max-w-[76%] rounded-2xl p-3 text-xs leading-relaxed ${
                    h.sender === 'user' 
                      ? 'bg-indigo-600 border border-indigo-500/25 text-white rounded-tr-none' 
                      : 'bg-[#18181b]/70 border border-white/5 text-slate-300 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{parseBold(h.text)}</p>
                    <span className={`block text-[8px] mt-1.5 leading-none ${
                      h.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-500'
                    }`}>
                      {h.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              
              {sendingChat && (
                <div className="flex items-start gap-2.5">
                  <div className="w-6.5 h-6.5 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/15 text-indigo-400 shrink-0 text-[10px] mt-0.5">
                    AI
                  </div>
                  <div className="bg-[#18181b]/70 border border-white/5 text-slate-300 rounded-2xl rounded-tl-none p-3 text-xs">
                    <div className="flex items-center gap-1 py-1 px-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input fields */}
            <form onSubmit={handleSendChat} className="p-3 bg-[#111113]/98 border-t border-white/5 flex gap-2 items-end">
              <textarea
                placeholder="Chat hoặc ra lệnh (vd: tạo task..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                disabled={sendingChat}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (chatMessage.trim() && !sendingChat) {
                      handleSendChat(e as any);
                    }
                  }
                }}
                className="flex-1 min-h-[44px] max-h-[140px] bg-white/5 border border-white/5 focus:border-indigo-500/30 text-white placeholder-slate-500 px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all disabled:opacity-40 resize-none font-sans leading-relaxed"
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || sendingChat}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/25 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:pointer-events-none mb-1"
              >
                <Send size={13} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circle Floating Button Activator trigger */}
      <motion.button
        layout
        onClick={() => setIsOpen(!isOpen)}
        className="w-13 h-13 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white flex items-center justify-center shadow-2xl relative cursor-pointer outline-none border border-indigo-400/20 active:scale-95 group"
        whileHover={{ scale: 1.05 }}
      >
        <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping opacity-60 pointer-events-none" />
        <Bot size={22} className="relative z-10 text-white" />
        <Sparkles size={11} className="absolute top-2.5 right-2 text-indigo-200 animate-pulse" />
      </motion.button>
    </div>
  );
}
