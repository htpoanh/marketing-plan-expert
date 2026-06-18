# PROJECT STATUS — marketing-plan-expert

> File "đừng quên": tóm tắt việc ĐÃ làm + việc CÒN phải làm + lưu ý vận hành.
> Cập nhật mỗi khi có thay đổi lớn. Mới nhất ở trên cùng.

---

## 📌 CÒN PHẢI LÀM (chưa xong — quan trọng)

### Deploy lên VPS (chưa chạy được)
- [ ] **Đặt 6 GitHub secrets** cho CI: `VPS_HOST, VPS_USER, VPS_PORT, VPS_APP_DIR, VPS_SSH_KEY, VPS_KNOWN_HOSTS`
      (lần deploy gần nhất FAIL vì các secret này TRỐNG → SSH exit 255).
- [ ] **Chuẩn bị VPS** theo `DEPLOY_GUIDE.md` Phần A: cài deps, clone repo, tạo DB, tạo schema, `deploy/.env.production`, nginx+SSL, SSH deploy key.
- [ ] **Chạy migration tay** trên DB production: `0002`→`0011` (DB cũ) hoặc `pnpm --filter @workspace/db run push` (DB mới). Deploy KHÔNG tự chạy migration.
- [ ] **Điền API key thật** vào `deploy/.env.production`: Anthropic (console.anthropic.com), OpenAI (platform.openai.com), Gemini (Google AI Studio). Lưu ý: ChatGPT Plus / Claude Pro KHÔNG dùng được — phải là API key.
- [ ] **`META_APP_SECRET`** bắt buộc nếu bật webhook auto-reply Facebook (verify HMAC, fail-closed 403).
- [ ] Sau khi xong: `gh workflow run "Deploy to VPS"` rồi nghiệm thu (checklist trong DEPLOY_GUIDE.md).
- 👉 Chỉ dẫn chi tiết đầy đủ: **`DEPLOY_GUIDE.md`** (tự chứa, đưa cho Antigravity chạy được).

### Bảo mật cần xử lý
- [ ] **`.claude/launch.json` chứa key Gemini THẬT** (đã track trong git từ commit cũ). Nên **rotate key** đó + đưa ra ngoài env. Repo public-ish trên GitHub.

---

## ✅ ĐÃ LÀM — phiên 2026-06-18

1. **Gỡ Grok/xAI hoàn toàn** → Claude đảm nhận trend (M4) qua Web Search. Xóa package `lib/integrations-xai`, dọn pipeline/automation, đổi nhãn UI, đổi định danh nội bộ `agentKey: grok → trend` (DB + seed + code + frontend). Sạch 100%.
2. **Link booking trong DM bot Facebook**: bot tự gửi link đặt lịch khi khách muốn đặt (lưu ở `brands.ads_context.bookingUrl`); thêm ô nhập trong UI "Cấu hình Bot" (Messenger). Link Paradise Nails: `https://booking1.paradise-nail-studio.de` đã set cho 7 brand nail.
3. **Cron `review_sync`** (mới): tự đồng bộ review Google mỗi 6h, độc lập với auto-reply (disabled mặc định). Migration `0011_review_sync.sql`.
4. **Bảo mật webhook Meta**: verify chữ ký HMAC `X-Hub-Signature-256` (`META_APP_SECRET`, fail-closed) trên `POST /api/messenger/webhook`; webhook mở public + chặn bằng chữ ký. (Audit bảo mật: không tìm thấy lỗ hổng khai thác cao; guards chống prompt-injection đã test đạt.)
5. **Gỡ Make.com hoàn toàn**: xóa `/process-make`, đổi `MAKE_WEBHOOK_URL → OUTBOUND_WEBHOOK_URL` (webhook chung trung tính), xóa endpoint blueprint, gỡ UI Make. → Dùng webhook trực tiếp (Meta) + Metricool trực tiếp. KHÔNG cần n8n/Make.
6. **Claude dẫn dắt pipeline**: Agent 1 (phân tích trend) + Agent 2 (chiến lược) → Claude Sonnet. Phương châm: **phân tích trước → chiến lược → viết → polish**.
7. **Sửa blocker build deploy**: `vite.config.ts` không còn throw khi thiếu `PORT` (chỉ dev server cần).
8. **Đã commit + push** 4 commit lên `origin/main` (đồng bộ). Typecheck toàn bộ + 134/134 test pass.

---

## 🧠 Tham chiếu nhanh — vai trò AI (pipeline content)

| Bước | Model | Ghi chú |
|---|---|---|
| 1. Phân tích xu hướng (Agent 1) | **Claude Sonnet** | + web search cho M4 Trend |
| 2. Lập chiến lược (Agent 2) | **Claude Sonnet** | chọn mô hình AIDA/PAS… |
| 3. Viết nội dung (Agent 3) | **Gemini Flash** | rẻ + nhanh; giữ nguyên (quyết định 2026-06-18) |
| 4. Prompt ảnh (Agent 4) + sinh ảnh | **GPT-4o / dalle3 / gpt-image-1** | OpenAI |
| 5. Biên tập cuối (Agent 5) | **Claude Sonnet** | polish tiếng Đức |
| Auto-reply review/comment | **Claude** (+ Haiku phân loại) | guards chặn hứa tiền/giảm giá |
| M2 Keyword | **Gemini Flash** | |

## ⚙️ Tham chiếu nhanh — deploy

- Cơ chế: push `main` → GitHub Actions (`.github/workflows/deploy.yml`) → SSH VPS → `scripts/deploy-vps.sh`.
- `deploy-vps.sh`: git reset hard → `pnpm install --frozen-lockfile` → build api-server + frontend → pm2 reload → rsync frontend.
- pm2 đọc env từ `deploy/.env.production` (ngoài git). Boot tối thiểu: `DATABASE_URL` + `SESSION_SECRET` + `ADMIN_PASSWORD`.
- nginx serve `…/public`, proxy `/api` → `127.0.0.1:3001`.
- **Migration KHÔNG tự chạy** — luôn chạy tay trước deploy nếu schema đổi.
