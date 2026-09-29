// Telegram 發送（Node 20 內建 fetch）。未設定 token 時只印到 console（dry-run）。
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID; // 可用逗號分隔多個 chat_id

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function chunks(text, max = 3900) {
  const out = []; let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) { out.push(buf); buf = ""; }
    buf += line + "\n";
  }
  if (buf.trim()) out.push(buf);
  return out;
}

async function send(text) {
  if (!TOKEN || !CHAT) {
    console.log("[dry-run，未設定 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID]\n" + text);
    return;
  }
  for (const chat of CHAT.split(",").map(s => s.trim()).filter(Boolean)) {
    for (const part of chunks(text)) {
      let ok = false;
      for (let k = 0; k < 3 && !ok; k++) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text: part, parse_mode: "HTML", disable_web_page_preview: true })
          });
          const j = await r.json();
          ok = j.ok;
          if (!ok) console.error("Telegram 錯誤：", j.description);
        } catch (e) { console.error("Telegram 連線失敗：", e.message); }
        if (!ok) await new Promise(r => setTimeout(r, 2000 * (k + 1)));
      }
      if (!ok) process.exitCode = 1;
    }
  }
}

module.exports = { send, esc };
