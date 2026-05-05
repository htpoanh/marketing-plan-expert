/**
 * Phase 5a — UI for the weekly trend digest cron job.
 *
 * Lives as a 4th tab on the existing /automation page. Uses plain fetch
 * (consistent with the rest of automation UI, which doesn't go through
 * the OpenAPI codegen because these are internal admin endpoints).
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Play,
  Power,
  PowerOff,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  CalendarClock,
  Coins,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const JOB_KEY = "weekly_trend_digest";

type ScheduledJob = {
  id: number;
  jobKey: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type ScheduledRun = {
  id: number;
  jobKey: string;
  status: "running" | "success" | "partial" | "failed";
  trigger: "cron" | "manual";
  summary: Record<string, unknown> | null;
  payload: string | null;
  totalCostEur: string | null;
  brandsProcessed: number;
  brandsFailed: number;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

const STATUS_BADGE: Record<ScheduledRun["status"], string> = {
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const STATUS_ICON: Record<ScheduledRun["status"], typeof Loader2> = {
  running: Loader2,
  success: CheckCircle2,
  partial: AlertTriangle,
  failed: XCircle,
};

export function TrendDigestPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

  // Catalog fetch
  const jobsQuery = useQuery({
    queryKey: ["scheduled-jobs"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/automation/scheduled-jobs`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Load failed: ${r.status}`);
      return (await r.json()) as ScheduledJob[];
    },
  });
  const job = jobsQuery.data?.find((j) => j.jobKey === JOB_KEY);

  // Runs fetch — refresh every 5s while a 'running' row is on top
  const runsQuery = useQuery({
    queryKey: ["scheduled-runs", JOB_KEY],
    queryFn: async () => {
      const r = await fetch(
        `${BASE}/api/automation/scheduled-runs?jobKey=${encodeURIComponent(JOB_KEY)}&limit=10`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(`Load failed: ${r.status}`);
      return (await r.json()) as ScheduledRun[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as ScheduledRun[] | undefined;
      const hasRunning = data?.some((r) => r.status === "running") ?? false;
      return hasRunning ? 3000 : false;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await fetch(
        `${BASE}/api/automation/scheduled-jobs/${JOB_KEY}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ enabled }),
        },
      );
      if (!r.ok) throw new Error(`Toggle failed: ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast({ title: "Đã cập nhật scheduler" });
    },
    onError: (e) =>
      toast({
        title: "Cập nhật thất bại",
        description: (e as Error).message,
        variant: "destructive",
      }),
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(
        `${BASE}/api/automation/scheduled-jobs/${JOB_KEY}/trigger`,
        { method: "POST", credentials: "include" },
      );
      if (!r.ok) throw new Error(`Trigger failed: ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "🚀 Đã trigger digest",
        description: "Job đang chạy. Kết quả xuất hiện ở bảng dưới sau ~30-60s.",
      });
      // Poll runs immediately
      qc.invalidateQueries({ queryKey: ["scheduled-runs", JOB_KEY] });
    },
    onError: (e) =>
      toast({
        title: "Trigger thất bại",
        description: (e as Error).message,
        variant: "destructive",
      }),
  });

  // Light auto-refresh of runs whenever the trigger mutation completes
  useEffect(() => {
    if (!triggerMutation.isSuccess) return undefined;
    const t = setTimeout(
      () => qc.invalidateQueries({ queryKey: ["scheduled-runs", JOB_KEY] }),
      2000,
    );
    return () => clearTimeout(t);
  }, [triggerMutation.isSuccess, qc]);

  if (jobsQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }
  if (!job) {
    return (
      <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5 text-sm">
        <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-400" />
        Chưa có job <code className="font-mono text-xs">weekly_trend_digest</code> trong DB.
        Migration <code className="font-mono text-xs">0001_scheduled_jobs.sql</code> chưa apply?
      </div>
    );
  }

  const runs = runsQuery.data ?? [];
  const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : null;
  const lastRunAge = lastRun
    ? Math.round((Date.now() - lastRun.getTime()) / (60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-4" data-testid="trend-digest-panel">
      {/* Hero card */}
      <div className="border border-border/50 bg-gradient-to-br from-rose-500/5 to-violet-500/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-5 h-5 text-rose-400" />
              <h3 className="font-semibold text-base">{job.name}</h3>
              <Badge
                variant="outline"
                className={
                  job.enabled
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-secondary text-muted-foreground"
                }
              >
                {job.enabled ? "ON" : "OFF"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Cron: <code className="font-mono">{job.cronExpression}</code>{" "}
              (Europe/Berlin) • Mỗi sáng Chủ Nhật quét trend cho mọi brand có{" "}
              <code className="font-mono">primaryRegions</code> set.
            </p>
            {lastRun && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Lần chạy gần nhất: {lastRun.toLocaleString("de-DE")} (
                {lastRunAge != null && lastRunAge < 24
                  ? `${lastRunAge}h ago`
                  : lastRunAge != null
                    ? `${Math.round(lastRunAge / 24)}d ago`
                    : "vừa xong"})
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => toggleMutation.mutate(!job.enabled)}
              disabled={toggleMutation.isPending}
              variant={job.enabled ? "outline" : "default"}
              data-testid="trend-digest-toggle"
            >
              {toggleMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : job.enabled ? (
                <PowerOff className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Power className="w-3.5 h-3.5 mr-1.5" />
              )}
              {job.enabled ? "Tắt" : "Bật"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              data-testid="trend-digest-run-now"
            >
              {triggerMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              Chạy thử
            </Button>
          </div>
        </div>

        {/* Delivery target */}
        <div className="text-[11px] text-muted-foreground border-l-2 border-violet-500/40 pl-3 py-1">
          <Send className="w-3 h-3 inline mr-1.5" />
          Đích đến: tự động chọn theo env —{" "}
          <code className="font-mono">TELEGRAM_BOT_TOKEN</code> + chat ID nếu có,
          không thì <code className="font-mono">MAKE_WEBHOOK_URL</code>, không thì
          chỉ log + lưu payload.
        </div>
      </div>

      {/* Recent runs */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground">
          Lịch sử chạy ({runs.length})
        </h4>
        {runsQuery.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : runs.length === 0 ? (
          <div className="border border-dashed border-border/50 rounded-xl p-6 text-center text-xs text-muted-foreground">
            Chưa có lần chạy nào. Bấm "Chạy thử" để test.
          </div>
        ) : (
          <div className="space-y-1.5">
            {runs.map((r) => {
              const StatusIcon = STATUS_ICON[r.status];
              const isOpen = expandedRunId === r.id;
              return (
                <div
                  key={r.id}
                  className="border border-border/50 rounded-lg bg-card overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedRunId(isOpen ? null : r.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase gap-1 ${STATUS_BADGE[r.status]}`}
                    >
                      <StatusIcon
                        className={`w-3 h-3 ${r.status === "running" ? "animate-spin" : ""}`}
                      />
                      {r.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px]">
                      {r.trigger}
                    </Badge>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-mono text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString("de-DE")}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px]">
                        <span>
                          Brands:{" "}
                          <strong className="text-emerald-400">
                            {r.brandsProcessed}
                          </strong>
                          {r.brandsFailed > 0 && (
                            <span className="text-rose-400 ml-0.5">
                              {" "}
                              / fail {r.brandsFailed}
                            </span>
                          )}
                        </span>
                        {r.totalCostEur && (
                          <span>
                            <Coins className="w-2.5 h-2.5 inline mr-0.5" />
                            €{r.totalCostEur}
                          </span>
                        )}
                        {r.durationMs != null && (
                          <span>
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {(r.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 p-3 bg-secondary/30 space-y-2 text-xs">
                      {r.errorMessage && (
                        <div className="text-rose-400 font-mono whitespace-pre-wrap">
                          {r.errorMessage}
                        </div>
                      )}
                      {r.payload && (
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                            Telegram message preview
                          </div>
                          <pre className="font-mono whitespace-pre-wrap bg-card p-2 rounded max-h-72 overflow-y-auto border border-border/40">
                            {r.payload}
                          </pre>
                        </div>
                      )}
                      {r.summary && (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px] uppercase font-semibold">
                            Raw summary JSON
                          </summary>
                          <pre className="font-mono whitespace-pre-wrap bg-card p-2 rounded mt-1 max-h-60 overflow-y-auto text-[10px] border border-border/40">
                            {JSON.stringify(r.summary, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
