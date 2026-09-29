# 四檔看盤台 雲端版（GitHub Actions + Pages + Telegram）

聯鈞 3450｜上詮 3363｜中華化 1727｜華星光 4979

| 排程 | 台北時間 | 做什麼 |
|---|---|---|
| tw4-daily | 平日 18:30 | 抓 FinMind 日K／月營收／本益比／法人／融資券 → 更新網頁 → Telegram 盤後訊號 |
| tw4-intraday | 平日 09:00–13:45 每 15 分 | 即時價觸及進場／停損／目標價、或漲跌超過 5% → Telegram |

全程在 GitHub 伺服器執行，電腦不用開機；不經過 AI 模型，每次 1–3 分鐘跑完。

## 一次性設定（約 15 分鐘）

### 1. 建 Telegram Bot
1. Telegram 搜尋 **@BotFather** → `/newbot` → 取名 → 拿到 **Bot Token**（像 `7123456789:AAH...`）。
2. 對你的新 bot 按 Start、隨便傳一句話。
3. 瀏覽器開 `https://api.telegram.org/bot<你的Token>/getUpdates`，找 `"chat":{"id":123456789` → 這就是 **Chat ID**。
   - 想推到群組：把 bot 加進群組、在群組發一句話，再看 getUpdates，群組 ID 是負數（`-100...`）。
   - 多人：Chat ID 用逗號分隔 `123,456`。

### 2. 建 GitHub 儲存庫
1. GitHub → New repository（例：`tw4-monitor`）。要用免費 GitHub Pages 需設為 **Public**（內容只是公開行情；Token 放在 Secrets，不會外洩）。不需要網頁的話可設 Private，Telegram 照常運作。
2. 把本資料夾所有檔案上傳（含隱藏的 `.github` 資料夾）。網頁上傳會漏掉 `.github`，建議用：
   ```
   git init && git add . && git commit -m init
   git branch -M main
   git remote add origin https://github.com/<帳號>/tw4-monitor.git
   git push -u origin main
   ```

### 3. 設定 Secrets / Variables
Settings → Secrets and variables → Actions：
- **Secrets**：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、（選填）`FINMIND_TOKEN`（finmindtrade.com 免費註冊，額度較高）
- **Variables**（選填）：
  - `PAGES_URL` = `https://<帳號>.github.io/tw4-monitor/`（訊息底部附連結）
  - `NOTIFY_MODE` = `daily`（每天摘要，預設）或 `changes`（只在訊號變化時推）
  - `MOVE_ALERT_PCT` = `5`（盤中漲跌幅提醒門檻）

### 4. 開權限與網頁
- Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save
- Settings → Pages → Source：Deploy from a branch → `main` / `/docs` → Save

### 5. 測試
Actions → **tw4-daily** → Run workflow。1–3 分鐘後 Telegram 應收到盤後訊號，網頁也會有 K 線。
手動執行會強制推播；排程執行遇休市（資料日期沒變）會自動略過。

## 檔案
```
.github/workflows/daily.yml     盤後排程
.github/workflows/intraday.yml  盤中觸價
docs/index.html                 儀表板（GitHub Pages）
docs/engine.js                  訊號引擎（網頁與推播共用，改規則只改這裡）
scripts/tw4_collector.py        資料收集（FinMind，股價備援 yfinance）
scripts/notify.js               盤後訊號與推播
scripts/intraday.js             盤中觸價（TWSE MIS，備援 Yahoo）
scripts/tg.js                   Telegram 發送
```

## 加減股票
改 `scripts/tw4_collector.py` 的 `STOCKS`；網頁研究筆記在 `docs/index.html` 的 `NOTES` 與 `CODES`。

## 注意
- GitHub 排程可能延遲 5–15 分鐘，盤中提醒不適合當沖。
- 儲存庫 60 天沒有任何 commit 時 GitHub 會停用排程；本流程每天會自動 commit 資料，不會觸發。
- 訊號為紀律化輔助，不構成投資建議；放空前確認可融券並避開停券期。
