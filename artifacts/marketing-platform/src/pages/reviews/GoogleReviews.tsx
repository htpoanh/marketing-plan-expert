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
  MessageSquare, Settings, Info, Loader2, ExternalLink, Edit3
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

  const handleSync = async () => {
    if (!placeId.trim()) return;
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, placeId: placeId.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Lỗi không xác định");
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
      setError("Không kết nối được. Kiểm tra lại Google API Key.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-bold text-lg">Kết nối & Đồng bộ Google Reviews</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập Google Place ID của cửa hàng để tự động tải đánh giá thật từ Google Maps về hệ thống.
        </p>
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
        <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Lỗi kết nối Google</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
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
function ReviewsListTab({ brandId, brands }: { brandId: number | undefined; brands: any[]; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filterRating, setFilterRating] = useState<string>("");
  const [filterReplied, setFilterReplied] = useState<string>("");

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

                  {/* Action button */}
                  <div className="lg:w-40 flex items-start justify-end shrink-0">
                    {!review.replied ? (
                      <button
                        onClick={() => handleAutoReply(review.id)}
                        disabled={generatingId === review.id}
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                      >
                        {generatingId === review.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Đang viết...</>
                        ) : (
                          <><Bot className="w-4 h-4" /> AI Trả lời</>
                        )}
                      </button>
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium w-full text-center flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Đã phản hồi
                      </div>
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
  const [tab, setTab] = useState<"list" | "templates" | "sync">("list");
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const { data: brands = [] } = useListBrands();

  const activeBrandId = selectedBrand ?? brands[0]?.id;

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
            {tab === "list" && <ReviewsListTab brandId={activeBrandId} brands={brands} />}
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
