#!/usr/bin/env bash
#
# Chạy TRÊN VPS để deploy bản mới nhất của origin/main.
# GitHub Actions (.github/workflows/deploy.yml) SSH vào và gọi script này.
# Bạn cũng có thể chạy tay: bash scripts/deploy-vps.sh
#
# Cấu hình qua biến môi trường (đặt trong ~/.bashrc của VPS hoặc trước lệnh):
#   DEPLOY_BRANCH  nhánh cần deploy            (mặc định: main)
#   PM2_NAME       tên process pm2 của api     (mặc định: marketing-api)
#   WEB_ROOT       thư mục nginx serve frontend (vd: /var/www/marketing-plan-expert/public)
#                  nếu để trống thì nginx phải trỏ thẳng vào dist/public của repo
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
PM2_NAME="${PM2_NAME:-marketing-api}"
WEB_ROOT="${WEB_ROOT:-$APP_DIR/public}"

echo "▶ Deploy bắt đầu: $(date -Is) | branch=$BRANCH | dir=$APP_DIR"

# 1. Đồng bộ code với origin (VPS là bản sao của origin, không sửa tay trên VPS).
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# 2. Cài dependency đúng theo lockfile.
corepack enable >/dev/null 2>&1 || true
CI=true pnpm install --frozen-lockfile

# 3. Build api-server + frontend. Build TRƯỚC khi restart để nếu lỗi thì
#    server đang chạy vẫn còn nguyên (fail fast, không downtime oan).
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/marketing-platform run build

# 4. KHÔNG tự chạy DB migration (theo quy tắc dự án trong CLAUDE.md).
#    Nếu schema có thay đổi, tự chạy migration thủ công rồi deploy lại.
echo "ℹ Bỏ qua migration tự động. Nếu schema đổi, hãy chạy migration thủ công."

# 5. Restart API bằng pm2 (reload = gần như zero-downtime nếu đã chạy).
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi
pm2 save

# 6. Xuất bản frontend tĩnh cho nginx.
FRONTEND_DIST="$APP_DIR/artifacts/marketing-platform/dist/public"
if [ -n "$WEB_ROOT" ]; then
  mkdir -p "$WEB_ROOT"
  rsync -a --delete "$FRONTEND_DIST/" "$WEB_ROOT/"
  echo "✓ Frontend đã copy sang $WEB_ROOT"
else
  echo "ℹ WEB_ROOT chưa đặt — hãy trỏ nginx root vào: $FRONTEND_DIST"
fi

echo "✓ Deploy xong: $(date -Is)"
