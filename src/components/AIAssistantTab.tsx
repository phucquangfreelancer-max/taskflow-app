import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckSquare, 
  BrainCircuit, 
  TrendingUp, 
  Compass, 
  Send, 
  Calendar, 
  ChevronRight, 
  AlertCircle, 
  RefreshCw,
  Plus,
  Bot,
  User,
  Check,
  ListTodo,
  Clock,
  ArrowRightLeft,
  CalendarCheck,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore';

interface AIAssistantTabProps {
  user: any;
}

// Simple Markdown-like formatter for bullet points, bold text, and paragraphs
function FormattedAIResponse({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="space-y-2.5 text-slate-350 text-xs text-left leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        // Header Check (### or ##)
        if (trimmed.startsWith('###')) {
          const header = trimmed.replace(/^###\s*/, '');
          return (
            <h4 key={idx} className="text-sm font-bold text-white mt-4 border-l-2 border-indigo-500 pl-2">
              {parseBold(header)}
            </h4>
          );
        }
        if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
          const header = trimmed.replace(/^#+\s*/, '');
          return (
            <h3 key={idx} className="text-base font-extrabold text-indigo-400 mt-5 mb-2">
              {parseBold(header)}
            </h3>
          );
        }

        // Bullet Point Check
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
          const item = trimmed.replace(/^[-*•]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-4">
              <span className="text-indigo-400 font-bold mt-1 shrink-0">•</span>
              <span className="text-slate-300">{parseBold(item)}</span>
            </div>
          );
        }

        return <p key={idx}>{parseBold(trimmed)}</p>;
      })}
    </div>
  );
}

// Helper to highlight double-asterisk **bold** elements
function parseBold(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    i % 2 === 1 ? <strong key={i} className="text-white font-black">{part}</strong> : part
  ));
}

export default function AIAssistantTab({ user }: AIAssistantTabProps) {
  const [activeSection, setActiveSection] = useState<'analysis' | 'chat'>('analysis');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('taskflow_gemini_api_key') || '');
  const [chatWidgetEnabled, setChatWidgetEnabled] = useState(() => {
    return localStorage.getItem('taskflow_chat_widget_enabled') === 'true';
  });

  const toggleChatWidget = () => {
    const nextVal = !chatWidgetEnabled;
    localStorage.setItem('taskflow_chat_widget_enabled', nextVal ? 'true' : 'false');
    setChatWidgetEnabled(nextVal);
    // Notify floating chat widgets
    window.dispatchEvent(new CustomEvent('taskflow-chat-toggle'));
  };

  // Sync state with storage
  useEffect(() => {
    const syncEnabled = () => {
      setChatWidgetEnabled(localStorage.getItem('taskflow_chat_widget_enabled') === 'true');
    };
    window.addEventListener('taskflow-chat-toggle', syncEnabled);
    window.addEventListener('storage', syncEnabled);
    return () => {
      window.removeEventListener('taskflow-chat-toggle', syncEnabled);
      window.removeEventListener('storage', syncEnabled);
    };
  }, []);

  // Listening to API settings updates
  useEffect(() => {
    const handleApiKeyUpdate = (e: any) => {
      setApiKey(e.detail || '');
    };
    window.addEventListener('taskflow-apikey-updated', handleApiKeyUpdate);
    return () => window.removeEventListener('taskflow-apikey-updated', handleApiKeyUpdate);
  }, []);

  // --- Checklist Auto-Generation States ---
  const [checklistPrompt, setChecklistPrompt] = useState('');
  const [generatingChecklist, setGeneratingChecklist] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<Array<{
    name: string;
    duration: number;
    isShortTerm: boolean;
    shortTermDeadline: string | null;
    shortTermDeadlineTime: string | null;
    cycle: string[] | null;
    airVideoSchedule: { days: string[]; time: string } | null;
    deadline: string | null;
    deadlineTime: string | null;
    selected: boolean;
  }>>([]);
  const [checklistSuccessMessage, setChecklistSuccessMessage] = useState('');

  // --- Productivity Analysis & Schedules States ---
  const [analysisType, setAnalysisType] = useState<'productivity' | 'prioritize' | 'schedule'>('productivity');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisFeedback, setAnalysisFeedback] = useState('');
  const [optimizedDays, setOptimizedDays] = useState<any[]>([]);
  const [optimizedRecs, setOptimizedRecs] = useState('');
  const [prioritizedTasks, setPrioritizedTasks] = useState<any[]>([]);
  const [applyingSchedule, setApplyingSchedule] = useState(false);

  const mapVietnameseDay = (viDay: string): string => {
    const clean = viDay.trim().toLowerCase();
    if (clean.includes('hai') || clean.includes('thứ 2') || clean.includes('thứ hai') || clean === 't2') return 'T2';
    if (clean.includes('ba') || clean.includes('thứ 3') || clean.includes('thứ ba') || clean === 't3') return 'T3';
    if (clean.includes('tư') || clean.includes('thứ 4') || clean.includes('thứ tư') || clean === 't4') return 'T4';
    if (clean.includes('năm') || clean.includes('thứ 5') || clean.includes('thứ năm') || clean === 't5') return 'T5';
    if (clean.includes('sáu') || clean.includes('thứ 6') || clean.includes('thứ sáu') || clean === 't6') return 'T6';
    if (clean.includes('bảy') || clean.includes('thứ 7') || clean.includes('thứ bảy') || clean === 't7') return 'T7';
    if (clean.includes('nhật') || clean.includes('chủ nhật') || clean === 'cn') return 'CN';
    return '';
  };

  const handleConfirmSchedule = async () => {
    setApplyingSchedule(true);
    try {
      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const userTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const taskAllocationMap: Record<string, string[]> = {};
      optimizedDays.forEach((dayObj: any) => {
        const dayCode = mapVietnameseDay(dayObj.day);
        if (!dayCode) return;
        if (dayObj.tasks && Array.isArray(dayObj.tasks)) {
          dayObj.tasks.forEach((t: any) => {
            const taskName = (t.taskName || t.name || '').trim().toLowerCase();
            if (taskName) {
              if (!taskAllocationMap[taskName]) {
                taskAllocationMap[taskName] = [];
              }
              if (!taskAllocationMap[taskName].includes(dayCode)) {
                taskAllocationMap[taskName].push(dayCode);
              }
            }
          });
        }
      });

      let updatedCount = 0;
      for (const t of userTasks) {
        const nameLower = t.name.trim().toLowerCase();
        const days = taskAllocationMap[nameLower];
        if (days && days.length > 0) {
          const docRef = doc(db, 'tasks', t.id);
          await updateDoc(docRef, {
            cycle: days,
            isShortTerm: false
          });
          updatedCount++;
        }
      }

      alert(`Đồng ý & Xác nhận lịch trình thành công! Đã tự động cập nhật phân rã ngày làm việc cho ${updatedCount} công việc.`);
      window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
    } catch (err: any) {
      alert('Gặp sự cố khi lưu sắp xếp công việc: ' + err.message);
    } finally {
      setApplyingSchedule(false);
    }
  };

  // --- Chat Assistant States ---
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string; timestamp: string }>>([
    {
      sender: 'ai',
      text: 'Chào bạn! Tôi là Trợ lý AI của TaskFlow. Tôi có thể giúp bạn tạo checklist công việc, phân tách quy trình làm việc, phân tích tiến độ hoặc lên lịch thời gian thông minh tối ưu nhất. Bạn muốn hỏi gì hôm nay?',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Headers helper with API key
  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['x-gemini-key'] = apiKey;
    }
    return headers;
  };

  // 1. Logic to create checklists
  const handleGenerateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistPrompt.trim()) return;

    setGeneratingChecklist(true);
    setChecklistSuccessMessage('');
    setGeneratedTasks([]);

    try {
      const response = await fetch('/api/ai/generate-checklist', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ description: checklistPrompt })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Lỗi khi gọi máy chủ AI.');
      }

      const data = await response.json();
      if (data.tasks && Array.isArray(data.tasks)) {
        setGeneratedTasks(data.tasks.map((t: any) => ({
          name: t.name || 'Công việc không tên',
          duration: typeof t.duration === 'number' ? t.duration : 30,
          isShortTerm: typeof t.isShortTerm === 'boolean' ? t.isShortTerm : false,
          shortTermDeadline: t.shortTermDeadline || null,
          shortTermDeadlineTime: t.shortTermDeadlineTime || null,
          cycle: Array.isArray(t.cycle) ? t.cycle : null,
          airVideoSchedule: t.airVideoSchedule || null,
          deadline: t.deadline || null,
          deadlineTime: t.deadlineTime || null,
          selected: true
        })));
      } else {
        throw new Error('Dữ liệu AI trả về không đúng định dạng tối thiểu.');
      }
    } catch (err: any) {
      alert(err.message || 'Không thể tạo danh sách checklist. Vui lòng kiểm tra API Key của bạn.');
    } finally {
      setGeneratingChecklist(false);
    }
  };

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
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      daysList.push(`${y}-${m}-${d}`);
    } else {
      while (runner <= targetEndDate) {
        const y = runner.getFullYear();
        const m = String(runner.getMonth() + 1).padStart(2, '0');
        const d = String(runner.getDate()).padStart(2, '0');
        daysList.push(`${y}-${m}-${d}`);
        runner.setDate(runner.getDate() + 1);
      }
    }

    const N = daysList.length;
    const avg = Math.floor(totalMinutes / N);
    const remainder = totalMinutes % N;

    if (avg >= 60) {
      daysList.forEach((dayStr, idx) => {
        allocations[dayStr] = avg + (idx === 0 ? remainder : 0);
      });
    } else {
      let minutesLeft = totalMinutes;
      daysList.forEach((dayStr) => {
        if (minutesLeft >= 60) {
          allocations[dayStr] = 60;
          minutesLeft -= 60;
        } else if (minutesLeft > 0) {
          allocations[dayStr] = minutesLeft;
          minutesLeft = 0;
        }
      });
      if (minutesLeft > 0) {
        const firstDay = daysList[0];
        allocations[firstDay] = (allocations[firstDay] || 0) + minutesLeft;
      }
    }

    return allocations;
  };

  const handleUpdateTaskField = (idx: number, field: string, value: any) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleToggleCycleDay = (idx: number, day: string) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      const task = copy[idx];
      let currentCycle = Array.isArray(task.cycle) ? [...task.cycle] : [];
      if (currentCycle.includes(day)) {
        currentCycle = currentCycle.filter(d => d !== day);
      } else {
        currentCycle.push(day);
      }
      copy[idx] = { ...task, cycle: currentCycle };
      return copy;
    });
  };

  const handleToggleAir = (idx: number) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      const task = copy[idx];
      if (task.airVideoSchedule) {
        copy[idx] = { ...task, airVideoSchedule: null };
      } else {
        copy[idx] = { 
          ...task, 
          airVideoSchedule: { 
            days: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], 
            time: '20:00' 
          } 
        };
      }
      return copy;
    });
  };

  const handleToggleAirDay = (idx: number, day: string) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      const task = copy[idx];
      let airSchedule = task.airVideoSchedule ? { ...task.airVideoSchedule } : { days: [], time: '20:00' };
      let currentDays = Array.isArray(airSchedule.days) ? [...airSchedule.days] : [];
      if (currentDays.includes(day)) {
        currentDays = currentDays.filter(d => d !== day);
      } else {
        currentDays.push(day);
      }
      airSchedule.days = currentDays;
      copy[idx] = { ...task, airVideoSchedule: airSchedule };
      return copy;
    });
  };

  const handleUpdateAirTime = (idx: number, timeStr: string) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      const task = copy[idx];
      let airSchedule = task.airVideoSchedule ? { ...task.airVideoSchedule } : { days: [], time: '20:00' };
      airSchedule.time = timeStr;
      copy[idx] = { ...task, airVideoSchedule: airSchedule };
      return copy;
    });
  };

  const handleToggleDeadline = (idx: number) => {
    setGeneratedTasks(prev => {
      const copy = [...prev];
      const task = copy[idx];
      if (task.deadline) {
        copy[idx] = { ...task, deadline: null, deadlineTime: null };
      } else {
        copy[idx] = { ...task, deadline: 'T2, T6', deadlineTime: '09:00' };
      }
      return copy;
    });
  };

  // Logic to add generated checklists directly to Firestore user workspace
  const handleAddTasksToWorkspace = async () => {
    const selected = generatedTasks.filter(t => t.selected);
    if (!selected.length) return;

    setGeneratingChecklist(true);
    try {
      // Add each chosen task to database
      for (const t of selected) {
        let shortTermAllocations: any = null;
        if (t.isShortTerm) {
          let activeDeadline = t.shortTermDeadline;
          if (!activeDeadline) {
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() + 3);
            const y = fallbackDate.getFullYear();
            const m = String(fallbackDate.getMonth() + 1).padStart(2, '0');
            const d = String(fallbackDate.getDate()).padStart(2, '0');
            activeDeadline = `${y}-${m}-${d}`;
          }
          shortTermAllocations = computeShortTermAllocations(activeDeadline, t.duration);
        }

        await addDoc(collection(db, 'tasks'), {
          userId: user.uid,
          name: t.name,
          duration: t.duration,
          isShortTerm: t.isShortTerm || false,
          shortTermDeadline: t.shortTermDeadline || null,
          shortTermDeadlineTime: t.shortTermDeadlineTime || null,
          shortTermAllocations: shortTermAllocations,
          cycle: t.cycle || null,
          airVideoSchedule: t.airVideoSchedule || null,
          deadline: t.deadline || null,
          deadlineTime: t.deadlineTime || null,
          completedDates: [],
          createdAt: serverTimestamp()
        });
      }

      setChecklistSuccessMessage(`Đã thêm thành công ${selected.length} công việc mới vào TaskFlow của bạn!`);
      setGeneratedTasks([]);
      setChecklistPrompt('');
      
      // Notify components to update task list
      window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
    } catch (error: any) {
      alert('Gặp lỗi khi ghi vào cơ sở dữ liệu: ' + error.message);
    } finally {
      setGeneratingChecklist(false);
    }
  };

  // 2. Logic to run productivity analytics/restructuring/prioritization
  const handleRunAnalysis = async (type: 'productivity' | 'prioritize' | 'schedule') => {
    setAnalysisType(type);
    setLoadingAnalysis(true);
    setAnalysisFeedback('');
    setOptimizedDays([]);
    setPrioritizedTasks([]);

    try {
      // Fetch all tasks for this user from Firestore to analyze real data
      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const userTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (userTasks.length === 0) {
        throw new Error("Không tìm thấy công việc nào của bạn trong tài khoản để làm căn cứ phân tích. Vui lòng thêm một vài công việc trước.");
      }

      const endpoint = type === 'productivity' ? '/api/ai/analyze-productivity' 
                    : type === 'prioritize' ? '/api/ai/prioritize-tasks' 
                    : '/api/ai/optimize-schedule';

      const bodyPayload = type === 'productivity' 
        ? { tasks: userTasks, historyContext: "Người dùng mong muốn cải thiện cân đối thời gian biểu và năng suất ngày." }
        : type === 'prioritize' 
        ? { tasks: userTasks } 
        : { tasks: userTasks, userContext: "Tối ưu hóa thời gian sinh hoạt, sấp xếp lịch hợp lý để tránh dồn ứ công việc." };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gặp lỗi trong quá trình xử lý AI.');
      }

      const data = await response.json();

      if (type === 'productivity') {
        setAnalysisFeedback(data.feedback);
      } else if (type === 'prioritize') {
        setAnalysisFeedback(data.reasoning || 'Danh sách thứ tự ưu tiên của bạn tuân thủ các mốc thời gian gấp hoặc công việc quan trọng hàng đầu:');
        if (data.orderedTasks && Array.isArray(data.orderedTasks)) {
          // Join reasons and names together
          const merged = data.orderedTasks.map((orderedItem: any) => {
            const original = userTasks.find(ut => ut.id === orderedItem.id) as any;
            return {
              name: original?.name || 'Công việc không xác định',
              priority: orderedItem.priority || 'medium',
              reason: orderedItem.reason || 'Tiêu chuẩn đề xuất bởi AI',
              duration: original?.duration || 30
            };
          });
          setPrioritizedTasks(merged);
        }
      } else if (type === 'schedule') {
        if (data.days && Array.isArray(data.days)) {
          setOptimizedDays(data.days);
        }
        setOptimizedRecs(data.recommendations || '');
      }

    } catch (err: any) {
      alert(err.message || 'Lỗi khi đồng bộ phân tích. Hãy kiểm tra cài đặt dử liệu hoặc khoá API.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // 3. Chat with AI Assistant
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat) return;

    const userMessage = chatMessage;
    setChatMessage('');
    
    const formattedHistory = chatHistory.map(h => ({
      role: h.sender === 'user' ? 'user' : 'model',
      text: h.text
    }));

    setChatHistory(prev => [...prev, {
      sender: 'user',
      text: userMessage,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }]);

    setSendingChat(true);

    try {
      // Fetch user's current tasks list for AI to have active background context
      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const s = await getDocs(q);
      const currentTasksList = s.docs.map(d => ({ name: d.data().name, duration: d.data().duration }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          message: userMessage,
          history: formattedHistory,
          currentTasks: currentTasksList
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Lỗi khi gửi cuộc trò chuyện lên AI.');
      }

      const data = await response.json();
      setChatHistory(prev => [...prev, {
        sender: 'ai',
        text: data.reply || 'Xin lỗi, trợ lý chưa thể kết nối dữ liệu vào lúc này.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }]);

    } catch (err: any) {
      setChatHistory(prev => [...prev, {
        sender: 'ai',
        text: `⚠️ Lỗi kết nối trợ lý: ${err.message || 'Không thể liên lạc được dịch vụ.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1350px] mx-auto text-slate-300 font-sans min-h-[600px] select-none text-left">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Trợ lý AI Thông Minh
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Tối ưu hóa năng suất, lên lịch tự động và cộng tác làm việc dựa trên điện toán đám mây AI.
          </p>
        </div>

        {/* API Warning Check badge */}
        <div className="flex items-center gap-2 bg-[#18181b] border border-white/5 rounded-2xl px-3 py-1.5">
          <Sparkles size={12} className="text-indigo-400 shrink-0 animate-pulse" />
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Hạ tầng đám mây AI luôn sẵn sàng</span>
        </div>
      </div>

      {/* INNER TABS BAR */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/5 self-start">
        <button
          onClick={() => setActiveSection('analysis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            activeSection === 'analysis' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BrainCircuit size={14} />
          Phân tích & Tối ưu hóa
        </button>
        <button
          onClick={() => setActiveSection('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            activeSection === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bot size={14} />
          Chat với AI TaskFlow
        </button>
      </div>

      {/* CONTENT CONTENT PANEL */}
      <div className="bg-[#111113]/50 border border-white/5 rounded-[2rem] p-6 min-h-[460px] flex flex-col relative overflow-hidden shadow-xl">
        <AnimatePresence mode="wait">
          
          {/* 1. PRODUCTIVITY ANALYSIS & Restructuring TOOLS */}
          {activeSection === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 flex-1 flex flex-col"
            >
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Đồng bộ & Tối ưu hóa Năng suất Toàn Lực
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Sử dụng công nghệ trí tuệ nhân tạo để phân tích cơ sở dữ liệu công việc hiện tại của bạn, ưu tiên hóa và tái kiến trúc thời gian thông minh nhất.
                </p>
              </div>

              {/* Control Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Analyis Productivity */}
                <div
                  className={`flex flex-col items-start p-5 rounded-2xl border text-left bg-slate-950/40 border-white/5 transition-all relative group ${
                    analysisType === 'productivity' ? 'bg-indigo-500/5 border-indigo-500/20' : ''
                  }`}
                >
                  <TrendingUp size={20} className="text-indigo-400 mb-2" />
                  <span className="text-xs font-bold text-white mb-1 font-sans">Kiểm định & Phân tích Năng suất</span>
                  <span className="text-[10px] text-slate-500 leading-normal mb-4 font-sans">Nhận xét chi tiết trực quan về tiến trình sinh hoạt làm việc cá nhân của bạn.</span>
                  
                  <button
                    type="button"
                    onClick={() => handleRunAnalysis('productivity')}
                    className="mt-auto w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Zap size={10} />
                    Bắt đầu
                  </button>
                </div>

                {/* 2. Prioritize Eisenhower */}
                <div
                  className={`flex flex-col items-start p-5 rounded-2xl border text-left bg-slate-950/40 border-white/5 transition-all relative group ${
                    analysisType === 'prioritize' ? 'bg-indigo-500/5 border-indigo-500/20' : ''
                  }`}
                >
                  <ArrowRightLeft size={20} className="text-indigo-400 mb-2" />
                  <span className="text-xs font-bold text-white mb-1 font-sans">Ưu tiên hóa Công việc (Eisenhower)</span>
                  <span className="text-[10px] text-slate-500 leading-normal mb-4 font-sans">Sắp xếp các nhiệm vụ từ cao xuống thấp căn cứ trên mức độ cấp bách và thời hạn của bạn.</span>
                  
                  <button
                    type="button"
                    onClick={() => handleRunAnalysis('prioritize')}
                    className="mt-auto w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Zap size={10} />
                    Bắt đầu
                  </button>
                </div>

                {/* 3. Week Schedule Reorganization */}
                <div
                  className={`flex flex-col items-start p-5 rounded-2xl border text-left bg-slate-950/40 border-white/5 transition-all relative group ${
                    analysisType === 'schedule' ? 'bg-indigo-500/5 border-indigo-500/20' : ''
                  }`}
                >
                  <CalendarCheck size={20} className="text-indigo-400 mb-2" />
                  <span className="text-xs font-bold text-white mb-1 font-sans">Tái sắp xếp Lịch Trình Tuần</span>
                  <span className="text-[10px] text-slate-500 leading-normal mb-4 font-sans">Tự động phân bố các đầu việc trải dài 7 ngày trong tuần một cách hợp lý và súc tích.</span>
                  
                  <button
                    type="button"
                    onClick={() => handleRunAnalysis('schedule')}
                    className="mt-auto w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Zap size={10} />
                    Bắt đầu
                  </button>
                </div>
              </div>

              {/* ANALYSIS RESULTS DISPLAYER PANEL */}
              <div className="flex-1 bg-slate-950/40 border border-white/5 rounded-2xl p-5 min-h-[220px] flex flex-col justify-start">
                
                {/* Loader inside results block */}
                {loadingAnalysis && (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-3">
                    <RefreshCw size={18} className="text-indigo-400 animate-spin" />
                    <p className="text-xs text-slate-400">AI đang phân tích cấu trúc dữ liệu của bạn...</p>
                  </div>
                )}

                {/* Empty Initial Screen */}
                {!loadingAnalysis && !analysisFeedback && optimizedDays.length === 0 && prioritizedTasks.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-2">
                    <Bot size={28} className="text-indigo-400 opacity-60" />
                    <p className="text-xs font-bold text-slate-400">Chưa có kết quả tính toán</p>
                    <p className="text-[10px] text-slate-600 max-w-sm">Chọn một công cụ thông minh bên trên để ra lệnh cho trợ lý AI TaskFlow bắt đầu thực thi phân tích dữ liệu thực tế.</p>
                  </div>
                )}

                {/* Results - 1: Markdown Feedback (Productivity comments) */}
                {!loadingAnalysis && analysisFeedback && prioritizedTasks.length === 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-white/5 pb-2 mb-3">
                      <Zap size={14} className="text-indigo-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nhận xét nhận định của AI</h4>
                    </div>
                    <FormattedAIResponse text={analysisFeedback} />
                  </div>
                )}

                {/* Results - 2: Prioritized Tasks (Eisenhower representation) */}
                {!loadingAnalysis && prioritizedTasks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <ArrowRightLeft size={14} className="text-indigo-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Công việc ưu tiên đề xuất</h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Eisenhower & Ivy Lee Methodology</span>
                    </div>

                    <div className="text-xs text-slate-400 text-left italic mb-3">
                      {analysisFeedback}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {prioritizedTasks.map((pt, idx) => (
                        <div 
                          key={idx}
                          className="bg-slate-950 p-3.5 rounded-xl border border-white/5 flex items-start justify-between gap-2.5"
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-white block">{pt.name}</span>
                            <span className="text-[10px] text-slate-500 block">Lý do: {pt.reason}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              pt.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              pt.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-[#18181b] text-slate-400 border border-white/5'
                            }`}>
                              {pt.priority === 'high' ? 'Khẩn cấp/Quan Trọng' : pt.priority === 'medium' ? 'Trung bình' : 'Tiêu chuẩn'}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">{pt.duration}m</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results - 3: Restructured Weekly schedule layout table */}
                {!loadingAnalysis && optimizedDays.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-indigo-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Lịch Trình Tối Ưu Tuần Nay</h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Chia cân đối 7 ngày</span>
                    </div>

                    <div className="space-y-3">
                      {optimizedDays.map((dayObj: any, idx: number) => (
                        <div key={idx} className="bg-slate-950/60 border border-white/5 rounded-xl p-3 space-y-2 text-left">
                          <h5 className="text-xs font-bold text-indigo-400 tracking-tight flex items-center justify-between">
                            {dayObj.day}
                            <span className="text-[10px] text-slate-500 font-mono font-normal">({dayObj.tasks?.length || 0} công việc)</span>
                          </h5>
                          
                          {dayObj.tasks && dayObj.tasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {dayObj.tasks.map((t: any, tid: number) => (
                                <div key={tid} className="bg-[#111113] p-2 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                                  <div className="space-y-0.5">
                                    <span className="text-white font-semibold block">{t.taskName || t.name}</span>
                                    <span className="text-[9px] text-slate-500 block leading-normal">{t.reason || 'Sắp xếp bởi AI'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400">
                                    <Clock size={8} />
                                    {t.time || '08:00'} ({t.duration}m)
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 block">Trống — Ngày nghỉ ngơi thư giãn</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {optimizedRecs && (
                      <div className="bg-[#18181b]/55 p-3.5 border border-white/5 rounded-xl text-xs text-slate-400 text-left space-y-1">
                        <span className="font-bold text-white block">Khuyến nghị của AI:</span>
                        <p className="leading-relaxed leading-normal text-[11px]">{optimizedRecs}</p>
                      </div>
                    )}

                    {/* AI Schedule Confirmation Button */}
                    <div className="pt-4 border-t border-white/5 flex flex-col items-center gap-2 mt-4">
                      <p className="text-[10px] text-slate-500 text-center max-w-sm leading-normal">
                        Bấm nút xác nhận phía dưới để đồng bộ và cập nhật phân bổ "Ngày làm việc" của các task thực tế theo lịch trình đề xuất tốt nhất này.
                      </p>
                      <button
                        type="button"
                        onClick={handleConfirmSchedule}
                        disabled={applyingSchedule}
                        className="w-full bg-gradient-to-r from-indigo-700 to-indigo-500 hover:from-indigo-650 hover:to-indigo-455 hover:shadow-indigo-500/10 border border-indigo-500/25 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                      >
                        {applyingSchedule ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            Đang đồng bộ cơ sở dữ liệu...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} />
                            Đồng ý & Xác nhận xếp lịch
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* 3. CONVERSATIONAL SMART AI CHATBOT ACTIVATOR CARD */}
          {activeSection === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col justify-center items-center py-12 max-w-xl mx-auto text-center space-y-6"
            >
              <div className="relative">
                <div className={`w-18 h-18 rounded-full flex items-center justify-center border transition-all duration-300 ${
                  chatWidgetEnabled 
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-xl shadow-indigo-500/5 animate-pulse' 
                    : 'bg-slate-950 border-white/5 text-slate-500'
                }`}>
                  <Bot size={36} />
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <div className={`w-4 h-4 rounded-full border border-slate-950 flex items-center justify-center ${
                    chatWidgetEnabled ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-white tracking-tight font-sans">
                  Kích Hoạt Trợ Lý Chat với AI TaskFlow
                </h3>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed font-sans">
                  Khi bạn bật, một bong bóng tròn Chat với AI thông minh sẽ xuất hiện ở góc dưới bên phải màn hình. AI có khả năng can thiệp trực tiếp để tự động tạo công việc, hẹn giờ làm việc, hoặc gạch hoàn thành rảnh tay ngay khi bạn trò chuyện!
                </p>
              </div>

              <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={toggleChatWidget}
                  className={`w-full py-3 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer border ${
                    chatWidgetEnabled 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/25 shadow-lg shadow-rose-600/10' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/25 shadow-lg shadow-indigo-600/10'
                  }`}
                >
                  {chatWidgetEnabled ? 'Tắt Trợ lý Chat' : 'Bật Chat với AI TaskFlow ⚡'}
                </button>
                <span className="text-[10px] text-slate-500 font-mono">
                  Trạng thái hiện tại: {chatWidgetEnabled ? 'ĐANG KÍCH HOẠT (ĐANG CHẠY)' : 'ĐANG TẮT (ẨN)'}
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
