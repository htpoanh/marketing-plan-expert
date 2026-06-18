# Deploy Guide — marketing-plan-expert (cho Antigravity)

> Bản chỉ dẫn TỰ CHỨA để một AI agent (Antigravity) thực thi việc deploy lên VPS.
> Đọc hết phần 0–2 trước khi chạy lệnh. Mọi lệnh chạy trên Ubuntu/Debian VPS trừ khi ghi rõ "(máy dev)".

---

## 0. Bối cảnh dự án

- **Repo:** `github.com/htpoanh/marketing-plan-expert`, nhánh deploy: `main`.
- **Stack:** pnpm workspaces · Node 24 · Express 5 (TS) · PostgreSQL + Drizzle · Vite + React.
  - Backend: `artifacts/api-server` → build ra `artifacts/api-server/dist/index.cjs` (chạy bằng pm2).
  - Frontend: `artifacts/marketing-platform` → build ra `artifacts/marketing-platform/dist/public` (tĩnh, nginx serve).
- **Hạ tầng:** VPS + pm2 + nginx + Let's Encrypt. UI tiếng Việt, nội dung khách hàng tiếng Đức.
- **AI:** Claude (Anthropic) phân tích/chiến lược/biên tập + trend (web search); Gemini viết content; OpenAI (GPT-4o) prompt ảnh + sinh ảnh. **KHÔNG còn Grok, KHÔNG còn Make.com.**

## 1. Mô hình deploy (đã có sẵn, KHÔNG cần tạo mới)

Deploy **tự động** qua GitHub Actions:
```
push lên main → .github/workflows/deploy.yml → SSH vào VPS → bash scripts/deploy-vps.sh
```
`scripts/deploy-vps.sh` làm: `git reset --hard origin/main` → `pnpm install --frozen-lockfile`
→ build api-server + frontend → `pm2 reload/start deploy/ecosystem.config.cjs` → `rsync` frontend sang `WEB_ROOT`.

> **deploy-vps.sh CỐ Ý KHÔNG chạy DB migration** (theo CLAUDE.md). Migration phải chạy tay (Phần A4).

## 2. Tình trạng hiện tại (đọc kỹ)

- ✅ Code mới nhất đã ở `origin/main` (build + 134 test đã pass; blocker build `vite PORT` đã sửa).
- ❌ Lần deploy gần nhất **FAILED** vì **GitHub secrets kết nối VPS đang TRỐNG** (`VPS_HOST/USER/PORT/APP_DIR` rỗng → SSH lỗi exit 255).
- ⇒ **Việc cần làm:** chuẩn bị VPS (Phần A) → đặt secrets (Phần B) → trigger lại + verify (Phần C).

---

## PHẦN A — Chuẩn bị VPS (làm 1 lần)

### A1. Cài system dependencies
```bash
sudo apt update
# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git postgresql nginx
sudo corepack enable                 # bật pnpm
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx
node -v && pnpm -v && pm2 -v && psql --version
```

### A2. Clone repo
```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/htpoanh/marketing-plan-expert.git
sudo chown -R "$USER" /var/www/marketing-plan-expert
cd /var/www/marketing-plan-expert
# Đường dẫn này = VPS_APP_DIR (dùng ở Phần B)
```

### A3. Tạo Postgres database + user
```bash
sudo -u postgres psql <<'SQL'
CREATE USER marketing WITH PASSWORD 'ĐỔI_MẬT_KHẨU_MẠNH';
CREATE DATABASE marketing_plan OWNER marketing;
GRANT ALL PRIVILEGES ON DATABASE marketing_plan TO marketing;
SQL
# Chuỗi kết nối (dùng ở .env.production + lệnh migrate):
#   postgresql://marketing:ĐỔI_MẬT_KHẨU_MẠNH@localhost:5432/marketing_plan
```

### A4. Tạo schema + dữ liệu nền
```bash
cd /var/www/marketing-plan-expert
pnpm install --frozen-lockfile
export DATABASE_URL="postgresql://marketing:ĐỔI_MẬT_KHẨU_MẠNH@localhost:5432/marketing_plan"

# --- DB MỚI HOÀN TOÀN: tạo toàn bộ schema 1 phát bằng Drizzle push ---
pnpm --filter @workspace/db run push     # tạo mọi bảng theo schema hiện tại

# --- HOẶC nếu là DB CŨ đã chạy phiên bản trước (đã có bảng nền + 0000/0001) ---
# chỉ áp các migration bổ sung, theo thứ tự, idempotent (IF NOT EXISTS):
for f in 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011; do
  psql "$DATABASE_URL" -f lib/db/migrations/${f}_*.sql
done

# Dữ liệu nền (brands, ai_agent_configs, ai_profiles...) — BẮT BUỘC để app có cửa hàng:
psql "$DATABASE_URL" -f artifacts/api-server/src/seed_data.sql

# (Tuỳ chọn) seed dữ liệu demo cho các trang v3.0 có nội dung mẫu:
# npx tsx scripts/seed-demo.ts
```
> Kiểm tra: `psql "$DATABASE_URL" -c "\dt"` phải thấy đủ bảng: `brands, reviews, content_plans,
> reply_queue, auto_reply_settings, strategy_inbox, trend_insights, brand_memory,
> market_intelligence, weekly_reports, ads_performance, kol_characters, scheduled_jobs, ...`

### A5. Tạo `deploy/.env.production` (KHÔNG commit — đã .gitignore)
```bash
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```
Điền (BẮT BUỘC để boot: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`):
```env
PORT=3001
DATABASE_URL=postgresql://marketing:ĐỔI_MẬT_KHẨU_MẠNH@localhost:5432/marketing_plan
SESSION_SECRET=<chuỗi ngẫu nhiên dài, vd: openssl rand -hex 32>
ADMIN_PASSWORD=<mật khẩu đăng nhập admin>

AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_ANTHROPIC_API_KEY=<key thật từ console.anthropic.com>   # Claude: trend, chiến lược, biên tập, auto-reply
AI_INTEGRATIONS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
AI_INTEGRATIONS_GEMINI_API_KEY=<key Google AI Studio>                    # viết content + keyword
OPENAI_API_KEY=<key thật từ platform.openai.com>                         # prompt ảnh + sinh ảnh
GOOGLE_API_KEY=<tuỳ chọn — Google Places, Market Research>

META_APP_SECRET=<App Secret Facebook — BẮT BUỘC nếu bật webhook auto-reply FB>
ALLOWED_ORIGINS=https://your-domain.de                                   # domain frontend; cùng domain qua nginx có thể để trống
OUTBOUND_WEBHOOK_URL=                                                     # tuỳ chọn
TELEGRAM_BOT_TOKEN=                                                       # tuỳ chọn — digest tuần
TELEGRAM_CHAT_ID=
```
> Lưu ý: "ChatGPT Plus" / "Claude Pro" KHÔNG dùng được — phải là **API key** (tính tiền theo lượt).

### A6. nginx + SSL
```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/marketing
sudo nano /etc/nginx/sites-available/marketing     # sửa server_name = domain thật; root = /var/www/marketing-plan-expert/public
sudo ln -sf /etc/nginx/sites-available/marketing /etc/nginx/sites-enabled/marketing
sudo mkdir -p /var/www/marketing-plan-expert/public   # WEB_ROOT (deploy script sẽ rsync frontend vào đây)
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.de -d www.your-domain.de   # Let's Encrypt tự thêm block 443
```

### A7. Tạo SSH deploy key cho CI (để GitHub Actions SSH vào VPS)
```bash
# Trên VPS: tạo key riêng cho CI, thêm public key vào authorized_keys
ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N "" -C "github-actions-deploy"
cat ~/.ssh/id_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# In ra PRIVATE key (dùng cho secret VPS_SSH_KEY ở Phần B) — GIỮ BÍ MẬT:
cat ~/.ssh/id_deploy
# known_hosts (dùng cho secret VPS_KNOWN_HOSTS):
ssh-keyscan -p 22 <IP_HOẶC_DOMAIN_VPS>
```

### A8. Khởi động pm2 lần đầu (kiểm tra app boot được)
```bash
cd /var/www/marketing-plan-expert
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/marketing-platform run build
rsync -a --delete artifacts/marketing-platform/dist/public/ /var/www/marketing-plan-expert/public/
pm2 start deploy/ecosystem.config.cjs && pm2 save
pm2 startup            # làm theo lệnh nó in ra để pm2 tự chạy lại khi reboot
curl -s localhost:3001/api/healthz     # kỳ vọng {"status":"ok"}
```

---

## PHẦN B — Cấu hình GitHub Actions secrets (máy dev hoặc bất kỳ, cần `gh` đã đăng nhập)

Đặt 6 secrets trong repo (`Settings → Secrets and variables → Actions`), hoặc:
```bash
gh secret set VPS_HOST       -b"<IP hoặc domain VPS>"
gh secret set VPS_USER       -b"<user SSH trên VPS>"
gh secret set VPS_PORT       -b"22"
gh secret set VPS_APP_DIR    -b"/var/www/marketing-plan-expert"
gh secret set VPS_SSH_KEY    < ~/.ssh/id_deploy                       # PRIVATE key từ A7
ssh-keyscan -p 22 <IP_VPS> | gh secret set VPS_KNOWN_HOSTS
```

---

## PHẦN C — Kích hoạt + nghiệm thu deploy

```bash
# Trigger deploy (máy dev):
gh workflow run "Deploy to VPS"
# Theo dõi:
gh run watch "$(gh run list --workflow='Deploy to VPS' --limit 1 --json databaseId -q '.[0].databaseId')"
```
Sau khi Action xanh, nghiệm thu:
```bash
pm2 status                                   # marketing-api = online
curl -s https://your-domain.de/api/healthz   # {"status":"ok"}
# Mở https://your-domain.de → đăng nhập admin / <ADMIN_PASSWORD>
```

---

## 3. Ràng buộc & lưu ý QUAN TRỌNG (đừng bỏ qua)

1. **Migration KHÔNG tự chạy** trong deploy. Mỗi khi có file `lib/db/migrations/*` mới → chạy tay (A4) TRƯỚC khi deploy.
2. **deploy-vps.sh `git reset --hard origin/main`** → mọi sửa tay trên VPS sẽ bị mất. Chỉ sửa qua git.
3. **`deploy/.env.production` nằm ngoài git** (.gitignore) — tạo + giữ trên VPS, không commit. pm2 đọc file này.
4. **Boot tối thiểu** cần `DATABASE_URL` + `SESSION_SECRET` + `ADMIN_PASSWORD`. Thiếu key AI thì app vẫn chạy nhưng tính năng AI báo lỗi.
5. **Webhook Facebook auto-reply**: handler `POST /api/messenger/webhook` đã bắt buộc verify chữ ký HMAC `X-Hub-Signature-256` bằng `META_APP_SECRET` (fail-closed). Khi đăng ký webhook trong Meta App: Callback URL = `https://your-domain.de/api/messenger/webhook`, verify_token = giá trị đặt trong bảng `messenger_configs`. Không có `META_APP_SECRET` → webhook trả 403.
6. **Build frontend KHÔNG cần PORT** (đã sửa); api-server build bằng tsx/esbuild.
7. Lockfile có `overrides` ghim binary nền tảng — cứ `pnpm install --frozen-lockfile` như deploy script, không tự sửa lockfile.

## 4. Checklist nghiệm thu cuối
- [ ] `gh run list` → Deploy to VPS = success
- [ ] `pm2 status` → marketing-api online, không restart loop
- [ ] `curl https://domain/api/healthz` → 200 `{"status":"ok"}`
- [ ] Đăng nhập web admin được
- [ ] `psql "$DATABASE_URL" -c "\dt"` đủ bảng v3.0
- [ ] HTTPS hoạt động (certbot ok)
- [ ] (Nếu dùng FB) webhook verify handshake OK + sự kiện ký HMAC được chấp nhận
```
