import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap, Play, CheckCircle, XCircle, Clock, Webhook,
  ChevronRight, Info, Loader2, RefreshCw, Copy,
  ExternalLink, Check, Download, Settings, Link2, FileText,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CONTENT_TYPES = [
  { id: "post", label: "Post", icon: "📸", desc: "Ảnh + caption đầy đủ" },
  { id: "reel", label: "Reel / TikTok", icon: "🎬", desc: "Script video 15-60s" },
  { id: "story", label: "Story", icon: "⚡", desc: "Story 24h, 3 slides" },
];

const PLATFORMS = [
  { id: "Facebook", label: "Facebook", color: "bg-blue-500" },
  { id: "Instagram", label: "Instagram", color: "bg-pink-500" },
  { id: "TikTok", label: "TikTok", color: "bg-gray-800" },
];

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-primary" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Chưa chạy</span>;
  if (status === "success") return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="w-3 h-3" />Thành công</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle className="w-3 h-3" />Lỗi</span>;
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

interface BrandSettings {
  brand: {
    id: number; brandName: string; industry: string; branchLocation: string;
    targetAudience: string; brandVoice: string;
  };
  settings: {
    id: number; brandId: number; isEnabled: boolean; platforms: string;
    contentTypes: string; runHour: number; autoApprove: boolean;
    topicMode: string; customGoal: string | null;
    metricoolAccountId: string | null; metricoolToken: string | null;
    lastRunAt: string | null; lastRunStatus: string | null; lastRunSummary: string | null;
  } | null;
}

interface AutomationLog {
  id: number; brandId: number; brandName: string;
  runAt: string; status: string; plansCreated: number;
  webhookSent: boolean; webhookStatus: string | null; webhookError: string | null;
  errorMessage: string | null;
  details: { trendTopic?: string; summary?: string; contentIds?: number[] } | null;
}

function BrandAutomationCard({ item, onSave, onRunNow, onRunTest }: {
  item: BrandSettings;
  onSave: (brandId: number, settings: any) => void;
  onRunNow: (brandId: number) => void;
  onRunTest: (brandId: number, settings: any) => Promise<void>;
}) {
  const { brand, settings } = item;
  const [local, setLocal] = useState({
    isEnabled: settings?.isEnabled ?? false,
    platforms: settings?.platforms ?? "Facebook,Instagram",
    contentTypes: settings?.contentTypes ?? "post,reel,story",
    runHour: settings?.runHour ?? 17,
    autoApprove: settings?.autoApprove ?? false,
    topicMode: settings?.topicMode ?? "auto",
    customGoal: settings?.customGoal ?? "",
    metricoolAccountId: settings?.metricoolAccountId ?? "",
    metricoolToken: settings?.metricoolToken ?? "",
  });
  const [showToken, setShowToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pingingMetricool, setPingingMetricool] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);
  const [fetchingBrands, setFetchingBrands] = useState(false);
  const [mcBrands, setMcBrands] = useState<{ id: number; label: string; facebook: string | null }[] | null>(null);

  const toggleContentType = (ct: string) => {
    const current = local.contentTypes.split(",").filter(Boolean);
    const updated = current.includes(ct) ? current.filter(c => c !== ct) : [...current, ct];
    setLocal(p => ({ ...p, contentTypes: updated.join(",") }));
    setDirty(true);
  };

  const togglePlatform = (pl: string) => {
    const current = local.platforms.split(",").filter(Boolean);
    const updated = current.includes(pl) ? current.filter(p => p !== pl) : [...current, pl];
    setLocal(p => ({ ...p, platforms: updated.join(",") }));
    setDirty(true);
  };

  const selectedCTs = local.contentTypes.split(",").filter(Boolean);
  const selectedPLs = local.platforms.split(",").filter(Boolean);
  const postsPerDay = selectedCTs.length * selectedPLs.length;

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 ${local.isEnabled ? "border-primary/30 bg-primary/3 shadow-sm shadow-primary/10" : "border-border bg-white"}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-violet-100 flex items-center justify-center font-bold text-primary text-lg shadow-sm">
            {brand.brandName.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-foreground">{brand.brandName}</p>
            <p className="text-xs text-muted-foreground">{brand.industry} · {brand.branchLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settings?.lastRunStatus && <StatusBadge status={settings.lastRunStatus} />}
          <ToggleSwitch value={local.isEnabled} onChange={(v) => { setLocal(p => ({ ...p, isEnabled: v })); setDirty(true); }} />
        </div>
      </div>

      {local.isEnabled && (
        <div className="px-5 pb-5 space-y-5 border-t border-border/50 pt-4">
          {/* Content types */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Loại nội dung / ngày</p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map(ct => {
                const active = selectedCTs.includes(ct.id);
                return (
                  <button
                    key={ct.id}
                    onClick={() => toggleContentType(ct.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${active ? "border-primary bg-primary/8 text-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-white"}`}
                  >
                    <span>{ct.icon}</span>
                    <div className="text-left">
                      <p className="font-semibold text-xs leading-none">{ct.label}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{ct.desc}</p>
                    </div>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nền tảng đăng</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map(pl => {
                const active = selectedPLs.includes(pl.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => togglePlatform(pl.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${active ? "border-primary bg-primary/8 text-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 bg-white"}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${pl.color}`} />
                    {pl.label}
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour + Auto approve */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Giờ chạy hàng ngày</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={23}
                  value={local.runHour}
                  onChange={e => { setLocal(p => ({ ...p, runHour: parseInt(e.target.value) || 17 })); setDirty(true); }}
                  className="w-20 px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-sm text-muted-foreground">:00</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tự phê duyệt</label>
              <div className="flex items-center gap-2 pt-1">
                <ToggleSwitch value={local.autoApprove} onChange={(v) => { setLocal(p => ({ ...p, autoApprove: v })); setDirty(true); }} />
                <span className="text-xs text-muted-foreground">{local.autoApprove ? "Bỏ qua phê duyệt → gửi thẳng Metricool" : "Vào hàng chờ phê duyệt"}</span>
              </div>
            </div>
          </div>

          {/* Custom goal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mục tiêu cố định (tùy chọn)</label>
            <input
              type="text"
              value={local.customGoal}
              onChange={e => { setLocal(p => ({ ...p, customGoal: e.target.value })); setDirty(true); }}
              placeholder="VD: Tăng khách walk-in buổi trưa — nếu trống, AI tự chọn mục tiêu theo ngày"
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Metricool */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-600 text-[10px] font-bold">M</span>
              Metricool — Tài khoản đăng bài
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">User ID (Account ID trong Metricool)</label>
                <input
                  type="text"
                  value={local.metricoolAccountId}
                  onChange={e => { setLocal(p => ({ ...p, metricoolAccountId: e.target.value })); setDirty(true); }}
                  placeholder="VD: 4371661"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">API Token (Bearer token Metricool)</label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={local.metricoolToken}
                    onChange={e => { setLocal(p => ({ ...p, metricoolToken: e.target.value })); setDirty(true); }}
                    placeholder="Lấy từ Metricool → Settings → API → Generate token"
                    className="w-full px-3 py-2 pr-20 rounded-xl bg-white border border-blue-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-muted-foreground/40"
                  />
                  <button type="button" onClick={() => setShowToken(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
                    {showToken ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-600/80">
              <Info className="w-3.5 h-3.5 inline mr-1" />
              Mỗi tiệm có thể đăng vào fanpage riêng. Tìm Blog ID tại{" "}
              <a href="https://app.metricool.com" target="_blank" rel="noreferrer" className="underline font-medium">app.metricool.com</a> → Settings → My account.
            </p>
            <button
              onClick={async () => {
                if (!local.metricoolToken) { setPingResult({ ok: false, message: "Hãy nhập API Token trước!" }); return; }
                setFetchingBrands(true); setMcBrands(null);
                try {
                  const uid = local.metricoolAccountId || "0";
                  const r = await fetch(`${BASE}/api/automation/metricool-brands?userId=${uid}&token=${encodeURIComponent(local.metricoolToken)}`);
                  const data = await r.json();
                  if (data.ok) setMcBrands(data.brands);
                  else setPingResult({ ok: false, message: `❌ ${data.error}` });
                } catch (e: any) {
                  setPingResult({ ok: false, message: `❌ ${e.message}` });
                } finally { setFetchingBrands(false); }
              }}
              disabled={fetchingBrands}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100 text-blue-600 text-xs font-medium transition-colors disabled:opacity-50 bg-white"
            >
              {fetchingBrands ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>🔍</span>}
              {fetchingBrands ? "Đang tải..." : "Xem danh sách brands Metricool"}
            </button>
            {mcBrands && (
              <div className="border border-blue-200 rounded-xl overflow-hidden text-xs bg-white">
                <p className="px-3 py-2 bg-blue-50 text-blue-700 font-semibold">Chọn brand → tự điền Brand ID:</p>
                {mcBrands.map(b => (
                  <button key={b.id} onClick={() => { setLocal(p => ({ ...p, metricoolAccountId: String(b.id) })); setDirty(true); setMcBrands(null); }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 text-left border-t border-blue-100 transition-colors">
                    <span className="font-medium text-foreground">{b.label}</span>
                    <span className="font-mono text-muted-foreground">{b.id}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={async () => {
                if (!local.metricoolAccountId) { setPingResult({ ok: false, message: "Hãy nhập Blog ID trước!" }); return; }
                if (!local.metricoolToken) { setPingResult({ ok: false, message: "Hãy nhập API Token trước!" }); return; }
                setPingingMetricool(true); setPingResult(null);
                try {
                  const r = await fetch(`${BASE}/api/automation/test-metricool/${brand.id}`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blogId: local.metricoolAccountId, metricoolToken: local.metricoolToken }),
                  });
                  const data = await r.json();
                  if (data.ok) {
                    setPingResult({ ok: true, message: `✅ Metricool nhận bài thành công! Post đã vào hàng đợi lên lịch.`, detail: JSON.stringify(data.metricoolResponse, null, 2) });
                  } else {
                    const errMsg = data.hint ?? data.error ?? `HTTP ${data.status}`;
                    setPingResult({ ok: false, message: `❌ HTTP ${data.status}: ${errMsg}`, detail: data.hint ? undefined : JSON.stringify(data.metricoolResponse ?? data, null, 2) });
                  }
                } catch (e: any) {
                  setPingResult({ ok: false, message: `❌ Lỗi kết nối: ${e.message}` });
                } finally { setPingingMetricool(false); }
              }}
              disabled={pingingMetricool}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-300 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 w-full justify-center"
            >
              {pingingMetricool ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>🔌</span>}
              {pingingMetricool ? "Đang kết nối Metricool..." : "Ping trực tiếp Metricool (bypass Make.com)"}
            </button>
            {pingResult && (
              <div className={`p-3 rounded-xl border text-xs ${pingResult.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                <p className="font-medium">{pingResult.message}</p>
                {pingResult.detail && <pre className="mt-2 text-[10px] opacity-70 overflow-x-auto whitespace-pre-wrap">{pingResult.detail}</pre>}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-3 bg-secondary rounded-xl flex items-center justify-between border border-border">
            <span className="text-xs text-muted-foreground">
              Mỗi ngày AI sẽ tạo <strong className="text-foreground">{postsPerDay} bài</strong> cho tiệm này
              {settings?.lastRunAt && <span> · Lần cuối: {format(new Date(settings.lastRunAt), "dd/MM HH:mm")}</span>}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <button onClick={() => { onSave(brand.id, local); setDirty(false); }}
                className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                Lưu cài đặt
              </button>
            )}
            <button
              onClick={async () => {
                setTesting(true); setTestResult(null);
                if (dirty) { onSave(brand.id, local); setDirty(false); }
                try {
                  await onRunTest(brand.id, local);
                  const method = local.metricoolToken ? "trực tiếp vào Metricool" : "tới Make.com → Metricool";
                  setTestResult({ ok: true, message: `✅ Đã tạo 1 bài Facebook Post và gửi ${method}! Kiểm tra trong Metricool Planner.` });
                } catch (e: any) {
                  setTestResult({ ok: false, message: e.message });
                } finally { setTesting(false); }
              }}
              disabled={testing || running}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {testing ? "Đang gửi 1 bài..." : "🧪 Chạy thử 1 bài"}
            </button>
            <button
              onClick={async () => { setRunning(true); await onRunNow(brand.id); setRunning(false); }}
              disabled={running || testing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 bg-primary/8 hover:bg-primary/15 text-primary text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {running ? "Đang chạy..." : "Chạy hết (9 bài)"}
            </button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${testResult.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <p>{testResult.message}</p>
            </div>
          )}

          {settings?.lastRunSummary && (
            <p className="text-xs text-muted-foreground bg-secondary px-3 py-2 rounded-lg border border-border">{settings.lastRunSummary}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Logs Panel ──────────────────────────────────────────────────────────── */
function LogsPanel({ logs, refetchLogs }: { logs: AutomationLog[]; refetchLogs: () => void }) {
  const queryClient = useQueryClient();
  const brandNames = Array.from(new Set(logs.map(l => l.brandName))).sort();
  const [activeBrand, setActiveBrand] = useState<string>("all");

  const filtered = activeBrand === "all" ? logs : logs.filter(l => l.brandName === activeBrand);

  const countFor = (name: string) => logs.filter(l => l.brandName === name).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Nhật ký tự động hóa
        </h2>
        <button
          onClick={() => { refetchLogs(); queryClient.invalidateQueries({ queryKey: ["automation-logs"] }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-colors bg-white"
        >
          <RefreshCw className="w-3 h-3" /> Làm mới
        </button>
      </div>

      {/* Brand sub-tabs */}
      {brandNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveBrand("all")}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${activeBrand === "all" ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border hover:border-primary/30"}`}
          >
            Tất cả
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeBrand === "all" ? "bg-white/20" : "bg-muted"}`}>{logs.length}</span>
          </button>
          {brandNames.map(name => (
            <button
              key={name}
              onClick={() => setActiveBrand(name)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border truncate max-w-[180px] ${activeBrand === name ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border hover:border-primary/30"}`}
            >
              {name}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeBrand === name ? "bg-white/20" : "bg-muted"}`}>{countFor(name)}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-border">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Chưa có lịch sử chạy nào.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Nhấn "Chạy ngay" để tạo nhật ký đầu tiên.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thời gian</th>
                {activeBrand === "all" && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cửa hàng</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trạng thái</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bài tạo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Make.com</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chủ đề</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.runAt), "dd/MM HH:mm")}
                  </td>
                  {activeBrand === "all" && (
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {log.brandName.charAt(0)}
                        </span>
                        <span className="text-sm truncate max-w-[120px]">{log.brandName}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {log.status === "success" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />Thành công
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-600 text-xs font-medium" title={log.errorMessage ?? ""}>
                        <XCircle className="w-3 h-3" />Lỗi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${log.plansCreated > 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {log.plansCreated}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!log.webhookSent ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : log.webhookStatus === "success" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3 h-3" />Đã gửi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium" title={log.webhookError ?? ""}>
                        <XCircle className="w-3 h-3" />Thất bại
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={log.details?.trendTopic ?? ""}>
                    {log.details?.trendTopic ?? log.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Connections Panel ───────────────────────────────────────────────────── */
function ConnectionsPanel() {
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const apiUrl = `${window.location.origin}${BASE}/api/automation/run`;

  const copyUrl = () => {
    navigator.clipboard.writeText(apiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true); setWebhookResult(null);
    try {
      const r = await fetch(`${BASE}/api/automation/test-webhook`, { method: "POST" });
      const d = await r.json();
      setWebhookResult(d);
    } catch {
      setWebhookResult({ ok: false, message: "Không kết nối được server" });
    } finally { setTestingWebhook(false); }
  };

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Step 1: Make.com webhook trigger */}
      <div className="p-5 bg-white rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">1</div>
          <div>
            <p className="font-bold text-foreground">Make.com — Tạo Scenario tự động hàng ngày</p>
            <p className="text-xs text-muted-foreground mt-0.5">Make.com gọi vào API của bạn mỗi ngày lúc 17:00</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { step: "a", text: "Vào Make.com → tạo Scenario mới" },
            { step: "b", text: "Module đầu tiên: \"Schedule\" → Interval: Daily → Time: 17:00 (giờ Đức)" },
            { step: "c", text: "Module thứ hai: \"HTTP → Make a request\"" },
            { step: "d", text: "URL: dán URL bên dưới vào → Method: POST → Body type: Raw → Content type: JSON" },
            { step: "e", text: "Body: {\"secret\": \"your_secret\"} (tùy chọn, thêm bảo mật)" },
            { step: "f", text: "Bật Scenario → Done!" },
          ].map(item => (
            <div key={item.step} className="flex gap-2.5 text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{item.step.toUpperCase()}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3 bg-secondary rounded-xl border border-border">
          <code className="flex-1 text-xs font-mono text-primary break-all">{apiUrl}</code>
          <button onClick={copyUrl} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Đã copy!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Blueprint Download */}
      <div className="p-5 bg-gradient-to-r from-orange-50 to-violet-50 rounded-2xl border border-orange-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-foreground">Tải Blueprint Make.com — Import 1 click</p>
              <p className="text-xs text-muted-foreground mt-0.5">File JSON sẵn sàng — không cần cài đặt thủ công</p>
            </div>
          </div>
          <a
            href={`${BASE}/api/automation/blueprint`}
            download="ai-marketing-make-blueprint.json"
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Tải Blueprint
          </a>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-sm">Sau khi tải, import vào Make.com:</p>
          {[
            "Vào Make.com → My Scenarios → dấu \"...\" → Import Blueprint",
            "Chọn file vừa tải → Make.com tự tạo Scenario với 3 modules sẵn",
            "Module 1: Custom Webhook (tự động tạo URL mới → copy URL → dán vào Replit Secrets: MAKE_WEBHOOK_URL)",
            "Module 3: Thay REPLACE_WITH_METRICOOL_API_TOKEN bằng token Metricool của bạn",
            "Bật Scenario → Done! Mỗi ngày AI chạy tự động lúc 17:00",
          ].map((text, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3 bg-white/70 rounded-xl border border-orange-200">
          <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Blueprint chứa sẵn: <span className="text-foreground font-medium">Webhook trigger → Iterator → HTTP to Metricool</span> — chỉ cần thay token Metricool và URL webhook mới.
          </p>
        </div>
      </div>

      {/* Step 2: Make.com → Metricool */}
      <div className="p-5 bg-white rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm">2</div>
          <div>
            <p className="font-bold text-foreground">Make.com → Metricool — Lên lịch đăng bài</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sau khi AI tạo content, Make.com gửi sang Metricool tự động</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { step: "a", text: "Trong Scenario, sau module HTTP, thêm module \"Metricool → Create Publication\"" },
            { step: "b", text: "Kết nối tài khoản Metricool (đăng nhập một lần)" },
            { step: "c", text: "Map fields: Caption → {{response.caption}}, Hashtags → {{response.hashtags}}, Platform → chọn Facebook/Instagram/TikTok" },
            { step: "d", text: "Scheduled time → ngày mai 10:00 (hoặc tùy chỉnh theo lịch tốt nhất)" },
            { step: "e", text: "Thêm Iterator nếu có nhiều cửa hàng → loop qua từng brand" },
          ].map(item => (
            <div key={item.step} className="flex gap-2.5 text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{item.step.toUpperCase()}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <a href="https://www.make.com/en/integrations/metricool" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium">
          <ExternalLink className="w-3.5 h-3.5" /> Xem tài liệu Make.com + Metricool
        </a>
      </div>

      {/* Step 3: Test webhook */}
      <div className="p-5 bg-white rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">3</div>
          <div>
            <p className="font-bold text-foreground">Kiểm tra kết nối Make.com Webhook</p>
            <p className="text-xs text-muted-foreground mt-0.5">Gửi dữ liệu test để xác nhận Make.com nhận được</p>
          </div>
        </div>
        {webhookResult && (
          <div className={`flex items-start gap-3 p-3 rounded-xl border ${webhookResult.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
            {webhookResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="text-sm">{webhookResult.message}</p>
          </div>
        )}
        <button
          onClick={handleTestWebhook}
          disabled={testingWebhook}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {testingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
          {testingWebhook ? "Đang gửi..." : "Test Make.com Webhook"}
        </button>
        <p className="text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
          Cần cài đặt MAKE_WEBHOOK_URL trong Replit Secrets — lấy từ Make.com → Webhooks → Copy URL.
        </p>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
type MainTab = "settings" | "connections" | "logs";

export default function AutomationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>("settings");
  const [runningAll, setRunningAll] = useState(false);

  const { data: items = [], isLoading } = useQuery<BrandSettings[]>({
    queryKey: ["automation-settings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/automation/settings`);
      return r.json();
    },
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery<AutomationLog[]>({
    queryKey: ["automation-logs"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/automation/logs?limit=50`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ brandId, settings }: { brandId: number; settings: any }) => {
      const r = await fetch(`${BASE}/api/automation/settings/${brandId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) throw new Error("Lỗi lưu cài đặt");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Đã lưu cài đặt automation" });
      queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleRunTest = async (brandId: number, currentSettings: any) => {
    const r = await fetch(`${BASE}/api/automation/run/${brandId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testMode: true,
        metricoolAccountId: currentSettings.metricoolAccountId || undefined,
        metricoolToken: currentSettings.metricoolToken || undefined,
      }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error ?? "Lỗi không xác định");
    queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
    queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    return data;
  };

  const handleRunNow = async (brandId: number) => {
    try {
      const r = await fetch(`${BASE}/api/automation/run/${brandId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (data.ok) {
        toast({ title: `Đã tạo ${data.plans?.length ?? 0} bài cho tiệm!` });
        queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
        queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
      } else {
        toast({ title: `Lỗi: ${data.error}`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: `Lỗi: ${e.message}`, variant: "destructive" });
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const r = await fetch(`${BASE}/api/automation/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (data.ok) {
        toast({ title: `Đã tạo ${data.totalPlansCreated} bài cho ${data.totalBrands} tiệm!` });
        queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
        queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
      } else {
        toast({ title: `Lỗi: ${data.error}`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setRunningAll(false); }
  };

  const enabledCount = items.filter(i => i.settings?.isEnabled).length;

  const TABS: { id: MainTab; label: string; icon: typeof Settings; badge?: number }[] = [
    { id: "settings", label: "Cài đặt cửa hàng", icon: Settings, badge: enabledCount > 0 ? enabledCount : undefined },
    { id: "connections", label: "Kết nối Make.com + Metricool", icon: Link2 },
    { id: "logs", label: "Nhật ký", icon: FileText, badge: logs.length > 0 ? logs.length : undefined },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-md shadow-primary/20">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-display font-bold text-2xl text-foreground">Automation Tự động</h1>
            </div>
            <p className="text-muted-foreground text-sm">Mỗi ngày trước 19:00 — AI tự tìm trending, viết Reel + Post + Story → gửi Make.com → Metricool đăng tự động.</p>
          </div>
          {enabledCount > 0 && activeTab === "settings" && (
            <button
              onClick={handleRunAll}
              disabled={runningAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {runningAll ? "Đang chạy tất cả..." : `Chạy tất cả (${enabledCount} tiệm)`}
            </button>
          )}
        </div>

        {/* Flow diagram */}
        <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Luồng automation khép kín</p>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {[
              { icon: "⏰", label: "Make.com 17:00" },
              { icon: "🔬", label: "Grok: Trending topic" },
              { icon: "🧠", label: "GPT-4o: Chiến lược" },
              { icon: "✍️", label: "Gemini: Viết bài" },
              { icon: "💾", label: "Lưu DB" },
              { icon: "📤", label: "Webhook → Make.com" },
              { icon: "📅", label: "Metricool lên lịch" },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground">
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Main tabs */}
        <div className="border-b border-border">
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-sm bg-white rounded-2xl border border-border p-6 text-center">Chưa có cửa hàng nào. Thêm cửa hàng trong Quản lý cửa hàng trước.</p>
            ) : (
              items.map(item => (
                <BrandAutomationCard
                  key={item.brand.id}
                  item={item}
                  onSave={(brandId, settings) => saveMutation.mutate({ brandId, settings })}
                  onRunNow={handleRunNow}
                  onRunTest={handleRunTest}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "connections" && <ConnectionsPanel />}

        {activeTab === "logs" && <LogsPanel logs={logs} refetchLogs={refetchLogs} />}
      </div>
    </AppLayout>
  );
}
