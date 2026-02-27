import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const API       = "/api";
const ML_API    = "http://127.0.0.1:5001/api";
const AGENT_API = "http://127.0.0.1:5002/agent";

/* ── GLOBAL STYLES ── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700;900&family=Barlow:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #070A0F;
      --panel:   #0C1018;
      --border:  #1A2235;
      --border2: #243048;
      --gold:    #F0C040;
      --green:   #26D97F;
      --red:     #FF4D6A;
      --dim:     #4A5A72;
      --text:    #CDD6E8;
      --text2:   #7A8FAD;
      --mono:    'Share Tech Mono', monospace;
      --display: 'Barlow Condensed', sans-serif;
      --body:    'Barlow', sans-serif;
    }
    body { background: var(--bg); color: var(--text); font-family: var(--body); }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--panel); }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
    @keyframes pulse-dot  { 0%,100%{opacity:1;}50%{opacity:0.2;} }
    @keyframes fadeIn     { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
    @keyframes ticker     { from{transform:translateX(0);}to{transform:translateX(-50%);} }
    @keyframes spin       { to{transform:rotate(360deg);} }
    @keyframes shimmer    { 0%{background-position:-400px 0;}100%{background-position:400px 0;} }
    .fade-in { animation: fadeIn 0.3s ease forwards; }
    .skeleton {
      background: linear-gradient(90deg, #0C1018 25%, #111820 50%, #0C1018 75%);
      background-size: 400px 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 3px;
    }
    input { background:#0A0F17;border:1px solid var(--border2);color:var(--text);font-family:var(--body);font-size:13px;outline:none;padding:8px 12px;border-radius:4px; }
    input:focus { border-color:var(--gold); }
    button { cursor:pointer;font-family:var(--display);font-weight:700;letter-spacing:0.08em;text-transform:uppercase; }

    /* ── Chat scrollbar ── */
    .chat-messages { scrollbar-width: thin; scrollbar-color: #243048 #070A0F; }
    .chat-messages::-webkit-scrollbar { width: 6px; }
    .chat-messages::-webkit-scrollbar-track { background: #070A0F; }
    .chat-messages::-webkit-scrollbar-thumb { background: #243048; border-radius: 3px; }
    .chat-messages::-webkit-scrollbar-thumb:hover { background: #F0C040; }
  `}</style>
);

/* ── TICKER ── */
const Ticker = ({ stocks }) => {
  if (!stocks.length) return <div style={{ height:28, borderBottom:"1px solid #1A2235", background:"#070A0F" }} />;
  const doubled = [...stocks, ...stocks];
  return (
    <div style={{ overflow:"hidden", background:"#070A0F", borderBottom:"1px solid #1A2235", height:28 }}>
      <div style={{ display:"flex", animation:"ticker 40s linear infinite", whiteSpace:"nowrap" }}>
        {doubled.map((s, i) => (
          <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"0 24px", fontFamily:"var(--mono)", fontSize:11, lineHeight:"28px" }}>
            <span style={{ color:"#7A8FAD" }}>{s.symbol}</span>
            <span style={{ color:"#CDD6E8" }}>${s.price?.toFixed(2)}</span>
            <span style={{ color: s.pct >= 0 ? "#26D97F" : "#FF4D6A" }}>{s.pct >= 0 ? "▲" : "▼"}{Math.abs(s.pct).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── STAT BOX ── */
const StatBox = ({ label, value, sub, accent, loading }) => (
  <div style={{ padding:"12px 16px", background:"#0C1018", border:"1px solid #1A2235", borderRadius:4, flex:1, minWidth:110 }}>
    <div style={{ fontFamily:"var(--display)", fontSize:10, fontWeight:600, letterSpacing:"0.12em", color:"#4A5A72", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
    {loading
      ? <div className="skeleton" style={{ height:20, width:"70%" }} />
      : <div style={{ fontFamily:"var(--mono)", fontSize:17, color: accent || "#CDD6E8", whiteSpace:"nowrap" }}>{value}</div>
    }
    {sub && !loading && <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"#4A5A72", marginTop:2, lineHeight:1.4 }}>{sub}</div>}
  </div>
);

/* ── TOOLTIP ── */
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div style={{ background:"#0A0F17", border:"1px solid #243048", padding:"10px 14px", fontFamily:"var(--mono)", fontSize:11 }}>
      <div style={{ color:"#7A8FAD", marginBottom:4 }}>{item.date}</div>
      {payload.find(p => p.dataKey === "price") &&
        <div style={{ color:"#F0C040" }}>Price: ${payload.find(p => p.dataKey === "price")?.value?.toFixed(2)}</div>}
      {payload.find(p => p.dataKey === "predicted") &&
        <div style={{ color:"#26D97F", marginTop:2 }}>Forecast: ${payload.find(p => p.dataKey === "predicted")?.value?.toFixed(2)}</div>}
      {item.volume && <div style={{ color:"#4A5A72", marginTop:2 }}>Vol: {(item.volume / 1e6).toFixed(1)}M</div>}
    </div>
  );
};

/* ── SPINNER ── */
const Spinner = ({ label = "Fetching live data..." }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1, flexDirection:"column", gap:12, minHeight:200 }}>
    <div style={{ width:32, height:32, border:"2px solid #1A2235", borderTop:"2px solid #F0C040", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"#4A5A72" }}>{label}</span>
  </div>
);

/* ── SIDEBAR SKELETON ── */
const SidebarSkeleton = () => (
  <>
    {[...Array(6)].map((_, i) => (
      <div key={i} style={{ padding:"10px 12px", borderBottom:"1px solid #0F1520" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <div className="skeleton" style={{ height:14, width:40 }} />
          <div className="skeleton" style={{ height:10, width:36 }} />
        </div>
        <div className="skeleton" style={{ height:10, width:90, marginBottom:6 }} />
        <div className="skeleton" style={{ height:13, width:55 }} />
      </div>
    ))}
  </>
);

/* ── SEARCH BAR ── */
const SearchBar = ({ onAdd }) => {
  const [q, setQ]                 = useState("");
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults((data || []).filter(r => r.type === "EQUITY" || r.type === "ETF").slice(0, 6));
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div style={{ position:"relative", padding:"10px 12px", borderBottom:"1px solid #1A2235" }}>
      <input
        placeholder="Search ticker..."
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ width:"100%", fontSize:12, padding:"6px 10px" }}
      />
      {searching && (
        <div style={{ position:"absolute", right:20, top:"50%", transform:"translateY(-50%)", width:10, height:10, border:"1px solid #243048", borderTop:"1px solid #F0C040", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      )}
      {results.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#0C1018", border:"1px solid #243048", borderTop:"none", zIndex:100, borderRadius:"0 0 4px 4px" }}>
          {results.map(r => (
            <div key={r.symbol}
              onClick={() => { onAdd(r.symbol); setQ(""); setResults([]); }}
              style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #111820", display:"flex", justifyContent:"space-between", alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.background = "#111820"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:13, color:"#F0C040" }}>{r.symbol}</span>
              <span style={{ fontFamily:"var(--body)", fontSize:11, color:"#4A5A72", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── AI CHAT ── */
function AIChat({ selectedStock }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:`**QuantDesk Agent ready.**\n\nAnalyzing **${selectedStock.symbol}** with live fundamentals, margins, analyst ratings & earnings data.\n\nWhat would you like to know?` }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  useEffect(() => {
    setMessages([{ role:"assistant", content:`**QuantDesk Agent ready.**\n\nAnalyzing **${selectedStock.symbol}** with live fundamentals, margins, analyst ratings & earnings data.\n\nWhat would you like to know?` }]);
  }, [selectedStock.symbol]);

  async function send(overrideMsg) {
    const userMsg = (overrideMsg || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages(m => [...m, { role:"user", content:userMsg }]);
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_API}/analyze`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          ticker:   selectedStock.symbol,
          question: userMsg,
          history:  messages.slice(-6),
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(m => [...m, { role:"assistant", content:data.answer }]);
    } catch (e) {
      setMessages(m => [...m, { role:"assistant", content:`⚠ ${e.message}\n\nMake sure **agent_server.py** is running:\n\`python agent_server.py\`` }]);
    } finally { setLoading(false); }
  }

  function renderInline(text) {
    return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith("**") ? <strong key={i} style={{ color:"#CDD6E8" }}>{p.slice(2,-2)}</strong> : p
    );
  }

  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# "))   return <div key={i} style={{ fontFamily:"var(--display)", fontWeight:900, fontSize:16, color:"#F0C040", marginTop:10, marginBottom:4 }}>{line.slice(2)}</div>;
      if (line.startsWith("## "))  return <div key={i} style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:14, color:"#F0C040", marginTop:8, marginBottom:2 }}>{line.slice(3)}</div>;
      if (line.startsWith("### ")) return <div key={i} style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:13, color:"#CDD6E8", marginTop:6, marginBottom:2 }}>{line.slice(4)}</div>;
      if (line.startsWith("---"))  return <div key={i} style={{ borderTop:"1px solid #1A2235", margin:"8px 0" }} />;
      if (line.startsWith("|")) {
        const cells = line.split("|").filter(c => c.trim() && !c.match(/^[-:\s]+$/));
        if (!cells.length) return null;
        return (
          <div key={i} style={{ display:"flex", borderBottom:"1px solid #1A2235" }}>
            {cells.map((cell, j) => (
              <div key={j} style={{ flex:1, padding:"4px 6px", fontFamily:"var(--mono)", fontSize:10, color: j===0?"#CDD6E8":"#7A8FAD", borderRight: j < cells.length-1?"1px solid #1A2235":"none" }}>
                {cell.trim().replace(/\*\*/g,"")}
              </div>
            ))}
          </div>
        );
      }
      if (line.match(/^[-*] /)) return (
        <div key={i} style={{ display:"flex", gap:6, paddingLeft:8, marginTop:2 }}>
          <span style={{ color:"#F0C040", flexShrink:0 }}>·</span>
          <span style={{ color:"#A8BBCC", fontSize:12 }}>{renderInline(line.replace(/^[-*] /,""))}</span>
        </div>
      );
      if (line.match(/\*\*(BUY|HOLD|SELL|STRONG BUY|STRONG SELL)\*\*/i)) {
        const signal = line.match(/STRONG BUY|STRONG SELL|BUY|HOLD|SELL/i)?.[0]?.toUpperCase();
        const color  = signal?.includes("BUY") ? "#26D97F" : signal === "HOLD" ? "#F0C040" : "#FF4D6A";
        return (
          <div key={i} style={{ margin:"8px 0", padding:"6px 12px", background:`${color}18`, border:`1px solid ${color}50`, borderRadius:4, fontFamily:"var(--mono)", fontSize:12, color }}>
            {line.replace(/\*\*/g,"")}
          </div>
        );
      }
      if (!line.trim()) return <div key={i} style={{ height:6 }} />;
      return <div key={i} style={{ fontSize:12, lineHeight:1.7, color:"#A8BBCC" }}>{renderInline(line)}</div>;
    });
  }

  const quickActions = [
    { label:"Full Analysis",  q:`Give me a complete investment analysis for ${selectedStock.symbol}.` },
    { label:"Buy or Sell?",   q:`Should I buy, hold, or sell ${selectedStock.symbol} right now? Use the live data.` },
    { label:"Key Financials", q:`Show key financial metrics and ratios for ${selectedStock.symbol} in a table.` },
    { label:"Analyst View",   q:`What is the analyst consensus and price target for ${selectedStock.symbol}?` },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", fontFamily:"var(--body)" }}>

      {/* Header */}
      <div style={{ padding:"10px 16px", borderBottom:"1px solid #1A2235", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#26D97F", animation:"pulse-dot 2s ease infinite" }} />
        <span style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:12, letterSpacing:"0.12em", color:"#7A8FAD", textTransform:"uppercase" }}>AI Analyst · Claude</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--mono)", fontSize:9, color:"#2A3A52" }}>Live Data</span>
      </div>

      {/* Quick actions */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, padding:"8px 12px", borderBottom:"1px solid #1A2235", flexShrink:0 }}>
        {quickActions.map(a => (
          <button key={a.label} onClick={() => send(a.q)} disabled={loading}
            style={{ padding:"3px 10px", background:"#0C1018", color:"#7A8FAD", border:"1px solid #1A2235", borderRadius:3, fontSize:10, transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#F0C040"; e.currentTarget.style.color="#F0C040"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1A2235"; e.currentTarget.style.color="#7A8FAD"; }}
          >{a.label}</button>
        ))}
      </div>

      {/* Messages — scrollable with styled scrollbar */}
      <div className="chat-messages" style={{ flex:1, overflowY:"scroll", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {messages.map((m, i) => (
          <div key={i} className="fade-in" style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width:20, height:20, borderRadius:2, background:"#0F1A2E", border:"1px solid #243048", display:"flex", alignItems:"center", justifyContent:"center", marginRight:8, flexShrink:0, marginTop:2 }}>
                <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"#F0C040" }}>AI</span>
              </div>
            )}
            <div style={{ maxWidth:"90%", padding:"8px 12px", borderRadius:m.role==="user"?"8px 8px 2px 8px":"2px 8px 8px 8px", background:m.role==="user"?"#0F1E38":"#0C1018", border:`1px solid ${m.role==="user"?"#243048":"#1A2235"}`, fontSize:12, lineHeight:1.7, color:m.role==="user"?"#CDD6E8":"#A8BBCC" }}>
              {m.role === "user" ? m.content : renderContent(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <div style={{ width:20, height:20, borderRadius:2, background:"#0F1A2E", border:"1px solid #243048", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"#F0C040" }}>AI</span>
            </div>
            <div style={{ padding:"8px 14px", background:"#0C1018", border:"1px solid #1A2235", borderRadius:"2px 8px 8px 8px" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"#4A5A72" }}>Analyzing {selectedStock.symbol}</span>
              {[0,1,2].map(n => <span key={n} style={{ fontFamily:"var(--mono)", fontSize:16, color:"#F0C040", animation:`pulse-dot 1.2s ease ${n*0.2}s infinite` }}>.</span>)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid #1A2235", flexShrink:0 }}>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{ flex:1, borderRadius:4 }} placeholder={`Ask about ${selectedStock.symbol}...`}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} />
          <button onClick={() => send()} disabled={loading}
            style={{ padding:"0 16px", background:loading?"#1A2235":"#F0C040", color:loading?"#4A5A72":"#070A0F", border:"none", borderRadius:4, fontSize:11 }}>
            {loading ? "..." : "ASK"}
          </button>
        </div>
        <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"#2A3A52", marginTop:6 }}>
          Claude · 15+ Live Indicators · {selectedStock.symbol}
        </div>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [stocks, setStocks]               = useState([]);
  const [idx, setIdx]                     = useState(0);
  const [history, setHistory]             = useState([]);
  const [timeRange, setTimeRange]         = useState(90);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stocksError, setStocksError]     = useState(null);
  const [watchlist, setWatchlist]         = useState([
    "NVDA","AAPL","TSLA","AMZN","MSFT","META","GOOGL","NFLX","AMD","COIN"
  ]);

  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlLoading, setMlLoading]       = useState(false);
  const [mlError, setMlError]           = useState(null);
  const [showForecast, setShowForecast] = useState(false);

  useEffect(() => {
    setLoadingStocks(true);
    setStocksError(null);
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);
    fetch(`${API}/stocks?symbols=${watchlist.join(",")}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json(); })
      .then(data => { setStocks(data); setLoadingStocks(false); })
      .catch(err => {
        if (err.name !== "AbortError") { setStocksError("Cannot connect to server. Is server.py running?"); setLoadingStocks(false); }
      })
      .finally(() => clearTimeout(timeoutId));
    return () => controller.abort();
  }, [watchlist]);

  useEffect(() => {
    if (!stocks.length) return;
    const symbol = stocks[Math.min(idx, stocks.length - 1)]?.symbol;
    if (!symbol) return;
    setLoadingHistory(true);
    setMlPrediction(null);
    setShowForecast(false);
    setMlError(null);
    fetch(`${API}/history/${symbol}?days=${timeRange}`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  }, [idx, stocks, timeRange]);

  async function runPrediction() {
    if (!stock) return;
    setMlLoading(true); setMlError(null); setMlPrediction(null); setShowForecast(false);
    try {
      const res  = await fetch(`${ML_API}/predict/${stock.symbol}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMlPrediction(data); setShowForecast(true);
    } catch (e) { setMlError(e.message); }
    finally { setMlLoading(false); }
  }

  function addToWatchlist(symbol) { if (!watchlist.includes(symbol)) setWatchlist(w => [...w, symbol]); }
  function removeFromWatchlist(symbol) { setWatchlist(w => w.filter(s => s !== symbol)); setIdx(0); }

  const stock = stocks[Math.min(idx, stocks.length - 1)];

  const chartData = (() => {
    if (!showForecast || !mlPrediction) return history;
    const hist     = history.map(d => ({ ...d, predicted: null }));
    const forecast = mlPrediction.forecast.map(f => ({ date: f.date, price: null, predicted: f.predicted }));
    if (forecast.length && hist.length) forecast[0].predicted = hist[hist.length - 1].price;
    return [...hist, ...forecast];
  })();

  const allPrices  = chartData.map(d => d.price ?? d.predicted).filter(v => v != null);
  const minPrice   = allPrices.length ? Math.min(...allPrices) : 0;
  const maxPrice   = allPrices.length ? Math.max(...allPrices) : 0;
  const priceRange = maxPrice - minPrice;
  const forecastStartDate = showForecast && mlPrediction?.forecast?.length ? mlPrediction.forecast[0].date : null;

  return (
    <>
      <GlobalStyles />
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>

        {/* TOP BAR */}
        <div style={{ display:"flex", alignItems:"center", padding:"0 20px", height:44, borderBottom:"1px solid #1A2235", background:"#070A0F", gap:16, flexShrink:0 }}>
          <div style={{ fontFamily:"var(--display)", fontWeight:900, fontSize:18, letterSpacing:"0.08em", color:"#F0C040" }}>
            QUANT<span style={{ color:"#CDD6E8", fontWeight:300 }}>DESK</span>
          </div>
          <div style={{ width:1, height:20, background:"#1A2235" }} />
          <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"#4A5A72" }}>{new Date().toUTCString().slice(0,25)} UTC</div>
          <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: stocksError?"#FF4D6A":loadingStocks?"#F0C040":"#26D97F", animation:"pulse-dot 2s ease infinite" }} />
            <span style={{ fontFamily:"var(--mono)", fontSize:10, color: stocksError?"#FF4D6A":loadingStocks?"#F0C040":"#26D97F" }}>
              {stocksError ? "SERVER OFFLINE" : loadingStocks ? "FETCHING DATA..." : "LIVE DATA"}
            </span>
          </div>
        </div>

        {/* TICKER */}
        <Ticker stocks={stocks} />

        {/* MAIN 3-COL LAYOUT */}
        <div style={{ display:"grid", gridTemplateColumns:"210px 1fr 340px", flex:1, overflow:"hidden" }}>

          {/* SIDEBAR */}
          <div style={{ borderRight:"1px solid #1A2235", overflow:"auto", background:"#070A0F", display:"flex", flexDirection:"column" }}>
            <SearchBar onAdd={addToWatchlist} />
            <div style={{ padding:"8px 12px", fontFamily:"var(--display)", fontSize:10, fontWeight:700, letterSpacing:"0.14em", color:"#4A5A72", textTransform:"uppercase", borderBottom:"1px solid #1A2235" }}>
              Watchlist · {watchlist.length}
            </div>
            {stocksError && <div style={{ padding:16, fontFamily:"var(--mono)", fontSize:11, color:"#FF4D6A", lineHeight:1.6 }}>⚠ {stocksError}</div>}
            {loadingStocks && !stocksError && <SidebarSkeleton />}
            {!loadingStocks && !stocksError && stocks.map((s, i) => {
              const isActive = i === idx;
              return (
                <div key={s.symbol} onClick={() => setIdx(i)}
                  style={{ padding:"10px 12px", cursor:"pointer", background:isActive?"#0C1018":"transparent", borderLeft:`2px solid ${isActive?"#F0C040":"transparent"}`, borderBottom:"1px solid #0F1520", transition:"background 0.1s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <span style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:14, color:isActive?"#F0C040":"#CDD6E8" }}>{s.symbol}</span>
                    <span style={{ fontFamily:"var(--mono)", fontSize:10, color:s.pct>=0?"#26D97F":"#FF4D6A" }}>{s.pct>=0?"▲":"▼"}{Math.abs(s.pct).toFixed(2)}%</span>
                  </div>
                  <div style={{ fontFamily:"var(--body)", fontSize:11, color:"#4A5A72", marginBottom:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"var(--mono)", fontSize:13, color:"#A8BBCC" }}>${s.price?.toFixed(2)}</span>
                    <span onClick={e => { e.stopPropagation(); removeFromWatchlist(s.symbol); }} style={{ fontFamily:"var(--mono)", fontSize:10, color:"#2A3A52", cursor:"pointer" }}>✕</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CHART PANEL */}
          {loadingStocks && !stocksError ? <Spinner label="Loading market data..." />
          : stocksError ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1, flexDirection:"column", gap:16 }}>
              <div style={{ fontFamily:"var(--mono)", fontSize:28, color:"#FF4D6A" }}>⚠</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"#4A5A72", textAlign:"center", lineHeight:1.8 }}>
                Cannot connect to Flask server.<br />Run: <span style={{ color:"#F0C040" }}>python server.py</span>
              </div>
            </div>
          ) : !stock ? <Spinner /> : (
            <div style={{ overflow:"auto", display:"flex", flexDirection:"column", background:"#070A0F" }}>

              <div style={{ padding:"16px 24px", borderBottom:"1px solid #1A2235", display:"flex", alignItems:"flex-start", gap:24 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                    <span style={{ fontFamily:"var(--display)", fontWeight:900, fontSize:32, color:"#F0C040" }}>{stock.symbol}</span>
                    <span style={{ fontFamily:"var(--body)", fontWeight:300, fontSize:14, color:"#4A5A72" }}>{stock.name}</span>
                  </div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"#4A5A72", marginTop:2 }}>{stock.sector}</div>
                </div>
                <div style={{ marginLeft:"auto", textAlign:"right" }}>
                  <div style={{ fontFamily:"var(--mono)", fontSize:28, color:"#CDD6E8" }}>${stock.price?.toFixed(2)}</div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:13, color:stock.pct>=0?"#26D97F":"#FF4D6A" }}>
                    {stock.pct>=0?"+":""}{stock.change?.toFixed(2)} ({stock.pct>=0?"+":""}{stock.pct?.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div style={{ display:"flex", gap:1, padding:"12px 24px", flexWrap:"wrap" }}>
                <StatBox label="Mkt Cap"    value={stock.mktCap} />
                <div style={{ width:1 }} />
                <StatBox label="P/E Ratio"  value={stock.pe} />
                <div style={{ width:1 }} />
                <StatBox label="Avg Volume" value={stock.vol} />
                {mlPrediction && (
                  <>
                    <div style={{ width:1 }} />
                    <StatBox label="DL Signal" value={mlPrediction.signal}
                      accent={mlPrediction.signal.includes("BUY")?"#26D97F":mlPrediction.signal==="HOLD"?"#F0C040":"#FF4D6A"}
                      sub="Transformer model" />
                    <div style={{ width:1 }} />
                    <StatBox label="DL Target (14d)" value={`$${mlPrediction.targetPrice}`}
                      accent={mlPrediction.deltaPct>=0?"#26D97F":"#FF4D6A"}
                      sub={`${mlPrediction.deltaPct>=0?"+":""}${mlPrediction.deltaPct}% projected`} />
                  </>
                )}
                {mlLoading && (
                  <>
                    <div style={{ width:1 }} />
                    <StatBox label="DL Signal"       value="—" sub="Training..." accent="#4A5A72" loading />
                    <div style={{ width:1 }} />
                    <StatBox label="DL Target (14d)" value="—" sub="30–90s"     accent="#4A5A72" loading />
                  </>
                )}
              </div>

              <div style={{ display:"flex", gap:4, padding:"0 24px 12px", alignItems:"center", flexWrap:"wrap" }}>
                {[14,30,60,90].map(d => (
                  <button key={d} onClick={() => setTimeRange(d)}
                    style={{ padding:"4px 12px", background:timeRange===d?"#F0C040":"#0C1018", color:timeRange===d?"#070A0F":"#4A5A72", border:`1px solid ${timeRange===d?"#F0C040":"#1A2235"}`, borderRadius:3, fontSize:11 }}>
                    {d}D
                  </button>
                ))}
                <div style={{ width:1, height:20, background:"#1A2235", margin:"0 4px" }} />
                <button onClick={runPrediction} disabled={mlLoading}
                  style={{ padding:"4px 16px", background:mlLoading?"#0C1018":showForecast?"#26D97F":"#111820", color:mlLoading?"#4A5A72":showForecast?"#070A0F":"#26D97F", border:`1px solid ${mlLoading?"#1A2235":"#26D97F"}`, borderRadius:3, fontSize:11, display:"flex", alignItems:"center", gap:6 }}>
                  {mlLoading ? <><div style={{ width:8, height:8, border:"1px solid #4A5A72", borderTop:"1px solid #26D97F", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />TRAINING...</> : showForecast ? "✓ FORECAST ON" : "⚡ RUN TRANSFORMER"}
                </button>
                {showForecast && (
                  <button onClick={() => { setShowForecast(false); setMlPrediction(null); }}
                    style={{ padding:"4px 10px", background:"transparent", color:"#4A5A72", border:"1px solid #1A2235", borderRadius:3, fontSize:11 }}>CLEAR</button>
                )}
                {mlError && <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"#FF4D6A", marginLeft:8 }}>⚠ {mlError}</span>}
              </div>

              <div style={{ flex:1, padding:"0 24px 12px", minHeight:280 }}>
                {loadingHistory ? <Spinner label="Loading price history..." /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#F0C040" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#F0C040" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#26D97F" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#26D97F" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontFamily:"'Share Tech Mono'", fontSize:9, fill:"#4A5A72" }} tickLine={false} axisLine={{ stroke:"#1A2235" }} interval={Math.floor(chartData.length/6)} />
                      <YAxis domain={[minPrice-priceRange*0.05, maxPrice+priceRange*0.05]} tick={{ fontFamily:"'Share Tech Mono'", fontSize:9, fill:"#4A5A72" }} tickLine={false} axisLine={false} tickFormatter={v=>`$${v.toFixed(0)}`} width={62} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area dataKey="price" stroke="#F0C040" strokeWidth={1.5} fill="url(#goldGrad)" dot={false} activeDot={{ r:4, fill:"#F0C040", strokeWidth:0 }} connectNulls={false} />
                      {showForecast && <Area dataKey="predicted" stroke="#26D97F" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#greenGrad)" dot={false} activeDot={{ r:4, fill:"#26D97F", strokeWidth:0 }} connectNulls={false} />}
                      {forecastStartDate && <ReferenceLine x={forecastStartDate} stroke="#243048" strokeDasharray="3 3" label={{ value:"Forecast →", position:"top", fill:"#26D97F", fontSize:9, fontFamily:"'Share Tech Mono'" }} />}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ display:"flex", gap:20, padding:"0 24px 16px" }}>
                {[["#F0C040","Price"],...(showForecast?[["#26D97F","Transformer Forecast (14d)"]]:[])]
                  .map(([color,label]) => (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:20, height:2, background:color, borderRadius:1 }} />
                      <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"#4A5A72" }}>{label}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* CHAT */}
          <div style={{ borderLeft:"1px solid #1A2235", display:"flex", flexDirection:"column", background:"#070A0F", overflow:"hidden" }}>
            {stock
              ? <AIChat selectedStock={stock} />
              : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1 }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"#2A3A52" }}>Select a stock</span>
                </div>
            }
          </div>

        </div>
      </div>
    </>
  );
}