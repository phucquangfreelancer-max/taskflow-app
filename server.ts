import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
// FIX: Dùng PORT từ môi trường (Render tự cấp), fallback về 3000 khi dev local
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('🔑 GEMINI_API_KEY loaded:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'KHÔNG TÌM THẤY ❌');

app.use(express.json());

function getAiClient(req: express.Request) {
  const clientKey = req.headers["x-gemini-key"] as string;
  const key = clientKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing Gemini API Key. Please configure it in your Settings.");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

function safeJsonParse(text: string, fallback: any = {}) {
  if (!text) return fallback;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]\}]/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return fallback;
  }
}

// 1. Optimize weekly schedule
app.post("/api/ai/optimize-schedule", async (req, res) => {
  try {
    const ai = getAiClient(req);
    const { tasks, userContext } = req.body;
    const prompt = `
      Bạn là một chuyên gia quản lý thời gian. Hãy giúp tôi tối ưu hóa lịch làm việc cho 1 tuần dựa trên các công việc sau:
      ${JSON.stringify(tasks)}
      
      Ngữ cảnh người dùng: ${userContext || 'Không có'}
      
      Yêu cầu:
      1. Chia lịch cụ thể từng ngày trong tuần (thứ 2 đến chủ nhật).
      2. TỐI ƯU THỨ TỰ VÀ PHÂN CHIA CÔNG VIỆC:
         - "Ngày làm việc" (cycle) đại diện cho chu kỳ làm việc lặp lại của task. Hãy phân chia công việc các ngày phù hợp, tối ưu và cân đối nhất.
         - Deadline sớm nhất: Đưa lên ĐẦU danh sách của ngày.
         - Duration (thời gian thực hiện) dài nhất: Đưa xuống CUỐI danh sách của ngày.
         - Cân đối khối lượng công việc giữa các ngày (mỗi ngày khoảng 8-10 tiếng làm việc).
      3. RÀNG BUỘC THỜI GIAN:
         - Khung giờ làm việc chính: 08:00 - 20:00.
         - Chiều Thứ 7 và Cả ngày Chủ nhật: Ưu tiên nghỉ ngơi, chỉ xếp các task lặp lại (cycle) hoặc task cực kỳ nhẹ nhàng.
      4. Kết quả trả về cho 7 ngày của tuần hiện tại.
      
      Kết quả trả về định dạng JSON:
      {
        "days": [
          {
            "day": "Thứ 2",
            "tasks": [
              { "time": "08:00", "taskName": "...", "duration": "Số phút", "priority": "high/medium/low", "reason": "Tại sao xếp ở đây" }
            ]
          }
        ],
        "recommendations": "Lời khuyên tổng quát"
      }
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    res.json(safeJsonParse(response.text, {}));
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message || "Failed to optimize schedule" });
  }
});

// 2. Generate Checklist
app.post("/api/ai/generate-checklist", async (req, res) => {
  try {
    const ai = getAiClient(req);
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Yêu cầu cung cấp mô tả công việc." });
    const prompt = `
      Hãy phân tích mục tiêu hoặc chủ đề sau: "${description}".
      Sinh ra một danh sách các công việc hoàn thành mục tiêu này một cách tối ưu nhất.
      
      Yêu Cầu Tối Ưu:
      1. CÀNG ÍT TASK CÀNG TỐT: Gom nhóm hợp lý, tránh chia nhỏ vụn vặt.
      2. TỰ ĐỘNG LÊN ĐẦY ĐỦ THÔNG TIN cho từng task:
         - name, duration (15-240 phút), isShortTerm, shortTermDeadline (YYYY-MM-DD),
           shortTermDeadlineTime (HH:MM), cycle (mảng thứ), airVideoSchedule, deadline, deadlineTime

      Kết quả JSON:
      { "tasks": [ { "name": "...", "duration": 60, "isShortTerm": true, "shortTermDeadline": "2026-05-25", "shortTermDeadlineTime": "18:00", "cycle": null, "airVideoSchedule": null, "deadline": null, "deadlineTime": null } ] }
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    res.json(safeJsonParse(response.text, { tasks: [] }));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate checklist" });
  }
});

// 3. Analyze productivity
app.post("/api/ai/analyze-productivity", async (req, res) => {
  try {
    const ai = getAiClient(req);
    const { tasks, historyContext } = req.body;
    const prompt = `
      Bạn là chuyên gia phân tích hiệu suất làm việc. Danh sách công việc: ${JSON.stringify(tasks)}
      Thông tin bổ sung: ${historyContext || "Không có."}
      Đưa ra nhận xét và đề xuất cụ thể bằng tiếng Việt ở định dạng Markdown.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });
    res.json({ feedback: response.text || "" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to analyze productivity" });
  }
});

// 4. Prioritize tasks
app.post("/api/ai/prioritize-tasks", async (req, res) => {
  try {
    const ai = getAiClient(req);
    const { tasks } = req.body;
    const prompt = `
      Sắp xếp độ ưu tiên các công việc sau theo phương pháp Eisenhower: ${JSON.stringify(tasks)}
      JSON: { "orderedTasks": [ { "id": "...", "priority": "high/medium/low", "reason": "..." } ], "reasoning": "..." }
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    res.json(safeJsonParse(response.text, { orderedTasks: [], reasoning: "" }));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to prioritize tasks" });
  }
});

// 5. Chat
app.post("/api/ai/chat", async (req, res) => {
  try {
    const ai = getAiClient(req);
    const { message, history, currentTasks } = req.body;
    const systemInstruction = `
      Bạn là TaskFlow AI - trợ lý quản lý công việc cá nhân thông minh.
      Hôm nay là ngày ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      Danh sách công việc hiện tại: ${JSON.stringify(currentTasks || [])}
      Trả lời ngắn gọn, tự nhiên bằng tiếng Việt.
      Đặt lệnh ở cuối: [CMD:START_TIMER name="..."], [CMD:PAUSE_TIMER], [CMD:STOP_TIMER],
      [CMD:CREATE_TASK name="..." duration=số isShortTerm=true/false ...],
      [CMD:COMPLETE_TASK name="..."], [CMD:DELETE_TASK name="..."]
    `;
    const contents = history.map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    }));
    contents.push({ role: "user", parts: [{ text: message }] });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: { systemInstruction }
    });
    res.json({ reply: response.text || "" });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) return res.status(429).json({ error: 'Đã vượt giới hạn Gemini API. Chờ 1 phút rồi thử lại.' });
    if (msg.toLowerCase().includes('api key') || msg.includes('401')) return res.status(401).json({ error: 'API Key không hợp lệ.' });
    res.status(500).json({ error: msg || "Lỗi xử lý AI." });
  }
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
