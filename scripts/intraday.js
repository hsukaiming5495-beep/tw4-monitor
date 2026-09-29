// 盤中觸價監控：讀 docs/state.json 的進場／停損／目標價位，抓即時價，穿越時推 Telegram
// 同一檔同一價位每天只提醒一次（紀錄存在 .cache/alerts.json，由 actions/cache 保留）
const fs = require("fs");
const path = require("path");
const { send, esc } = require("./tg.js");

const STATE = path.join(__dirname, "..", "docs", "state.json");
const STORE = path.join(__dirname, "..", ".cache", "alerts.json");
const MOVE_ALERT = Number(process.env.MOVE_ALERT_PCT || 5); // 單日漲跌幅提醒門檻 %

const twDate = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const twTime = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 16);

async function twse(codes, markets) {
  const ex = codes.map(c => `${markets[c] === "上櫃" ? "otc" : "tse"}_${c}.tw`).join("|");
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex)}&json=1&delay=0&_=${Date.now()}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://mis.twse.com.tw/stock/index.jsp" } });
  const j = await r.json();
  const out = {};
  for (const m of j.msgArray || []) {
    let p = parseFloat(m.z);
    if (isNaN(p)) p = parseFloat((m.b || "").split("_")[0]); // 無成交時用最佳買價
    const y = parseFloat(m.y);
    if (!isNaN(p)) out[m.c] = { price: p, prevClose: y, high: parseFloat(m.h), low: parseFloat(m.l), vol: parseInt(m.v) };
  }
  return out;
}

async function yahoo(code, market) {
  const sym = `${code}.${market === "上櫃" ? "TWO" : "TW"}`;
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = await r.json();
  const m = j.chart.result[0].meta;
  return { price: m.regularMarketPrice, prevClose: m.chartPreviousClose ?? m.previousClose };
}

async function main() {
  if (!fs.existsSync(STATE)) { console.log("尚無 state.json，請先跑一次盤後任務。"); return; }
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const codes = Object.keys(state.stocks);
  const markets = Object.fromEntries(codes.map(c => [c, state.stocks[c].market]));

  let Q = {};
  try { Q = await twse(codes, markets); } catch (e) { console.error("TWSE MIS 失敗：", e.message); }
  for (const c of codes) if (!Q[c]) { try { Q[c] = await yahoo(c, markets[c]); } catch (e) { console.error(`Yahoo ${c} 失敗：`, e.message); } }

  const today = twDate();
  let store = {};
  try { store = JSON.parse(fs.readFileSync(STORE, "utf8")); } catch (e) {}
  if (store.date !== today) store = { date: today, sent: {} };

  const alerts = [];
  for (const c of codes) {
    const s = state.stocks[c], q = Q[c];
    if (!q || !q.price) continue;
    const base = s.close; // 以最近收盤判斷價位在上方或下方
    for (const L of s.lines || []) {
      const key = `${c}@${L.label}@${L.price}`;
      if (store.sent[key]) continue;
      const hitUp = L.price > base && q.price >= L.price;
      const hitDn = L.price < base && q.price <= L.price;
      if (hitUp || hitDn) {
        store.sent[key] = twTime();
        alerts.push(`${hitUp ? "⬆️" : "⬇️"} <b>${esc(s.name)} ${c}</b> ${q.price} ${hitUp ? "觸及／突破" : "觸及／跌破"}「${esc(L.label)}」${L.price}`);
      }
    }
    if (q.prevClose) {
      const pct = (q.price / q.prevClose - 1) * 100;
      const key = `${c}@move`;
      if (Math.abs(pct) >= MOVE_ALERT && !store.sent[key]) {
        store.sent[key] = twTime();
        alerts.push(`⚡️ <b>${esc(s.name)} ${c}</b> 盤中${pct > 0 ? "大漲" : "大跌"} ${pct.toFixed(2)}%，現價 ${q.price}`);
      }
    }
  }

  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(store));
  console.log(`${today} ${twTime()} 報價：`, Object.fromEntries(Object.entries(Q).map(([k, v]) => [k, v.price])));
  if (!alerts.length) { console.log("無觸價。"); return; }
  const note = "\n<i>訊號參考 " + esc(state.lastDate) + " 盤後計畫；觸價後仍以收盤確認為準</i>";
  return send(`⏰ <b>盤中觸價 ${twTime()}</b>\n` + alerts.join("\n") + note);
}

main().catch(e => { console.error(e); process.exit(1); });
