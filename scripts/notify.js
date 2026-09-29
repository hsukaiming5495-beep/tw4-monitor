// 盤後訊號推播：讀 docs/tw4_data.json → 用與網頁相同的 engine.js 計算 → Telegram
// 同時寫 docs/state.json（供盤中觸價監控與下次比對訊號變化）
const fs = require("fs");
const path = require("path");
const { analyze, SETUP } = require("../docs/engine.js");
const { send, esc } = require("./tg.js");

const DOCS = path.join(__dirname, "..", "docs");
const DATA = path.join(DOCS, "tw4_data.json");
const STATE = path.join(DOCS, "state.json");
const FORCE = process.env.FORCE === "true";
const MODE = process.env.NOTIFY_MODE || "daily"; // daily＝每天摘要；changes＝只在訊號變化時推
const PAGES_URL = process.env.PAGES_URL || "";

const f2 = x => (x == null || isNaN(x)) ? "—" : Number(x).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = x => (x > 0 ? "+" : "") + x;

function main() {
  if (!fs.existsSync(DATA)) { console.error("找不到 tw4_data.json"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const prev = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { stocks: {} };

  const state = { updated: data.generated_at, lastDate: null, stocks: {} };
  const blocks = [], changes = [], entries = [];

  const ORDER = ["3450", "3363", "1727", "4979"];
  const codes = [...ORDER.filter(c => data.stocks[c]), ...Object.keys(data.stocks).filter(c => !ORDER.includes(c))];
  for (const code of codes) {
    const S = data.stocks[code];
    const A = analyze(S);
    if (!A) { blocks.push(`⚪️ <b>${esc(S.name)} ${code}</b>　資料不足（K 線 ${S.prices ? S.prices.length : 0} 筆）`); continue; }
    const I = A.I, i = A.i, c = I.c[i], chg = c - I.c[i - 1], pct = chg / I.c[i - 1] * 100;
    const st = SETUP[A.E.setup];
    state.lastDate = state.lastDate && state.lastDate > I.d[i] ? state.lastDate : I.d[i];
    state.stocks[code] = {
      name: S.name, market: S.market, date: I.d[i], close: c, setup: A.E.setup, dir: st.dir, score: A.score,
      atr: I.atr[i], lines: A.plan.lines.map(([p, t]) => ({ price: Math.round(p * 100) / 100, label: t }))
    };

    const was = prev.stocks && prev.stocks[code];
    const changed = was && was.setup !== A.E.setup;
    if (changed) changes.push(`${S.name}：${SETUP[was.setup] ? SETUP[was.setup].call : was.setup} → <b>${st.call}</b>`);
    if (st.dir !== 0 && (!was || was.setup !== A.E.setup)) entries.push(code);

    const icon = st.dir > 0 ? "🔴" : st.dir < 0 ? "🟢" : st.cls === "H" ? "🟡" : "⚪️";
    const mv = chg > 0 ? "🔺" : chg < 0 ? "🔻" : "▪️";
    const plan = A.plan.rows.filter(([k]) => k !== "方向").map(([k, v]) => `${k} ${typeof v === "number" ? f2(v) : v}`).join("｜");
    const top = A.items.slice().sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 3).map(x => `${x.w > 0 ? "+" : "−"} ${x.t}`).join("\n");
    blocks.push(
      `${icon} <b>${esc(S.name)} ${code}</b>　${f2(c)} ${mv}${f2(Math.abs(chg))}（${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%）\n` +
      `訊號 <b>${st.call}</b>｜分數 ${sign(A.score)}${changed ? "　🔔變化" : ""}\n` +
      `${esc(plan)}\n` +
      `<i>${esc(A.plan.trig)}</i>\n` +
      `${esc(top)}`
    );
  }

  const sameDay = prev.lastDate && prev.lastDate === state.lastDate;
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));

  if (sameDay && !FORCE) { console.log(`資料日期 ${state.lastDate} 與上次相同（休市或尚未更新），不推播。`); return; }
  if (MODE === "changes" && !changes.length && !FORCE) { console.log("訊號無變化，不推播。"); return; }

  let msg = `📊 <b>四檔看盤台｜${state.lastDate} 盤後訊號</b>\n`;
  if (changes.length) msg += `\n🔔 <b>訊號變化</b>\n${changes.join("\n")}\n`;
  if (entries.length) msg += `🎯 新進場訊號：${entries.map(c => data.stocks[c].name).join("、")}\n`;
  msg += "\n" + blocks.join("\n\n");
  msg += `\n\n<i>🔴做多 🟢放空 🟡過熱／超賣 ⚪️觀望｜停損 2×ATR｜非投資建議</i>`;
  if (PAGES_URL) msg += `\n${PAGES_URL}`;
  return send(msg);
}

Promise.resolve(main()).catch(e => { console.error(e); process.exit(1); });
