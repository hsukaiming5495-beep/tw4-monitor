#!/usr/bin/env python3
"""
tw4_collector.py — 四檔看盤台資料收集器
抓取 聯鈞(3450) 上詮(3363) 中華化(1727) 華星光(4979)：
  日K（約 400 天）、月營收、本益比/淨值比、三大法人、融資融券
來源：FinMind 開放 API（免 token 可用，有 token 額度較高）；股價失敗時改用 yfinance。

用法：
  python tw4_collector.py                         # 輸出 tw4_data.json
  python tw4_collector.py --html tw4_monitor.html # 另輸出內嵌資料的 tw4_monitor_local.html
  python tw4_collector.py --token <FINMIND_TOKEN> --days 500
環境變數 FINMIND_TOKEN 亦可。
"""
import argparse, datetime as dt, json, os, re, sys, time
from collections import defaultdict
import requests

STOCKS = {
    "3450": ("聯鈞", "TW"),
    "3363": ("上詮", "TWO"),
    "1727": ("中華化", "TW"),
    "4979": ("華星光", "TWO"),
}
FM_URL = "https://api.finmindtrade.com/api/v4/data"


def fm(dataset, sid, start, token=None, retries=3):
    params = {"dataset": dataset, "data_id": sid, "start_date": start}
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for k in range(retries):
        try:
            r = requests.get(FM_URL, params=params, headers=headers, timeout=30)
            j = r.json()
            if j.get("status") == 200:
                return j.get("data", [])
            msg = j.get("msg", "")
            if "limit" in msg.lower():
                print(f"  ! FinMind 額度用盡：{msg}（可用 --token）", file=sys.stderr)
                return []
            print(f"  ! {dataset} {sid}: {msg}", file=sys.stderr)
        except Exception as e:
            print(f"  ! {dataset} {sid} 第{k+1}次失敗：{e}", file=sys.stderr)
        time.sleep(2 * (k + 1))
    return []


def prices_finmind(sid, start, token):
    rows = fm("TaiwanStockPrice", sid, start, token)
    out = []
    for r in rows:
        if not r.get("close"):
            continue  # 停牌日
        out.append({"d": r["date"], "o": r["open"], "h": r["max"], "l": r["min"],
                    "c": r["close"], "v": round(r["Trading_Volume"] / 1000)})
    return out


def prices_yf(sid, suffix, days):
    try:
        import yfinance as yf
    except ImportError:
        print("  ! 未安裝 yfinance（pip install yfinance），無法備援", file=sys.stderr)
        return []
    df = yf.download(f"{sid}.{suffix}", period=f"{days}d", interval="1d",
                     auto_adjust=False, progress=False)
    if df is None or df.empty:
        return []
    if hasattr(df.columns, "levels"):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    out = []
    for idx, r in df.iterrows():
        if r["Close"] != r["Close"]:
            continue
        out.append({"d": idx.strftime("%Y-%m-%d"), "o": round(float(r["Open"]), 2),
                    "h": round(float(r["High"]), 2), "l": round(float(r["Low"]), 2),
                    "c": round(float(r["Close"]), 2), "v": round(float(r["Volume"]) / 1000)})
    return out


def revenue(sid, token):
    start = (dt.date.today() - dt.timedelta(days=800)).isoformat()
    rows = fm("TaiwanStockMonthRevenue", sid, start, token)
    by = {}
    for r in rows:
        ym = f"{int(r['revenue_year'])}-{int(r['revenue_month']):02d}"
        by[ym] = float(r["revenue"])
    keys = sorted(by)
    out = []
    for i, ym in enumerate(keys):
        y, m = map(int, ym.split("-"))
        prev_y = f"{y-1}-{m:02d}"
        prev_m = keys[i - 1] if i > 0 else None
        yoy = (by[ym] / by[prev_y] - 1) * 100 if prev_y in by and by[prev_y] else None
        mom = (by[ym] / by[prev_m] - 1) * 100 if prev_m and by[prev_m] else None
        out.append({"ym": ym, "rev": by[ym],
                    "yoy": round(yoy, 2) if yoy is not None else None,
                    "mom": round(mom, 2) if mom is not None else None})
    return out[-13:]


def per(sid, token):
    start = (dt.date.today() - dt.timedelta(days=40)).isoformat()
    rows = fm("TaiwanStockPER", sid, start, token)
    return [{"d": r["date"], "per": r.get("PER"), "pbr": r.get("PBR"),
             "dy": r.get("dividend_yield")} for r in rows][-20:]


def inst(sid, token):
    start = (dt.date.today() - dt.timedelta(days=40)).isoformat()
    rows = fm("TaiwanStockInstitutionalInvestorsBuySell", sid, start, token)
    agg = defaultdict(lambda: {"foreign": 0.0, "trust": 0.0, "dealer": 0.0})
    for r in rows:
        net = (r.get("buy", 0) - r.get("sell", 0)) / 1000  # 股 → 張
        name = r.get("name", "")
        if name.startswith("Foreign"):
            agg[r["date"]]["foreign"] += net
        elif name == "Investment_Trust":
            agg[r["date"]]["trust"] += net
        elif name.startswith("Dealer"):
            agg[r["date"]]["dealer"] += net
    return [{"d": d, **{k: round(v) for k, v in agg[d].items()}} for d in sorted(agg)][-20:]


def margin(sid, token):
    start = (dt.date.today() - dt.timedelta(days=40)).isoformat()
    rows = fm("TaiwanStockMarginPurchaseShortSale", sid, start, token)
    return [{"d": r["date"], "margin": r.get("MarginPurchaseTodayBalance", 0),
             "short": r.get("ShortSaleTodayBalance", 0)} for r in rows][-20:]


def embed(html_path, data, out_path):
    html = open(html_path, encoding="utf-8").read()
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    new, n = re.subn(
        r'(<script id="embedded-data" type="application/json">)(.*?)(</script>)',
        lambda m: m.group(1) + payload + m.group(3), html, count=1, flags=re.S)
    if not n:
        print("  ! HTML 內找不到 embedded-data 區塊，略過內嵌", file=sys.stderr)
        return
    open(out_path, "w", encoding="utf-8").write(new)
    print(f"✓ 離線版：{out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", default=os.environ.get("FINMIND_TOKEN"))
    ap.add_argument("--days", type=int, default=400)
    ap.add_argument("--out", default="tw4_data.json")
    ap.add_argument("--html", help="tw4_monitor.html 路徑；指定時另輸出內嵌資料版")
    a = ap.parse_args()

    start = (dt.date.today() - dt.timedelta(days=a.days)).isoformat()
    data = {"generated_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "stocks": {}}
    for sid, (name, suffix) in STOCKS.items():
        print(f"→ {sid} {name}")
        P = prices_finmind(sid, start, a.token)
        src = "FinMind"
        if len(P) < 70:
            P = prices_yf(sid, suffix, a.days)
            src = "yfinance"
        data["stocks"][sid] = {
            "name": name, "market": "上市" if suffix == "TW" else "上櫃",
            "price_source": src, "prices": P,
            "revenue": revenue(sid, a.token), "per": per(sid, a.token),
            "inst": inst(sid, a.token), "margin": margin(sid, a.token),
        }
        s = data["stocks"][sid]
        last = P[-1] if P else {}
        print(f"  K線 {len(P)} 筆（{src}，最後 {last.get('d','-')} 收 {last.get('c','-')}）"
              f"｜營收 {len(s['revenue'])}｜PER {len(s['per'])}｜法人 {len(s['inst'])}｜融資券 {len(s['margin'])}")

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"✓ 資料：{a.out}")
    if a.html:
        base, ext = os.path.splitext(a.html)
        embed(a.html, data, f"{base}_local{ext}")


if __name__ == "__main__":
    main()
