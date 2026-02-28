from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_caching import Cache
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import yfinance as yf
import threading
import time
import requests as req
import os
import warnings
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app, origins=["*"])

cache = Cache(app, config={
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300
})

DEFAULT_SYMBOLS = [
    "NVDA", "AAPL", "TSLA", "AMZN", "MSFT", "META",
    "GOOGL", "NFLX", "AMD", "COIN"
]

# ── Keep-alive pinger ─────────────────────────────────────────────
def keep_alive():
    """Ping self every 10 minutes to prevent Render cold starts."""
    self_url = os.getenv("RENDER_EXTERNAL_URL")
    if not self_url:
        print("[keep-alive] RENDER_EXTERNAL_URL not set — skipping pinger")
        return
    ping_url = f"{self_url}/api/health"
    print(f"[keep-alive] Pinger started → {ping_url} every 10min")
    while True:
        time.sleep(600)  # 10 minutes
        try:
            resp = req.get(ping_url, timeout=10)
            print(f"[keep-alive] ✅ Ping OK ({resp.status_code})")
        except Exception as e:
            print(f"[keep-alive] ⚠ Ping failed: {e}")

# Start pinger in background thread on startup
pinger_thread = threading.Thread(target=keep_alive, daemon=True)
pinger_thread.start()

# ── Helpers ───────────────────────────────────────────────────────
def format_large(n):
    if n is None: return "N/A"
    try: n = float(n)
    except: return "N/A"
    if n >= 1e12: return f"{n/1e12:.2f}T"
    if n >= 1e9:  return f"{n/1e9:.2f}B"
    if n >= 1e6:  return f"{n/1e6:.2f}M"
    return str(round(n, 2))

def safe_round(val, digits=2):
    try: return round(float(val), digits)
    except: return "N/A"

def fetch_one(symbol):
    try:
        ticker = yf.Ticker(symbol)
        info   = ticker.info
        hist   = ticker.history(period="2d")
        if hist.empty: return None
        current    = float(hist["Close"].iloc[-1])
        prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
        change     = current - prev_close
        pct        = (change / prev_close * 100) if prev_close else 0
        return {
            "symbol": symbol,
            "name":   info.get("longName") or info.get("shortName", symbol),
            "price":  safe_round(current),
            "change": safe_round(change),
            "pct":    safe_round(pct),
            "sector": info.get("sector") or info.get("industry", "—"),
            "mktCap": format_large(info.get("marketCap")),
            "pe":     safe_round(info.get("trailingPE")) if info.get("trailingPE") else "N/A",
            "vol":    format_large(info.get("averageVolume")),
        }
    except Exception as e:
        print(f"  [!] Error fetching {symbol}: {e}")
        return None

# ── Routes ────────────────────────────────────────────────────────
@app.route("/api/stocks")
@cache.cached(timeout=300, query_string=True)
def get_stocks():
    symbols = request.args.get("symbols", ",".join(DEFAULT_SYMBOLS)).split(",")
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    print(f"[stocks] Fetching {len(symbols)} symbols in parallel...")
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, s): s for s in symbols}
        for future in as_completed(futures):
            result = future.result()
            if result: results.append(result)
    order = {s: i for i, s in enumerate(symbols)}
    results.sort(key=lambda x: order.get(x["symbol"], 99))
    print(f"[stocks] Done — {len(results)} stocks returned")
    return jsonify(results)

@app.route("/api/history/<symbol>")
@cache.cached(timeout=600, query_string=True)
def get_history(symbol):
    symbol = symbol.upper()
    days   = int(request.args.get("days", 90))
    if days <= 7:    period, interval = "7d",  "1h"
    elif days <= 30: period, interval = "1mo", "1d"
    elif days <= 90: period, interval = "3mo", "1d"
    else:            period, interval = "1y",  "1d"
    try:
        hist = yf.Ticker(symbol).history(period=period, interval=interval)
        if hist.empty: return jsonify({"error": f"No data for {symbol}"}), 404
        data = []
        for ts, row in hist.iterrows():
            fmt = "%b %d" if interval == "1d" else "%b %d %H:%M"
            data.append({ "date": ts.strftime(fmt), "price": safe_round(row["Close"]), "volume": int(row["Volume"]) })
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip()
    if not q: return jsonify([])
    try:
        results = yf.Search(q, max_results=10)
        hits = []
        for r in (results.quotes or []):
            if r.get("symbol") and (r.get("longname") or r.get("shortname")):
                hits.append({ "symbol": r.get("symbol"), "name": r.get("longname") or r.get("shortname",""), "type": r.get("quoteType","") })
        return jsonify(hits[:8])
    except:
        return jsonify([])

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "server": "QuantDesk API", "port": 5000})

@app.route("/api/cache/clear", methods=["POST"])
def clear_cache():
    cache.clear()
    return jsonify({"status": "cache cleared"})

if __name__ == "__main__":
    print("=" * 52)
    print("  QuantDesk API — Flask + yfinance")
    print("  http://localhost:5000")
    print(f"  Keep-alive: {'✅ Active' if os.getenv('RENDER_EXTERNAL_URL') else '⚠ Set RENDER_EXTERNAL_URL on Render'}")
    print("=" * 52)
    app.run(debug=False, port=5000, host="0.0.0.0")
