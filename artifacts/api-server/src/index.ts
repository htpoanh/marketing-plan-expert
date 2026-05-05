import app from "./app";
import { startScheduler } from "./jobs/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  // Cron jobs boot AFTER the HTTP server is listening so health checks
  // succeed even if the scheduler later fails (e.g. table missing). The
  // scheduler swallows its own errors so this never crashes the app.
  startScheduler().catch((e) => {
    console.error("[index] scheduler bootstrap failed:", e);
  });
});
