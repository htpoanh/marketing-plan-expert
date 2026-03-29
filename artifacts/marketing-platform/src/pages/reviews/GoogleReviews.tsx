import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListReviews,
  useListBrands,
  useGenerateReviewReply,
  useSaveReviewReply,
  getListReviewsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import {
  Star, Bot, Check, Search, Filter, RefreshCw, Link2,
  Sparkles, Save, ChevronRight, AlertCircle, CloudDownload,
  MessageSquare, Settings, Info, Loader2, ExternalLink, Edit3,
  Globe, Unlink, MapPin, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReviewTemplate = {
  id: number;
  brand_id: number;
  rating: number;
  template_text: string;
  is_active: boolean;
};

type SyncResult = {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  placeName?: string;
  placeRating?: number;
};

type GmbStatus = {
  connected: boolean;
  hasCredentials: boolean;
  accountId?: string;
  accountName?: string;
  locationId?: string;
  locationName?: string;
  isExpired?: boolean;
  updatedAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STAR_CONFIG: Record<number, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  1: { label: "1 sao — Rất tệ", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    emoji: "😡" },
  2: { label: "2 sao — Không hài lòng", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", emoji: "😕" },
  3: { label: "3 sao — Bình thường",   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", emoji: "😐" },
  4: { label: "4 sao — Hài lòng",      color: "text-lime-400",   bg: "bg-lime-500/10",   border: "border-lime-500/30",   emoji: "😊" },
  5: { label: "5 sao — Xuất sắc",      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", emoji: "🤩" },
};

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < count ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

// ─── Tab: Mẫu trả lời ────────────────────────────────────────────────────────
function TemplatesTab({ brandId }: { brandId: number }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | "all" | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const { data: rawTemplates, isLoading, refetch } = useQuery<ReviewTemplate[]>({
    queryKey: ["/api/reviews/templates", brandId],
    queryFn: async () => {
      const r = await fetch(`/api/reviews/templates?brandId=${brandId}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!brandId,
  });

  useEffect(() => {
    if (rawTemplates) {
      const map: Record<number, string> = {};
      rawTemplates.forEach(t => { map[t.rating] = t.template_text; });
      setTemplates(map);
    }
  }, [rawTemplates]);

  const generateOne = async (rating: number) => {
    setGenerating(rating);
    try {
      const r = await fetch("/api/reviews/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, rating }),
      });
      const data = await r.json();
      setTemplates(prev => ({ ...prev, [rating]: data.template }));
      toast({ title: `Đã tạo mẫu ${rating}⭐` });
      refetch();
    } catch {
      toast({ title: "Lỗi tạo mẫu", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generateAll = async () => {
    setGenerating("all");
    try {
      const r = await fetch("/api/reviews/templates/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data = await r.json();
      if (data.templates) setTemplates(data.templates);
      toast({ title: "Đã tạo tất cả 5 mẫu trả lời!" });
      refetch();
    } catch {
      toast({ title: "Lỗi tạo mẫu", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const saveOne = async (rating: number) => {
    setSaving(rating);
    try {
      await fetch("/api/reviews/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, rating, templateText: templates[rating] ?? "" }),
      });
      toast({ title: `Đã lưu mẫu ${rating}⭐` });
      setEditing(null);
      refetch();
    } catch {
      toast({ title: "Lỗi lưu mẫu", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Đang tải...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h2 className="font-bold text-lg">Mẫu trả lời tự động theo số sao</h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI tạo sẵn mẫu cho từng mức đánh giá. Khi khách đánh giá, hệ thống dùng đúng mẫu đó — thay{" "}
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">[Tên khách]</code> bằng tên thật và gửi ngay.
          </p>
        </div>
        <button
          onClick={generateAll}
          disabled={generating === "all"}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap shadow-lg shadow-primary/25"
        >
          {generating === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating === "all" ? "Đang tạo 5 mẫu..." : "AI tạo cả 5 mẫu"}
        </button>
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          Mẫu trả lời <strong>ưu tiên hơn</strong> AI tạo mới — nhanh, nhất quán và đúng giọng thương hiệu. Có thể chỉnh tay sau khi AI tạo.
        </p>
      </div>

      {[5, 4, 3, 2, 1].map(rating => {
        const cfg = STAR_CONFIG[rating];
        const text = templates[rating] ?? "";
        const isEditing = editing === rating;
        const isGenerating = generating === rating;
        const isSaving = saving === rating;

        return (
          <div key={rating} className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cfg.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <StarRow count={rating} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {text && !isEditing && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {text.length > 80 ? text.slice(0, 80) + "..." : text}
                    </p>
                  )}
                  {!text && !isEditing && (
                    <p className="text-xs text-muted-foreground/50 mt-0.5 italic">Chưa có mẫu trả lời</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {text && !isEditing && (
                  <button
                    onClick={() => setEditing(rating)}
                    className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => generateOne(rating)}
                  disabled={!!generating}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${cfg.color} bg-white/10 hover:bg-white/20 disabled:opacity-50`}
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isGenerating ? "Đang tạo..." : text ? "Tạo lại" : "Tạo bằng AI"}
                </button>
              </div>
            </div>

            {(isEditing || (!text && false)) && (
              <div className="px-5 pb-4 space-y-2">
                <textarea
                  value={text}
                  onChange={e => setTemplates(prev => ({ ...prev, [rating]: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-card/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Nhập mẫu trả lời... Dùng [Tên khách] để hệ thống tự điền tên."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">Hủy</button>
                  <button
                    onClick={() => saveOne(rating)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Đang lưu..." : "Lưu mẫu"}
                  </button>
                </div>
              </div>
            )}

            {text && isEditing && (
              <div className="px-5 pb-4 space-y-2">
                <textarea
                  value={text}
                  onChange={e => setTemplates(prev => ({ ...prev, [rating]: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-card/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">Hủy</button>
                  <button
                    onClick={() => saveOne(rating)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Đang lưu..." : "Lưu mẫu"}
                  </button>
                </div>
              </div>
            )}

            {text && !isEditing && (
              <div className="mx-5 mb-4 p-3 rounded-xl bg-card/40 border border-border/40">
                <p className="text-xs text-muted-foreground/60 mb-1 font-medium">Nội dung mẫu đầy đủ:</p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{text}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Đồng bộ Google ──────────────────────────────────────────────────────
function SyncTab({ brandId, brands }: { brandId: number; brands: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const brand = brands.find(b => b.id === brandId);
  const [placeId, setPlaceId] = useState(brand?.googlePlaceId ?? "");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; message?: string; reason?: string; hint?: string } | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);

  // ── GMB OAuth state ──
  const [gmbSyncing, setGmbSyncing] = useState(false);
  const [gmbSyncResult, setGmbSyncResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [gmbLocations, setGmbLocations] = useState<{ id: string; name: string }[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Fetch GMB status
  const { data: gmbStatus, refetch: refetchGmbStatus } = useQuery<GmbStatus>({
    queryKey: ["/api/reviews/google-auth/status", brandId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/reviews/google-auth/status?brandId=${brandId}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch GMB status");
      return r.json();
    },
    enabled: !!brandId,
    staleTime: 30_000,
  });

  const handleGmbConnect = () => {
    const authUrl = `${BASE}/api/reviews/google-auth/url?brandId=${brandId}`;
    const popup = window.open(
      authUrl,
      "google-business-auth",
      "width=550,height=680,left=200,top=100,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      // Popup blocked — fall back to full-page redirect
      window.location.href = authUrl;
      return;
    }

    // Listen for postMessage from popup callback page
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "GOOGLE_AUTH_SUCCESS") {
        window.removeEventListener("message", onMessage);
        clearInterval(pollId);
        popup.close();
        refetchGmbStatus();
        toast({ title: "Đã kết nối Google Business Profile!", description: "Bạn có thể đồng bộ tất cả đánh giá ngay bây giờ." });
      }
    };
    window.addEventListener("message", onMessage);

    // Polling fallback: re-check status every 2s until popup closes
    const pollId = setInterval(async () => {
      if (popup.closed) {
        clearInterval(pollId);
        window.removeEventListener("message", onMessage);
        // Popup closed — refetch to see if connection succeeded
        refetchGmbStatus();
        return;
      }
    }, 2000);
  };

  const handleGmbDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`${BASE}/api/reviews/google-auth/disconnect?brandId=${brandId}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast({ title: "Đã ngắt kết nối Google Business Profile" });
      refetchGmbStatus();
    } catch {
      toast({ title: "Lỗi ngắt kết nối", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLoadLocations = async () => {
    setLoadingLocations(true);
    try {
      const r = await fetch(`${BASE}/api/reviews/google-auth/locations?brandId=${brandId}`, {
        credentials: "include",
      });
      const data = await r.json();
      setGmbLocations(data.locations ?? []);
    } catch {
      toast({ title: "Lỗi tải danh sách địa điểm", variant: "destructive" });
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSetLocation = async (locationId: string, locationName: string) => {
    try {
      await fetch(`${BASE}/api/reviews/google-auth/set-location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brandId, locationId, locationName }),
      });
      toast({ title: "Đã chọn địa điểm: " + locationName });
      refetchGmbStatus();
      setGmbLocations([]);
    } catch {
      toast({ title: "Lỗi lưu địa điểm", variant: "destructive" });
    }
  };

  const handleGmbSync = async () => {
    setGmbSyncing(true);
    setGmbSyncResult(null);
    try {
      const r = await fetch(`${BASE}/api/reviews/sync-gmb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brandId }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Lỗi đồng bộ", description: data.error ?? "Lỗi không xác định", variant: "destructive" });
        return;
      }
      setGmbSyncResult({ imported: data.imported, skipped: data.skipped, total: data.total });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      if (data.imported > 0) {
        toast({ title: `Đã nhập ${data.imported} đánh giá mới từ Google Business!` });
      } else {
        toast({ title: "Đã đồng bộ — không có đánh giá mới" });
      }
    } catch {
      toast({ title: "Không kết nối được máy chủ", variant: "destructive" });
    } finally {
      setGmbSyncing(false);
    }
  };

  const handleCheckKey = async () => {
    setCheckingKey(true);
    setKeyStatus(null);
    try {
      const r = await fetch(`${BASE}/api/reviews/check-api-key`);
      const d = await r.json();
      setKeyStatus(d);
    } catch {
      setKeyStatus({ ok: false, reason: "Không kết nối được máy chủ." });
    } finally {
      setCheckingKey(false);
    }
  };

  const handleSync = async () => {
    if (!placeId.trim()) return;
    setSyncing(true);
    setResult(null);
    setError(null);
    setErrorStatus(null);
    setErrorHint(null);
    try {
      const r = await fetch(`${BASE}/api/reviews/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brandId, placeId: placeId.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Lỗi không xác định");
        setErrorStatus(data.status ?? null);
        setErrorHint(data.hint ?? null);
        return;
      }
      setResult(data);
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ brandId }) });
      if (data.imported > 0) {
        toast({ title: `Đã nhập ${data.imported} đánh giá mới từ Google!` });
      } else {
        toast({ title: "Đã cập nhật — không có đánh giá mới" });
      }
    } catch (e) {
      setError("Không kết nối được máy chủ.");
      setErrorStatus(null);
      setErrorHint(null);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* GOOGLE BUSINESS PROFILE OAUTH SECTION                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="p-5 bg-card rounded-2xl border border-border/50 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base">Kết nối Google Business Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Không giới hạn 5 đánh giá — và đăng phản hồi trực tiếp lên Google Maps.
            </p>
          </div>
          {gmbStatus?.connected && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Đã kết nối</span>
            </div>
          )}
        </div>

        {/* Not configured (no client ID/secret) */}
        {gmbStatus && !gmbStatus.hasCredentials && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Cần cài đặt thêm Google OAuth
            </p>
            <p className="text-xs text-muted-foreground">
              Để kết nối Google Business Profile, cần tạo OAuth credentials trong Google Cloud Console và thêm vào Replit Secrets.
            </p>
            <ol className="space-y-2">
              {[
                { n: "1", text: "Truy cập", link: "https://console.cloud.google.com/apis/credentials", linkText: "Google Cloud Console → Credentials" },
                { n: "2", text: "Tạo \"OAuth 2.0 Client ID\" (loại: Web application)" },
                { n: "3", text: "Thêm Redirect URI:", code: `${window.location.origin}/api/reviews/google-auth/callback` },
                { n: "4", text: "Copy Client ID và Client Secret → thêm vào Replit Secrets với tên", code: "GOOGLE_CLIENT_ID" },
                { n: "5", text: "Thêm Client Secret với tên", code: "GOOGLE_CLIENT_SECRET" },
                { n: "6", text: "Bật", link: "https://console.cloud.google.com/apis/library/mybusiness.googleapis.com", linkText: "Google Business Profile API", suffix: "trong Google Cloud Console" },
              ].map(item => (
                <li key={item.n} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">{item.n}</span>
                  <span className="flex-1">
                    {item.text}{" "}
                    {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">{item.linkText} <ExternalLink className="w-2.5 h-2.5" /></a>}
                    {item.suffix && " " + item.suffix}
                    {item.code && <code className="ml-1 text-xs bg-secondary px-1 rounded">{item.code}</code>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Configured but not connected */}
        {gmbStatus?.hasCredentials && !gmbStatus?.connected && (
          <div className="space-y-3">
            <div className="p-3 bg-secondary/30 rounded-xl border border-border/40">
              <p className="text-xs text-muted-foreground">
                Nhấn nút bên dưới để đăng nhập Google và cấp quyền truy cập Google Business Profile.
                Chỉ cần làm một lần — hệ thống sẽ tự động gia hạn sau đó.
              </p>
            </div>
            <button
              onClick={handleGmbConnect}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25"
            >
              <Globe className="w-4 h-4" />
              Kết nối Google Business
            </button>
          </div>
        )}

        {/* Connected */}
        {gmbStatus?.connected && (
          <div className="space-y-3">
            {/* Account info */}
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-400">Tài khoản Google Business</p>
                  <p className="text-xs text-muted-foreground truncate">{gmbStatus.accountName || gmbStatus.accountId}</p>
                </div>
              </div>
              {gmbStatus.locationName && (
                <div className="flex items-center gap-2 pl-6">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-400">Địa điểm: <strong>{gmbStatus.locationName}</strong></p>
                </div>
              )}
              {!gmbStatus.locationName && (
                <p className="text-xs text-amber-400 pl-6">Chưa chọn địa điểm — tải danh sách để chọn</p>
              )}
            </div>

            {/* Location picker */}
            {gmbLocations.length === 0 ? (
              <button
                onClick={handleLoadLocations}
                disabled={loadingLocations}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-all disabled:opacity-50"
              >
                {loadingLocations ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                {loadingLocations ? "Đang tải địa điểm..." : "Xem / Đổi địa điểm"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Chọn địa điểm:</p>
                {gmbLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleSetLocation(loc.id, loc.name)}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm text-left transition-all ${
                      loc.id === gmbStatus.locationId
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-border hover:bg-secondary text-foreground"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {loc.name}
                    {loc.id === gmbStatus.locationId && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </button>
                ))}
              </div>
            )}

            {/* GMB Sync + Disconnect buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleGmbSync}
                disabled={gmbSyncing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
              >
                {gmbSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                {gmbSyncing ? "Đang đồng bộ tất cả..." : "Đồng bộ tất cả Reviews"}
              </button>
              <button
                onClick={handleGmbDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 disabled:opacity-50 transition-all"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                {disconnecting ? "Đang ngắt..." : "Ngắt kết nối"}
              </button>
            </div>

            {/* GMB sync result */}
            {gmbSyncResult && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Đồng bộ Google Business thành công!
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-card/50 text-center">
                    <p className="text-xl font-bold text-emerald-400">{gmbSyncResult.imported}</p>
                    <p className="text-xs text-muted-foreground">Đã nhập</p>
                  </div>
                  <div className="p-2 rounded-lg bg-card/50 text-center">
                    <p className="text-xl font-bold text-foreground/60">{gmbSyncResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Bỏ qua</p>
                  </div>
                  <div className="p-2 rounded-lg bg-card/50 text-center">
                    <p className="text-xl font-bold text-foreground">{gmbSyncResult.total}</p>
                    <p className="text-xs text-muted-foreground">Tổng cộng</p>
                  </div>
                </div>
              </div>
            )}

            {gmbStatus.isExpired && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400">Token đã hết hạn. Nhấn "Kết nối lại" để gia hạn.</p>
                <button onClick={handleGmbConnect} className="mt-2 text-xs text-primary hover:underline">Kết nối lại Google</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/30 pt-2">
        <p className="text-xs text-muted-foreground font-medium mb-4 flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Hoặc dùng Places API (giới hạn 5 đánh giá gần nhất):
        </p>
      </div>

      <div>
        <h2 className="font-bold text-lg">Kết nối & Đồng bộ Google Reviews</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập Google Place ID của cửa hàng để tự động tải đánh giá thật từ Google Maps về hệ thống.
        </p>
      </div>

      {/* ── API Key Status Check ── */}
      <div className="p-4 bg-card rounded-2xl border border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Kiểm tra kết nối Google API
          </p>
          <button
            onClick={handleCheckKey}
            disabled={checkingKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary text-xs font-medium transition-all disabled:opacity-50"
          >
            {checkingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {checkingKey ? "Đang kiểm tra..." : "Kiểm tra ngay"}
          </button>
        </div>

        {!keyStatus && !checkingKey && (
          <p className="text-xs text-muted-foreground">Nhấn "Kiểm tra ngay" để xem GOOGLE_API_KEY có hoạt động không.</p>
        )}

        {keyStatus && (
          <div className={`flex items-start gap-3 p-3 rounded-xl border ${keyStatus.ok ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            {keyStatus.ok
              ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
            <div className="space-y-1">
              <p className={`text-sm font-bold ${keyStatus.ok ? "text-emerald-400" : "text-red-400"}`}>
                {keyStatus.ok ? "API key hợp lệ — sẵn sàng đồng bộ!" : "API key không hoạt động"}
              </p>
              <p className="text-xs text-muted-foreground">{keyStatus.ok ? keyStatus.message : keyStatus.reason}</p>
              {!keyStatus.ok && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Cách cập nhật API key đúng:</p>
                  <ol className="space-y-1.5">
                    {[
                      { n: "1", text: "Truy cập", link: "https://console.cloud.google.com/apis/credentials", linkText: "Google Cloud Console → Credentials" },
                      { n: "2", text: "Tạo API key mới → bật", link: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com", linkText: "Places API" },
                      { n: "3", text: "Trong Replit: vào Secrets (ổ khóa bên trái) → sửa GOOGLE_API_KEY → dán key mới vào" },
                      { n: "4", text: "Quay lại đây → nhấn Kiểm tra lại" },
                    ].map(item => (
                      <li key={item.n} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 font-bold text-[10px]">{item.n}</span>
                        <span>
                          {item.text}{" "}
                          {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">{item.linkText} <ExternalLink className="w-2.5 h-2.5" /></a>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted-foreground/60 mt-1">* Google cấp $200 miễn phí/tháng — đủ dùng cho cửa hàng nhỏ.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* How to get Place ID */}
      <div className="p-4 bg-card rounded-2xl border border-border/50 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Cách lấy Google Place ID</p>
        <ol className="text-sm text-muted-foreground space-y-2">
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">1</span>
            <span>Truy cập <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-1">Place ID Finder <ExternalLink className="w-3 h-3" /></a> hoặc tìm trên Google Maps</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">2</span>
            <span>Tìm kiếm tên cửa hàng "<strong className="text-foreground">{brand?.brandName}</strong>" trên Google Maps</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">3</span>
            <span>Copy Place ID có dạng: <code className="text-xs bg-secondary px-2 py-0.5 rounded text-foreground">ChIJxxxxxxxxxxxxxxxx</code></span>
          </li>
        </ol>
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(brand?.brandName ?? "")}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Tìm "{brand?.brandName}" trên Google Maps
        </a>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Google Place ID</label>
        <div className="flex gap-2">
          <input
            value={placeId}
            onChange={e => setPlaceId(e.target.value)}
            placeholder="Vd: ChIJD7fiBh9u5kcRYJSMaMOCCwQ"
            className="flex-1 px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
          />
          <button
            onClick={handleSync}
            disabled={!placeId.trim() || syncing}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all whitespace-nowrap shadow-lg shadow-primary/25"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            {syncing ? "Đang tải..." : "Đồng bộ ngay"}
          </button>
        </div>
        {brand?.googlePlaceId && brand.googlePlaceId !== placeId && (
          <button
            onClick={() => setPlaceId(brand.googlePlaceId ?? "")}
            className="text-xs text-primary hover:underline"
          >
            Dùng Place ID đã lưu: {brand.googlePlaceId}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
          <div className="flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400">Lỗi kết nối Google</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{error}</p>
              {errorStatus && <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">Code: {errorStatus}</p>}
            </div>
          </div>

          {/* Billing not enabled */}
          {(errorHint === "BILLING_NOT_ENABLED") && (
            <div className="p-3 bg-background/50 rounded-lg space-y-2 border border-amber-500/30">
              <p className="text-xs font-bold text-amber-400">⚡ Cần bật Billing trong Google Cloud:</p>
              <ol className="space-y-1.5">
                {[
                  { step: "1", text: "Truy cập", link: "https://console.cloud.google.com/billing", linkText: "Google Cloud → Billing" },
                  { step: "2", text: "Liên kết thẻ tín dụng/ngân hàng (Google miễn phí $200/tháng — đủ dùng, không trừ tiền)" },
                  { step: "3", text: "Quay lại đây → thử Đồng bộ lại" },
                ].map(item => (
                  <li key={item.step} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">{item.step}</span>
                    <span>{item.text}{" "}{item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">{item.linkText} <ExternalLink className="w-2.5 h-2.5" /></a>}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Permission denied / API key issue */}
          {(errorHint === "PERMISSION_DENIED" || errorHint === "REQUEST_DENIED") && (
            <div className="p-3 bg-background/50 rounded-lg space-y-2 border border-red-500/20">
              <p className="text-xs font-bold text-foreground">Cách sửa — kiểm tra Google API Key:</p>
              <ol className="space-y-1.5">
                {[
                  { step: "1", text: "Truy cập", link: "https://console.cloud.google.com/apis/credentials", linkText: "Google Cloud → Credentials" },
                  { step: "2", text: "Kiểm tra API key: Application restrictions phải là None hoặc IP addresses (không dùng HTTP referrers)" },
                  { step: "3", text: "Vào", link: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com", linkText: "Places API (New)", suffix: "→ xác nhận đã ENABLED" },
                  { step: "4", text: "Cập nhật GOOGLE_API_KEY trong Replit Secrets nếu đã tạo key mới" },
                ].map(item => (
                  <li key={item.step} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 font-bold text-[10px]">{item.step}</span>
                    <span>{item.text}{" "}{item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">{item.linkText} <ExternalLink className="w-2.5 h-2.5" /></a>}{item.suffix && " " + item.suffix}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground/60">* Google cấp miễn phí $200/tháng — đủ dùng cho cửa hàng nhỏ.</p>
            </div>
          )}

          {/* Not found */}
          {errorHint === "NOT_FOUND" && (
            <div className="p-3 bg-background/50 rounded-lg border border-red-500/20">
              <p className="text-xs text-muted-foreground">Kiểm tra lại Place ID — có thể nhập sai. Place ID đúng bắt đầu bằng <code className="text-foreground bg-secondary px-1 rounded">ChIJ</code> và dài khoảng 27 ký tự.</p>
            </div>
          )}
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-emerald-400">Đồng bộ thành công!</span>
          </div>
          {result.placeName && (
            <p className="text-sm text-foreground font-medium">{result.placeName} — ⭐ {result.placeRating}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-card/50 text-center">
              <p className="text-2xl font-bold text-emerald-400">{result.imported}</p>
              <p className="text-xs text-muted-foreground">Đã nhập mới</p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 text-center">
              <p className="text-2xl font-bold text-foreground/60">{result.skipped}</p>
              <p className="text-xs text-muted-foreground">Đã có (bỏ qua)</p>
            </div>
            <div className="p-3 rounded-xl bg-card/50 text-center">
              <p className="text-2xl font-bold text-foreground">{result.total}</p>
              <p className="text-xs text-muted-foreground">Tổng từ Google</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Google Places API chỉ cung cấp tối đa 5 đánh giá gần nhất. Để nhập nhiều hơn, cần kết nối Google My Business API (yêu cầu OAuth).
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Danh sách đánh giá ──────────────────────────────────────────────────
function ReviewsListTab({ brandId, brands, gmbConnected }: { brandId: number | undefined; brands: any[]; gmbConnected: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filterRating, setFilterRating] = useState<string>("");
  const [filterReplied, setFilterReplied] = useState<string>("");
  const [postingToGoogleId, setPostingToGoogleId] = useState<number | null>(null);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handlePostToGoogle = async (review: any) => {
    if (!review.replyText) {
      toast({ title: "Chưa có nội dung phản hồi để đăng lên Google.", variant: "destructive" });
      return;
    }
    setPostingToGoogleId(review.id);
    try {
      const r = await fetch(`${BASE}/api/reviews/reply-gmb/${review.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ replyText: review.replyText }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Lỗi đăng lên Google", description: data.error ?? "Không thể kết nối Google.", variant: "destructive" });
      } else {
        toast({ title: "Đã đăng phản hồi lên Google Maps!", description: "Khách hàng sẽ thấy phản hồi của bạn trên Google." });
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ brandId }) });
      }
    } catch {
      toast({ title: "Không kết nối được máy chủ", variant: "destructive" });
    } finally {
      setPostingToGoogleId(null);
    }
  };

  const { data: reviews, isLoading } = useListReviews({ brandId, rating: filterRating ? Number(filterRating) : undefined, replied: filterReplied !== "" ? filterReplied === "true" : undefined } as any);

  const generateReply = useGenerateReviewReply({
    mutation: {
      onSuccess: (data: any, variables: any) => {
        const replyText = data.reply;
        fetch(`/api/reviews/${variables.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyText }),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ brandId }) });
          setGeneratingId(null);
          toast({
            title: data.fromTemplate ? "Đã dùng mẫu trả lời" : "AI đã viết phản hồi",
            description: data.fromTemplate ? "Hệ thống dùng mẫu đã cài cho số sao này." : "Đã tạo và lưu phản hồi."
          });
        });
      },
      onError: () => {
        setGeneratingId(null);
        toast({ title: "Lỗi", description: "Không thể tạo phản hồi", variant: "destructive" });
      }
    }
  });

  const handleAutoReply = (id: number) => {
    setGeneratingId(id);
    generateReply.mutate({ id } as any);
  };

  const handleEditReply = (review: any) => {
    setEditingId(review.id);
    setEditText(review.replyText ?? "");
  };

  const handleSaveReply = async (id: number) => {
    setSavingId(id);
    try {
      await fetch(`/api/reviews/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: editText }),
      });
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ brandId }) });
      setEditingId(null);
      toast({ title: "Đã lưu phản hồi" });
    } catch {
      toast({ title: "Lỗi lưu phản hồi", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Lọc:</span>
        </div>
        <select
          value={filterRating}
          onChange={e => setFilterRating(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Tất cả số sao</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} ⭐</option>)}
        </select>
        <select
          value={filterReplied}
          onChange={e => setFilterReplied(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="false">Chưa trả lời</option>
          <option value="true">Đã trả lời</option>
        </select>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Đang tải...</div>
        ) : !reviews || reviews.length === 0 ? (
          <div className="p-16 text-center">
            <Star className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="font-medium text-foreground">Chưa có đánh giá nào</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Dùng tab <strong>"Đồng bộ Google"</strong> để tải đánh giá thật từ Google Maps.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {reviews.map((review: any) => (
              <div key={review.id} className="p-5 hover:bg-secondary/10 transition-colors">
                <div className="flex flex-col lg:flex-row gap-5">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                        {review.reviewerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{review.reviewerName}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(review.reviewDate), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex shrink-0">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    </div>

                    {/* Review text */}
                    <p className="text-sm text-foreground/85 leading-relaxed">
                      {review.reviewText || <span className="italic text-muted-foreground text-xs">Không có nội dung đánh giá</span>}
                    </p>

                    {/* Reply */}
                    {review.replied && review.replyText && editingId !== review.id && (
                      <div className="mt-4 ml-3 p-3 rounded-xl bg-secondary/50 border border-border/40 relative">
                        <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Phản hồi của cửa hàng
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{review.replyText}</p>
                        <button
                          onClick={() => handleEditReply(review)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {editingId === review.id && (
                      <div className="mt-4 ml-3 space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-secondary">Hủy</button>
                          <button
                            onClick={() => handleSaveReply(review.id)}
                            disabled={savingId === review.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingId === review.id ? "Lưu..." : "Lưu"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="lg:w-44 flex flex-col items-stretch gap-2 shrink-0">
                    {!review.replied ? (
                      <button
                        onClick={() => handleAutoReply(review.id)}
                        disabled={generatingId === review.id}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                      >
                        {generatingId === review.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Đang viết...</>
                        ) : (
                          <><Bot className="w-4 h-4" /> AI Trả lời</>
                        )}
                      </button>
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium text-center flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Đã phản hồi
                      </div>
                    )}
                    {/* Post to Google button — shown when GMB connected + review has Google ID + has reply text */}
                    {gmbConnected && review.googleReviewId && review.replied && review.replyText && (
                      <button
                        onClick={() => handlePostToGoogle(review)}
                        disabled={postingToGoogleId === review.id}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all disabled:opacity-50"
                      >
                        {postingToGoogleId === review.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đăng...</>
                        ) : (
                          <><Globe className="w-3.5 h-3.5" /> Đăng lên Google</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GoogleReviews() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"list" | "templates" | "sync">("list");
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const { data: brands = [] } = useListBrands();

  const activeBrandId = selectedBrand ?? brands[0]?.id;
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Handle Google OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("googleConnected");
    const authError = params.get("googleAuthError");
    const tabParam = params.get("tab");

    if (tabParam === "sync") setTab("sync");

    if (connected === "true") {
      toast({ title: "Đã kết nối Google Business Profile!", description: "Bây giờ bạn có thể đồng bộ tất cả đánh giá." });
    }
    if (authError) {
      const errorMsg: Record<string, string> = {
        access_denied: "Bạn đã từ chối cấp quyền cho Google Business.",
        token_exchange_failed: "Không thể xác thực với Google. Vui lòng thử lại.",
        missing_credentials: "Chưa cài đặt GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET.",
        server_error: "Lỗi máy chủ khi kết nối Google. Vui lòng thử lại.",
      };
      toast({
        title: "Kết nối Google thất bại",
        description: errorMsg[authError] ?? `Lỗi: ${authError}`,
        variant: "destructive",
      });
    }

    // Clean up URL params
    if (connected || authError || tabParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("googleConnected");
      url.searchParams.delete("googleAuthError");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Fetch GMB status for the active brand (used by ReviewsListTab)
  const { data: gmbStatus } = useQuery<GmbStatus>({
    queryKey: ["/api/reviews/google-auth/status", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) throw new Error("No brand");
      const r = await fetch(`${BASE}/api/reviews/google-auth/status?brandId=${activeBrandId}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!activeBrandId,
    staleTime: 60_000,
  });

  const TABS = [
    { id: "list" as const, label: "Danh sách đánh giá", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "templates" as const, label: "Mẫu trả lời tự động", icon: <Bot className="w-4 h-4" /> },
    { id: "sync" as const, label: "Đồng bộ Google", icon: <CloudDownload className="w-4 h-4" /> },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Đánh giá Google</h1>
            <p className="text-sm text-muted-foreground mt-1">Đồng bộ đánh giá thật, cài mẫu trả lời theo sao, AI phản hồi tự động.</p>
          </div>
          <select
            value={selectedBrand ?? ""}
            onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
            className="px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/50 outline-none text-sm"
          >
            {brands?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.brandName}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeBrandId ? (
          <>
            {tab === "list" && <ReviewsListTab brandId={activeBrandId} brands={brands} gmbConnected={gmbStatus?.connected ?? false} />}
            {tab === "templates" && <TemplatesTab brandId={activeBrandId} />}
            {tab === "sync" && <SyncTab brandId={activeBrandId} brands={brands} />}
          </>
        ) : (
          <div className="p-16 text-center">
            <p className="text-muted-foreground">Chưa có cửa hàng nào. Thêm cửa hàng trước.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
