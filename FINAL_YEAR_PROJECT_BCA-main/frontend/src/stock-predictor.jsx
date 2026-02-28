import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Fake market data generator ───────────────────────────────────────────────
const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA Corp", price: 892.45, change: +4.21, pct: +0.47, sector: "Technology" },
  { symbol: "AAPL", name: "Apple Inc.", price: 187.32, change: -1.18, pct: -0.63, sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc.", price: 248.75, change: +8.94, pct: +3.73, sector: "Auto/EV" },
  { symbol: "AMZN", name: "Amazon.com", price: 186.91, change: +2.03, pct: +1.10, sector: "E-Commerce" },
  { symbol: "MSFT", name: "Microsoft", price: 415.27, change: -0.87, pct: -0.21, sector: "Technology" },
  { symbol: "META", name: "Meta Platforms", price: 529.83, change: +12.41, pct: +2.40, sector: "Social Media" },
];

function generatePriceHistory(basePrice, days = 90, volatility = 0.02) {
  const data = [];
  let price = basePrice * 0.82;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const change = (Math.random() - 0.48) * volatility * price;
    price = Math.max(price + change, price * 0.5);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 80000000 + 20000000),
      predicted: i <= 14 ? parseFloat((price * (1 + (Math.random() - 0.4) * 0.015)).toFixed(2)) : null,
    });
  }
  return data;
}

function generatePrediction(stock) {
  const confidence = (75 + Math.random() * 22).toFixed(1);
  const targetDelta = (Math.random() * 12 - 3);
  const target = (stock.price * (1 + targetDelta / 100)).toFixed(2);
  const signal = targetDelta > 2 ? "STRONG BUY" : targetDelta > 0 ? "BUY" : targetDelta > -2 ? "HOLD" : "SELL";
  const signalColor = signal.includes("BUY") ? "#F5C842" : signal === "HOLD" ? "#94A3B8" : "#EF4444";
  return { confidence, target, signal, signalColor, targetDelta: targetDelta.toFixed(2) };
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0D1117", border: "1px solid #F5C84240", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#94A3B8", fontSize: 11, margin: 0 }}>{payload[0]?.payload?.date}</p>
      <p style={{ color: "#F5C842", fontSize: 14, fontWeight: 700, margin: "4px 0 0" }}>${payload[0]?.value?.toLocaleString()}</p>
      {payload[1] && <p style={{ color: "#818CF8", fontSize: 12, margin: "2px 0 0" }}>Predicted: ${payload[1]?.value?.toLocaleString()}</p>}
    </div>
  );
};

// ─── AI Chat Component ─────────────────────────────────────────────────────────
function AIChat({ selectedStock, prediction }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hello! I'm your AI market analyst. I'm currently analyzing **${selectedStock.symbol}** — ${selectedStock.name}. The model signals a **${prediction.signal}** with ${prediction.confidence}% confidence and a 14-day price target of **$${prediction.target}**. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Switched to **${selectedStock.symbol}** — ${selectedStock.name}. Current price: **$${selectedStock.price}** (${selectedStock.change > 0 ? "+" : ""}${selectedStock.change}). AI signal: **${prediction.signal}** with ${prediction.confidence}% confidence. How can I help you analyze this stock?`,
      },
    ]);
  }, [selectedStock.symbol]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const systemPrompt = `You are an expert AI stock market analyst for a premium trading platform. You are currently analyzing ${selectedStock.symbol} (${selectedStock.name}). 
Current data: Price $${selectedStock.price}, Change: ${selectedStock.change > 0 ? "+" : ""}${selectedStock.pct}%, Sector: ${selectedStock.sector}.
AI Prediction: ${prediction.signal} signal, ${prediction.confidence}% confidence, 14-day target: $${prediction.target} (${prediction.targetDelta > 0 ? "+" : ""}${prediction.targetDelta}%).
Provide concise, insightful, expert analysis. Use markdown bold for key numbers and terms. Keep responses under 150 words and focused.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "I encountered an issue. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "#F5C842" }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080C12", borderRadius: 16, border: "1px solid #1E2937", overflow: "hidden" }}>
      {/* Chat Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E2937", background: "linear-gradient(135deg, #0D1117, #111827)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #F5C842, #D4A017)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#F1F5F9", fontFamily: "'Sora', sans-serif" }}>ORACLE AI Analyst</p>
          <p style={{ margin: 0, fontSize: 11, color: "#4ADE80" }}>● Live · {selectedStock.symbol} Mode</p>
        </div>
        <div style={{ marginLeft: "auto", padding: "4px 10px", background: "#F5C84215", border: "1px solid #F5C84240", borderRadius: 20, fontSize: 10, color: "#F5C842", fontWeight: 700 }}>GPT-4 POWERED</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12, scrollbarWidth: "thin", scrollbarColor: "#1E2937 transparent" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? "linear-gradient(135deg, #F5C842, #D4A017)" : "#111827",
              border: msg.role === "assistant" ? "1px solid #1E2937" : "none",
              fontSize: 13, lineHeight: 1.6, color: msg.role === "user" ? "#0D1117" : "#CBD5E1",
              fontFamily: "'DM Sans', sans-serif", fontWeight: msg.role === "user" ? 600 : 400,
            }}>
              {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[0, 1, 2].map((j) => (
              <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: "#F5C842", animation: `pulse 1.2s ${j * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1E2937", display: "flex", gap: 10, background: "#080C12" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={`Ask about ${selectedStock.symbol}...`}
          style={{
            flex: 1, background: "#0D1117", border: "1px solid #1E2937", borderRadius: 10, padding: "10px 14px",
            color: "#F1F5F9", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#F5C84280")}
          onBlur={(e) => (e.target.style.borderColor = "#1E2937")}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "#1E2937" : "linear-gradient(135deg, #F5C842, #D4A017)",
            border: "none", borderRadius: 10, width: 42, height: 42, cursor: loading ? "wait" : "pointer",
            fontSize: 17, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {loading ? "⋯" : "↑"}
        </button>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function StockPredictor() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [priceData, setPriceData] = useState({});
  const [predictions, setPredictions] = useState({});
  const [tab, setTab] = useState("chart");
  const [chatOpen, setChatOpen] = useState(true);
  const [ticker, setTicker] = useState(0);

  const selectedStock = STOCKS[selectedIdx];

  useEffect(() => {
    const data = {};
    const preds = {};
    STOCKS.forEach((s) => {
      data[s.symbol] = generatePriceHistory(s.price);
      preds[s.symbol] = generatePrediction(s);
    });
    setPriceData(data);
    setPredictions(preds);
  }, []);

  // Ticker animation
  useEffect(() => {
    const t = setInterval(() => setTicker((x) => (x + 1) % STOCKS.length), 2500);
    return () => clearInterval(t);
  }, []);

  const currentData = priceData[selectedStock.symbol] || [];
  const pred = predictions[selectedStock.symbol] || { confidence: "87.3", target: selectedStock.price, signal: "BUY", signalColor: "#F5C842", targetDelta: "5.2" };

  const chartMax = currentData.length ? Math.max(...currentData.map((d) => Math.max(d.price, d.predicted || 0))) * 1.02 : undefined;
  const chartMin = currentData.length ? Math.min(...currentData.map((d) => Math.min(d.price, d.predicted || 999999))) * 0.98 : undefined;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060A0F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2937; border-radius: 4px; }
        @keyframes pulse { 0%,100% { opacity:.3; transform:scale(.8) } 50% { opacity:1; transform:scale(1.1) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px #F5C84220 } 50% { box-shadow: 0 0 35px #F5C84240 } }
        @keyframes tickerScroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes scanline { 0% { top:-5% } 100% { top:105% } }
        .stock-card:hover { background: #111827 !important; border-color: #F5C84250 !important; transform: translateY(-2px); }
        .tab-btn:hover { color: #F1F5F9 !important; }
        .signal-badge { animation: glow 2.5s ease-in-out infinite; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060A0F", fontFamily: "'DM Sans', sans-serif", color: "#F1F5F9" }}>

        {/* ── Ticker Bar ── */}
        <div style={{ background: "#080C12", borderBottom: "1px solid #1E2937", overflow: "hidden", height: 32, display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 40, animation: "tickerScroll 25s linear infinite", whiteSpace: "nowrap" }}>
            {[...STOCKS, ...STOCKS].map((s, i) => (
              <span key={i} style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: s.change > 0 ? "#4ADE80" : "#EF4444", letterSpacing: 0.5 }}>
                <span style={{ color: "#64748B", marginRight: 6 }}>{s.symbol}</span>
                ${s.price.toLocaleString()} <span>{s.change > 0 ? "▲" : "▼"} {Math.abs(s.pct)}%</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Header ── */}
        <header style={{ padding: "0 32px", height: 64, display: "flex", alignItems: "center", borderBottom: "1px solid #1E2937", background: "rgba(8,12,18,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #F5C842, #D4A017)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Sora', sans-serif", letterSpacing: -0.5 }}>ORACLE <span style={{ color: "#F5C842" }}>PRO</span></span>
          </div>
          <nav style={{ marginLeft: 48, display: "flex", gap: 28 }}>
            {["Dashboard", "Portfolio", "Screener", "Reports", "Alerts"].map((n, i) => (
              <span key={n} style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#F1F5F9" : "#475569", cursor: "pointer", transition: "color 0.2s" }}>{n}</span>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ padding: "6px 14px", background: "#F5C84215", border: "1px solid #F5C84230", borderRadius: 20, fontSize: 11, color: "#F5C842", fontWeight: 700, letterSpacing: 0.5 }}>PRO PLAN</div>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #818CF8, #6366F1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>JD</div>
          </div>
        </header>

        {/* ── Main Layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: chatOpen ? "260px 1fr 360px" : "260px 1fr", gap: 0, height: "calc(100vh - 96px)", overflow: "hidden" }}>

          {/* ─ Sidebar ─ */}
          <aside style={{ borderRight: "1px solid #1E2937", overflowY: "auto", padding: "20px 12px", background: "#060A0F" }}>
            <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, paddingLeft: 8 }}>WATCHLIST</p>
            {STOCKS.map((s, i) => (
              <div
                key={s.symbol}
                className="stock-card"
                onClick={() => setSelectedIdx(i)}
                style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 6, cursor: "pointer", transition: "all 0.2s",
                  background: i === selectedIdx ? "#111827" : "transparent",
                  border: `1px solid ${i === selectedIdx ? "#F5C84260" : "transparent"}`,
                  animation: i === selectedIdx ? "none" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: i === selectedIdx ? "#F5C842" : "#F1F5F9", fontFamily: "'DM Mono', monospace" }}>{s.symbol}</p>
                    <p style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.name}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>${s.price}</p>
                    <p style={{ fontSize: 11, color: s.change > 0 ? "#4ADE80" : "#EF4444", marginTop: 2 }}>{s.change > 0 ? "+" : ""}{s.pct}%</p>
                  </div>
                </div>
                {predictions[s.symbol] && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: predictions[s.symbol].signalColor, fontWeight: 700, letterSpacing: 0.5 }}>{predictions[s.symbol].signal}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{predictions[s.symbol].confidence}% conf.</span>
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 24, padding: "16px", background: "#0D1117", borderRadius: 12, border: "1px solid #1E2937" }}>
              <p style={{ fontSize: 10, color: "#F5C842", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MARKET MOOD</p>
              {[["Fear/Greed", "68", "#F5C842"], ["Volatility", "22", "#818CF8"], ["Trend", "Bullish", "#4ADE80"]].map(([label, val, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* ─ Main Content ─ */}
          <main style={{ overflowY: "auto", padding: "24px 28px", animation: "slideIn 0.4s ease-out" }}>
            {/* Stock Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: "'Sora', sans-serif", letterSpacing: -1 }}>{selectedStock.symbol}</h1>
                  <span style={{ fontSize: 13, color: "#475569", paddingTop: 6 }}>{selectedStock.name}</span>
                  <span style={{ fontSize: 11, padding: "3px 8px", background: "#1E2937", borderRadius: 6, color: "#64748B" }}>{selectedStock.sector}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: -1 }}>${selectedStock.price.toLocaleString()}</span>
                  <span style={{ fontSize: 16, color: selectedStock.change > 0 ? "#4ADE80" : "#EF4444", fontWeight: 600 }}>
                    {selectedStock.change > 0 ? "+" : ""}{selectedStock.change} ({selectedStock.change > 0 ? "+" : ""}{selectedStock.pct}%)
                  </span>
                </div>
              </div>

              {/* AI Prediction Badge */}
              <div className="signal-badge" style={{ background: "#0D1117", border: "1px solid #F5C84240", borderRadius: 16, padding: "16px 20px", textAlign: "center", minWidth: 180 }}>
                <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>AI PREDICTION</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: pred.signalColor, fontFamily: "'Sora', sans-serif", letterSpacing: -0.5 }}>{pred.signal}</p>
                <p style={{ fontSize: 13, color: "#F1F5F9", marginTop: 6 }}>Target: <strong style={{ color: "#F5C842" }}>${pred.target}</strong></p>
                <div style={{ marginTop: 10, height: 4, background: "#1E2937", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pred.confidence}%`, background: `linear-gradient(90deg, #F5C842, #D4A017)`, borderRadius: 2, transition: "width 1s ease" }} />
                </div>
                <p style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>{pred.confidence}% confidence</p>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                ["14D Target", `$${pred.target}`, `${pred.targetDelta > 0 ? "+" : ""}${pred.targetDelta}%`, "#F5C842"],
                ["Confidence", `${pred.confidence}%`, "AI Score", "#818CF8"],
                ["Volume", "47.2M", "+12% avg", "#4ADE80"],
                ["Market Cap", "$2.19T", "Mega Cap", "#38BDF8"],
              ].map(([label, val, sub, color]) => (
                <div key={label} style={{ background: "#0D1117", border: "1px solid #1E2937", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{label.toUpperCase()}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{val}</p>
                  <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Chart Tabs */}
            <div style={{ background: "#0D1117", border: "1px solid #1E2937", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #1E2937", padding: "0 20px" }}>
                {["chart", "volume", "indicators"].map((t) => (
                  <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
                    padding: "14px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: tab === t ? "#F5C842" : "#475569", borderBottom: `2px solid ${tab === t ? "#F5C842" : "transparent"}`,
                    textTransform: "capitalize", letterSpacing: 0.5, transition: "all 0.2s",
                  }}>
                    {t === "chart" ? "Price Chart" : t === "volume" ? "Volume" : "AI Indicators"}
                  </button>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingRight: 4 }}>
                  {["1W", "1M", "3M", "1Y"].map((p, i) => (
                    <button key={p} style={{ padding: "4px 10px", background: i === 2 ? "#F5C84220" : "none", border: `1px solid ${i === 2 ? "#F5C84240" : "transparent"}`, borderRadius: 6, fontSize: 11, color: i === 2 ? "#F5C842" : "#475569", cursor: "pointer" }}>{p}</button>
                  ))}
                </div>
              </div>

              <div style={{ padding: "20px", height: 320 }}>
                {tab === "chart" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={currentData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F5C842" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818CF8" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2937" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={14} />
                      <YAxis domain={[chartMin, chartMax]} tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine x={currentData[currentData.length - 14]?.date} stroke="#F5C84240" strokeDasharray="4 4" label={{ value: "Forecast →", fill: "#F5C84280", fontSize: 10 }} />
                      <Area type="monotone" dataKey="price" stroke="#F5C842" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                      <Area type="monotone" dataKey="predicted" stroke="#818CF8" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#predGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {tab === "volume" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={currentData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2937" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={14} />
                      <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="volume" stroke="#38BDF8" strokeWidth={1.5} fill="url(#volGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {tab === "indicators" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, height: "100%", alignContent: "start" }}>
                    {[
                      ["RSI (14)", "58.4", "Neutral", "#F5C842", 58],
                      ["MACD", "+2.14", "Bullish Cross", "#4ADE80", 72],
                      ["Bollinger", "Upper Band", "Near Resistance", "#EF4444", 82],
                      ["EMA 50", "$178.2", "Above EMA", "#4ADE80", 65],
                      ["Volume Signal", "Above Avg", "+14% 10D Avg", "#818CF8", 55],
                      ["AI Momentum", `${pred.confidence}%`, pred.signal, pred.signalColor, parseFloat(pred.confidence)],
                    ].map(([name, val, desc, color, pct]) => (
                      <div key={name} style={{ background: "#080C12", border: "1px solid #1E2937", borderRadius: 10, padding: "14px" }}>
                        <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>{name}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{val}</p>
                        <p style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{desc}</p>
                        <div style={{ marginTop: 8, height: 3, background: "#1E2937", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Insights Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
              <div style={{ background: "#0D1117", border: "1px solid #1E2937", borderRadius: 14, padding: "18px 20px" }}>
                <p style={{ fontSize: 10, color: "#F5C842", fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>AI ANALYSIS SUMMARY</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    ["Earnings Sentiment", "Positive", "#4ADE80"],
                    ["Institutional Flow", "Accumulating", "#4ADE80"],
                    ["Options Activity", "Bullish Skew", "#F5C842"],
                    ["News Sentiment", "Neutral-Positive", "#F5C842"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
                      <span style={{ fontSize: 12, color, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1E2937", borderRadius: 14, padding: "18px 20px" }}>
                <p style={{ fontSize: 10, color: "#818CF8", fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>RISK METRICS</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    ["Beta", "1.24", "#F5C842"],
                    ["Sharpe Ratio", "1.87", "#4ADE80"],
                    ["Max Drawdown", "-18.4%", "#EF4444"],
                    ["Support Level", `$${(selectedStock.price * 0.92).toFixed(2)}`, "#38BDF8"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
                      <span style={{ fontSize: 12, color, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* ─ AI Chat Panel ─ */}
          {chatOpen && (
            <aside style={{ borderLeft: "1px solid #1E2937", display: "flex", flexDirection: "column", background: "#060A0F" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #1E2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 1 }}>AI CHATBOX</span>
                <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <AIChat selectedStock={selectedStock} prediction={pred} />
              </div>
            </aside>
          )}
        </div>

        {/* Floating Chat Button when closed */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            style={{
              position: "fixed", bottom: 28, right: 28, width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #F5C842, #D4A017)", border: "none", cursor: "pointer",
              fontSize: 22, boxShadow: "0 8px 32px #F5C84240", transition: "transform 0.2s", zIndex: 200,
            }}
            onMouseOver={(e) => (e.target.style.transform = "scale(1.1)")}
            onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
          >
            ⚡
          </button>
        )}
      </div>
    </>
  );
}
