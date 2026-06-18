// Cấu hình pm2 cho API server.
// Đọc biến môi trường production từ deploy/.env.production (KHÔNG commit file này).
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const envPath = path.join(__dirname, ".env.production");

const env = { NODE_ENV: "production" };
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

module.exports = {
  apps: [
    {
      name: "marketing-api",
      script: path.join(root, "artifacts/api-server/dist/index.cjs"),
      cwd: root,
      instances: 1,
      exec_mode: "fork",
      env,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
