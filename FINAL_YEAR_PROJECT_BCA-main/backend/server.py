from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_caching import Cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import warnings

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "https://quantdesk-test.vercel.app",  # your actual Vercel URL
    "https://*.vercel.app"
])
# ---------------- CACHE ----------------
cache = Cache(app, config={
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300
})

# ---------------- DEFAULT WATCHLIST ----------------
DEFAULT_SYMBOLS = [
    "NVDA", "AAPL", "TSLA", "AMZN", "MSFT",
    "META", "GOOGL", "NFLX", "AMD", "COIN"
]

# ---------------- HELPERS ----------------
def format_large(n):
    if n is None:
        return "N/A"
    try:
        n = float(n)
    except:
        return "N/A"

    if n >= 1e12: return f"{n/1e12:.2f}T"
    if n >= 1e9:  return f"{n/1e9:.2f}B"
    if n >= 1e6:  return f"{n/1e6:.2f}M"
    return str(round(n,2))

def safe_round(v, d=2):
    try:
        return round(float(v), d)
    except:
        return "N/A"

# ---------------- PARALLEL STOCK FETCH ----------------
def fetch_one(symbol):
    try:
        t = yf.Ticker(symbol)
        info = t.info
        hist = t.history(period="2d")

        if hist.empty:
            return None

        cur = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist)>=2 else cur

        change = cur-prev
        pct = (change/prev*100) if prev else 0

        return {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName", symbol),
            "price": safe_round(cur),
            "change": safe_round(change),
            "pct": safe_round(pct),
            "sector": info.get("sector") or info.get("industry","—"),
            "mktCap": format_large(info.get("marketCap")),
            "pe": safe_round(info.get("trailingPE")) if info.get("trailingPE") else "N/A",
            "vol": format_large(info.get("averageVolume"))
        }

    except Exception as e:
        print("[fetch error]", symbol, e)
        return None

# ---------------- ROUTE: STOCK LIST ----------------
@app.route("/api/stocks")
@cache.cached(timeout=300, query_string=True)
def get_stocks():

    symbols = request.args.get(
        "symbols",
        ",".join(DEFAULT_SYMBOLS)
    ).split(",")

    symbols = [s.strip().upper() for s in symbols if s.strip()]

    results=[]

    with ThreadPoolExecutor(max_workers=10) as ex:
        futures={ex.submit(fetch_one,s):s for s in symbols}

        for f in as_completed(futures):
            r=f.result()
            if r: results.append(r)

    order={s:i for i,s in enumerate(symbols)}
    results.sort(key=lambda x:order.get(x["symbol"],99))

    return jsonify(results)

# ---------------- ROUTE: HISTORY (IMPORTANT FIX HERE) ----------------
@app.route("/api/history/<symbol>")
@cache.cached(timeout=600, query_string=True)
def get_history(symbol):

    symbol=symbol.upper()
    days=int(request.args.get("days",90))

    if days<=7:
        period,interval="7d","1h"
    elif days<=30:
        period,interval="1mo","1d"
    elif days<=90:
        period,interval="3mo","1d"
    else:
        period,interval="1y","1d"

    try:
        t=yf.Ticker(symbol)
        hist=t.history(period=period,interval=interval)

        if hist.empty:
            return jsonify([])

        data=[]

        for ts,row in hist.iterrows():

            fmt="%b %d" if interval=="1d" else "%b %d %H:%M"

            data.append({
                "date":ts.strftime(fmt),
                "price":safe_round(row["Close"]),
                "volume":int(row["Volume"])
            })

        return jsonify(data)

    except Exception as e:
        print("[history error]", e)
        return jsonify([])

# ---------------- SEARCH ----------------
@app.route("/api/search")
def search():

    q=request.args.get("q","").strip()

    if not q:
        return jsonify([])

    try:
        r=yf.Search(q,max_results=10)

        hits=[]

        for x in (r.quotes or []):
            sym=x.get("symbol")
            name=x.get("longname") or x.get("shortname")

            if sym and name:
                hits.append({
                    "symbol":sym,
                    "name":name,
                    "type":x.get("quoteType","")
                })

        return jsonify(hits[:8])

    except:
        return jsonify([])

# ---------------- DETAILS ----------------
@app.route("/api/detail/<symbol>")
@cache.cached(timeout=600, query_string=True)
def detail(symbol):

    try:
        info=yf.Ticker(symbol).info

        return jsonify({
            "symbol":symbol,
            "name":info.get("longName"),
            "sector":info.get("sector"),
            "industry":info.get("industry"),
            "country":info.get("country"),
            "mktCap":format_large(info.get("marketCap")),
            "pe":safe_round(info.get("trailingPE")),
            "eps":safe_round(info.get("trailingEps")),
            "beta":safe_round(info.get("beta"))
        })

    except:
        return jsonify({})

# ---------------- HEALTH ----------------
@app.route("/api/health")
def health():
    return jsonify({"status":"ok"})

# ---------------- CACHE CLEAR ----------------
@app.route("/api/cache/clear",methods=["POST"])
def clear():
    cache.clear()
    return jsonify({"status":"cleared"})

# ---------------- RUN ----------------
if __name__=="__main__":

    print("\nQuantDesk API running on http://localhost:5000\n")

    app.run(debug=True,port=5000,host="0.0.0.0")
