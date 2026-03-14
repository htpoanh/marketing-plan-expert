import { useState, useRef, useCallback } from "react";
import { useListContentPlans, useListBrands, useUpdateContentPlan, getListContentPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import {
  Calendar, Filter, Facebook, Instagram, Send, X, Copy, Sparkles,
  Image, Loader2, Edit3, Check, ChevronRight, Upload, Download,
  RefreshCw, Bot, Eye, ChevronDown, ChevronUp, Wand2, ThumbsUp, ThumbsDown,
  Trash2, CheckSquare, Square, MinusSquare, BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { ContentPlan } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Provider = "dalle3" | "dalle3-natural" | "gpt-image-1";

const PROVIDERS: { id: Provider; label: string; desc: string; color: string }[] = [
  { id: "dalle3", label: "DALL-E 3 — Vivid", desc: "Kịch tính, màu sắc bão hòa cao — nổi bật trên mạng xã hội", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { id: "dalle3-natural", label: "DALL-E 3 — Natural", desc: "Chân thực tự nhiên, ánh sáng mềm — phù hợp lifestyle & beauty", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { id: "gpt-image-1", label: "GPT-Image-1", desc: "Model mới nhất OpenAI — theo sát brief, sáng tạo hơn", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function ratePrompt(planId: number, rating: "good" | "bad" | null) {
  const res = await fetch(`${BASE}/api/content-plans/${planId}/rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error("Lỗi lưu đánh giá");
  return res.json();
}

async function bulkDelete(ids: number[]) {
  const res = await fetch(`${BASE}/api/content-plans/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Lỗi xóa");
  return res.json();
}

async function bulkSendReview(ids: number[]) {
  const res = await fetch(`${BASE}/api/content-plans/bulk-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Lỗi gửi duyệt");
  return res.json();
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "draft": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    case "review": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "approved": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "scheduled": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "posted": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    default: return "bg-secondary text-muted-foreground border-border";
  }
}
function getStatusText(status: string) {
  switch (status.toLowerCase()) {
    case "draft": return "Bản nháp";
    case "review": return "Chờ duyệt";
    case "approved": return "Đã duyệt";
    case "scheduled": return "Đã lên lịch";
    case "posted": return "Đã đăng";
    default: return status;
  }
}
function getPlatformIcon(platform: string) {
  switch (platform.toLowerCase()) {
    case "facebook": return <Facebook className="w-4 h-4 text-blue-500" />;
    case "instagram": return <Instagram className="w-4 h-4 text-pink-500" />;
    default: return null;
  }
}

// ── Inline Rating Buttons ────────────────────────────────────────────────────
function RatingButtons({ plan, onRated }: { plan: ContentPlan; onRated: (updated: ContentPlan) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const rating = (plan as any).promptRating as "good" | "bad" | null;

  const handleRate = async (e: React.MouseEvent, r: "good" | "bad") => {
    e.stopPropagation();
    setLoading(true);
    try {
      const newRating = rating === r ? null : r; // toggle off
      const updated = await ratePrompt(plan.id, newRating);
      onRated(updated);
      if (newRating) toast({ title: newRating === "good" ? "👍 Đã đánh dấu prompt tốt" : "👎 Đã đánh dấu prompt cần cải thiện" });
    } catch {
      toast({ title: "Lỗi lưu đánh giá", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => handleRate(e, "good")}
        disabled={loading}
        title="Prompt tốt — tạo nội dung chất lượng"
        className={`p-1.5 rounded-lg transition-all ${rating === "good"
          ? "bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/20"
          : "text-muted-foreground/30 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={e => handleRate(e, "bad")}
        disabled={loading}
        title="Prompt cần cải thiện"
        className={`p-1.5 rounded-lg transition-all ${rating === "bad"
          ? "bg-rose-500/20 text-rose-400 shadow-sm shadow-rose-500/20"
          : "text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-500/10"}`}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Image Generator Section ──────────────────────────────────────────────────
function ImageGeneratorSection({ plan, brand }: { plan: ContentPlan; brand?: any }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<Provider>("dalle3");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ provider: Provider; imageUrl: string; enrichedPrompt?: string }[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [styleDescription, setStyleDescription] = useState("");

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 3 - referenceImages.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const r = e.target?.result as string;
        setReferenceImages(prev => prev.length >= 3 ? prev : [...prev, r]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/api/content-plans/${plan.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, referenceImages, saveToDb: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi tạo hình");
      const imageUrl = data.imageUrl ?? data.imageBase64;
      setResults(prev => [{ provider: selectedProvider, imageUrl, enrichedPrompt: data.enrichedPrompt }, ...prev.filter(r => r.provider !== selectedProvider)]);
      if (data.styleDescription) setStyleDescription(data.styleDescription);
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: "Tạo hình thành công!", description: `${PROVIDERS.find(p => p.id === selectedProvider)?.label} đã tạo xong` });
    } catch (e: any) {
      toast({ title: "Lỗi tạo hình", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Reference image upload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Hình mẫu phong cách tiệm
            <span className="text-muted-foreground/60 font-normal normal-case">(tối đa 3 hình)</span>
          </label>
          {referenceImages.length > 0 && <span className="text-xs text-emerald-400 font-medium">AI sẽ học theo phong cách này</span>}
        </div>
        <div
          className="border-2 border-dashed border-border/50 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => referenceImages.length < 3 && fileInputRef.current?.click()}
        >
          {referenceImages.length === 0 ? (
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Kéo thả hoặc click để upload hình mẫu phong cách tiệm</p>
              <p className="text-xs text-muted-foreground/60">AI sẽ phân tích màu sắc, ánh sáng, bố cục để tạo hình tương tự</p>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap justify-center" onClick={e => e.stopPropagation()}>
              {referenceImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg border border-border/50" />
                  <button onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 3 && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                  <Upload className="w-5 h-5 mb-1" /><span className="text-xs">Thêm</span>
                </button>
              )}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
      </div>

      {styleDescription && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" /> Phân tích phong cách từ hình mẫu:</p>
          <p className="text-xs text-emerald-300/80 leading-relaxed">{styleDescription}</p>
        </div>
      )}

      {brand && (
        <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl">
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Dữ liệu training thương hiệu:</p>
          <div className="flex flex-wrap gap-2">
            {brand.industry && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">{brand.industry}</span>}
            {brand.brandVoice && <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full border border-border/50 max-w-[200px] truncate">{brand.brandVoice}</span>}
            {brand.targetAudience && <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full border border-border/50 max-w-[200px] truncate">{brand.targetAudience}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chọn AI tạo hình</label>
        <div className="grid grid-cols-1 gap-2">
          {PROVIDERS.map(prov => (
            <button key={prov.id} onClick={() => setSelectedProvider(prov.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedProvider === prov.id ? prov.color + " ring-2 ring-current/30" : "border-border/50 bg-secondary/20 hover:bg-secondary/40"}`}>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${selectedProvider === prov.id ? "border-current" : "border-border"}`}>
                {selectedProvider === prov.id && <div className="w-2 h-2 rounded-full bg-current" />}
              </div>
              <div><div className="text-sm font-bold">{prov.label}</div><div className="text-xs text-muted-foreground mt-0.5">{prov.desc}</div></div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={generating}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-primary text-white shadow-lg shadow-purple-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0">
        {generating ? (
          <><Loader2 className="w-5 h-5 animate-spin" />{referenceImages.length > 0 ? "Đang phân tích & tạo hình..." : "Đang tạo hình..."}</>
        ) : (
          <><Sparkles className="w-5 h-5" />Tạo hình với {PROVIDERS.find(p => p.id === selectedProvider)?.label}</>
        )}
      </button>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Image className="w-3.5 h-3.5" /> Kết quả ({results.length} phiên bản)
          </div>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-b border-border/50">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${PROVIDERS.find(p => p.id === r.provider)?.color ?? ""}`}>
                  {PROVIDERS.find(p => p.id === r.provider)?.label}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => window.open(r.imageUrl, "_blank")} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-4 h-4" /></button>
                  <a href={r.imageUrl} download={`${plan.topic}_${r.provider}.png`} target="_blank" className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors"><Download className="w-4 h-4" /></a>
                </div>
              </div>
              <div className="p-2"><img src={r.imageUrl} alt="" className="w-full rounded-lg object-cover max-h-64" /></div>
              {r.enrichedPrompt && (
                <div className="px-3 pb-3">
                  <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                    {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Xem prompt đã dùng
                  </button>
                  {showPrompt && <div className="mt-2 p-2 bg-secondary/30 rounded-lg text-xs text-muted-foreground font-mono">{r.enrichedPrompt}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {plan.imagePrompt && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Prompt gốc (từ Pipeline AI):</label>
          <div className="p-3 bg-secondary/20 rounded-xl text-xs text-muted-foreground font-mono border border-border/30">{plan.imagePrompt}</div>
        </div>
      )}
    </div>
  );
}

// ── Plan Modal ───────────────────────────────────────────────────────────────
function PlanModal({
  plan: initialPlan, onClose, onUpdated,
}: { plan: ContentPlan; onClose: () => void; onUpdated: (p: ContentPlan) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const brand = brands?.find(b => b.id === initialPlan.brandId);
  const [plan, setPlan] = useState(initialPlan);

  const updateMutation = useUpdateContentPlan({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
        setPlan(updated as any);
        onUpdated(updated as any);
      }
    }
  });

  const [tab, setTab] = useState<"content" | "image">("content");
  const [editing, setEditing] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [form, setForm] = useState({
    hook: plan.hook ?? "", caption: plan.caption ?? "", cta: plan.cta ?? "",
    hashtags: plan.hashtags ?? "", imagePrompt: plan.imagePrompt ?? "", videoPrompt: plan.videoPrompt ?? "",
  });

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Đã copy!" }); };

  const handleSave = () => {
    updateMutation.mutate({ id: plan.id, data: { ...form } }, {
      onSuccess: () => { setEditing(false); toast({ title: "Đã lưu" }); }
    });
  };

  const handleSendReview = () => {
    updateMutation.mutate({ id: plan.id, data: { status: "review" } }, {
      onSuccess: () => { toast({ title: "Đã gửi phê duyệt" }); onClose(); }
    });
  };

  const handleRate = async (r: "good" | "bad") => {
    setRatingLoading(true);
    try {
      const currentRating = (plan as any).promptRating;
      const newRating = currentRating === r ? null : r;
      const updated = await ratePrompt(plan.id, newRating);
      setPlan(updated);
      onUpdated(updated);
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: newRating === "good" ? "👍 Prompt tốt — đã ghi nhận" : newRating === "bad" ? "👎 Cần cải thiện — đã ghi nhận" : "Đã bỏ đánh giá" });
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
    setRatingLoading(false);
  };

  const rating = (plan as any).promptRating as "good" | "bad" | null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getPlatformIcon(plan.platform)}
              <div>
                <div className="font-bold text-base line-clamp-1">{plan.topic}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(plan.publishDate), "dd/MM/yyyy HH:mm")} · {plan.platform}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>{getStatusText(plan.status)}</span>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-xl">
            <button onClick={() => setTab("content")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "content" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Nội dung</button>
            <button onClick={() => setTab("image")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === "image" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Sparkles className="w-3.5 h-3.5" /> Tạo hình AI
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {tab === "content" && (
            <>
              {/* ── RATING SECTION ── */}
              <div className="p-4 bg-secondary/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> Đánh giá chất lượng prompt AI
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Giúp hệ thống học và cải thiện nội dung trong tương lai</p>
                  </div>
                  {rating && (
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${rating === "good" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                      {rating === "good" ? "✓ Prompt tốt" : "✗ Cần cải thiện"}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleRate("good")} disabled={ratingLoading}
                    className={`flex-1 py-2.5 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${rating === "good" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20" : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30"}`}>
                    <ThumbsUp className="w-4 h-4" /> Prompt tốt, nội dung chất lượng
                  </button>
                  <button onClick={() => handleRate("bad")} disabled={ratingLoading}
                    className={`flex-1 py-2.5 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${rating === "bad" ? "bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-sm shadow-rose-500/20" : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30"}`}>
                    <ThumbsDown className="w-4 h-4" /> Cần viết lại, chưa phù hợp
                  </button>
                </div>
                {!rating && <p className="text-center text-xs text-muted-foreground/60">Chưa có đánh giá — click để đánh giá</p>}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                {plan.status === "draft" && (
                  <button onClick={handleSendReview} disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50">
                    <Send className="w-4 h-4" /> Gửi phê duyệt
                  </button>
                )}
                {plan.status === "review" && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang chờ phê duyệt
                  </div>
                )}
                <button onClick={() => setEditing(!editing)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all ${editing ? "bg-primary text-white border-primary" : "bg-secondary hover:bg-secondary/80 border-border"}`}>
                  <Edit3 className="w-4 h-4" /> {editing ? "Đang sửa..." : "Chỉnh sửa"}
                </button>
                {editing && (
                  <button onClick={handleSave} disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lưu
                  </button>
                )}
              </div>

              <Field label="Hook (câu mở đầu)" editing={editing} value={plan.hook ?? ""} editValue={form.hook} onChange={v => setForm({ ...form, hook: v })} onCopy={copyText} className="font-semibold text-primary" bg="bg-primary/10 border-primary/20" />
              <Field label="Caption" editing={editing} value={plan.caption ?? ""} editValue={form.caption} onChange={v => setForm({ ...form, caption: v })} onCopy={copyText} multiline minH="min-h-[140px]" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="CTA" editing={editing} value={plan.cta ?? ""} editValue={form.cta} onChange={v => setForm({ ...form, cta: v })} onCopy={copyText} className="text-amber-500 font-medium" />
                <Field label="Hashtags" editing={editing} value={plan.hashtags ?? ""} editValue={form.hashtags} onChange={v => setForm({ ...form, hashtags: v })} onCopy={copyText} className="text-primary text-xs" />
              </div>

              {plan.rejectReason && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm">
                  <div className="font-bold text-rose-400 mb-1">Lý do từ chối:</div>
                  <p className="text-rose-300/80">{plan.rejectReason}</p>
                </div>
              )}

              {plan.imageUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hình đã tạo</label>
                    <button onClick={() => setTab("image")} className="text-xs text-primary hover:underline font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tạo lại</button>
                  </div>
                  <img src={plan.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-48 border border-border/50" />
                </div>
              ) : plan.imagePrompt ? (
                <button onClick={() => setTab("image")} className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-primary/80 hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4" /> Tạo hình AI cho bài này →
                </button>
              ) : null}
            </>
          )}
          {tab === "image" && <ImageGeneratorSection plan={plan} brand={brand} />}
        </div>
      </div>
    </div>
  );
}

// ── Reusable Field ───────────────────────────────────────────────────────────
function Field({ label, editing, value, editValue, onChange, onCopy, className = "", bg = "bg-secondary/30 border-border/50", multiline = false, minH = "min-h-[80px]" }: {
  label: string; editing: boolean; value: string; editValue: string;
  onChange: (v: string) => void; onCopy: (v: string) => void;
  className?: string; bg?: string; multiline?: boolean; minH?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
      {editing
        ? multiline
          ? <textarea value={editValue} onChange={e => onChange(e.target.value)} className={`w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none ${minH}`} />
          : <input value={editValue} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
        : (
          <div className={`p-3 border rounded-xl text-sm relative group ${bg} ${className} ${multiline ? "whitespace-pre-wrap" : ""}`}>
            {value || <span className="text-muted-foreground/40">—</span>}
            {value && <button onClick={() => onCopy(value)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded shadow hover:text-primary transition-all"><Copy className="w-3.5 h-3.5" /></button>}
          </div>
        )}
    </div>
  );
}

// ── Main Calendar Page ───────────────────────────────────────────────────────
export default function ContentCalendar() {
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const [selectedPlan, setSelectedPlan] = useState<ContentPlan | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brands } = useListBrands();
  const { data: plans, isLoading } = useListContentPlans({ brandId: selectedBrand });
  const [localRatings, setLocalRatings] = useState<Record<number, "good" | "bad" | null>>({});

  const resolvedPlans = plans?.map(p => ({
    ...p,
    promptRating: localRatings[p.id] !== undefined ? localRatings[p.id] : (p as any).promptRating,
  })) ?? [];

  const allIds = resolvedPlans.map(p => p.id);
  const allChecked = allIds.length > 0 && allIds.every(id => checkedIds.has(id));
  const someChecked = allIds.some(id => checkedIds.has(id));

  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(allIds));
  };

  const toggleOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Xóa ${checkedIds.size} bài viết đã chọn?`)) return;
    setBulkLoading(true);
    try {
      await bulkDelete(Array.from(checkedIds));
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: `Đã xóa ${checkedIds.size} bài` });
    } catch { toast({ title: "Lỗi xóa", variant: "destructive" }); }
    setBulkLoading(false);
  };

  const handleBulkReview = async () => {
    setBulkLoading(true);
    try {
      await bulkSendReview(Array.from(checkedIds));
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: `Đã gửi duyệt ${checkedIds.size} bài` });
    } catch { toast({ title: "Lỗi gửi duyệt", variant: "destructive" }); }
    setBulkLoading(false);
  };

  const handlePlanUpdated = (updated: ContentPlan) => {
    setLocalRatings(prev => ({ ...prev, [updated.id]: (updated as any).promptRating ?? null }));
    if (selectedPlan?.id === updated.id) setSelectedPlan(updated);
  };

  const goodCount = resolvedPlans.filter(p => (p as any).promptRating === "good").length;
  const badCount = resolvedPlans.filter(p => (p as any).promptRating === "bad").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Lịch Nội dung</h1>
            <p className="mt-2 text-muted-foreground">Quản lý kế hoạch đăng bài trên tất cả nền tảng.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Training data stats */}
            {(goodCount > 0 || badCount > 0) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border border-border/50 rounded-xl text-xs">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-emerald-400 font-bold">{goodCount} tốt</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-rose-400 font-bold">{badCount} cần cải thiện</span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border">
              <Filter className="w-4 h-4 text-muted-foreground ml-2" />
              <select value={selectedBrand || ""} onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
                className="px-2 py-1 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none cursor-pointer">
                <option value="">Tất cả cửa hàng</option>
                {brands?.map(b => <option key={b.id} value={b.id}>{b.brandName}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {someChecked && (
          <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckSquare className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm text-primary">{checkedIds.size} bài đã chọn</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleBulkReview} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Gửi phê duyệt
              </button>
              <button onClick={handleBulkDelete} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
              <button onClick={() => setCheckedIds(new Set())} className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-bold transition-all">
                <X className="w-3.5 h-3.5" /> Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Kế hoạch sắp tới</h2>
            <Link href="/pipeline" className="text-sm text-primary hover:underline font-medium">+ Tạo bài mới</Link>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
          ) : !resolvedPlans.length ? (
            <div className="p-16 text-center text-muted-foreground">Chưa có kế hoạch nội dung nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-secondary/10">
                    <th className="p-4 w-10">
                      <button onClick={toggleAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        {allChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : someChecked ? <MinusSquare className="w-4 h-4 text-primary/70" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="p-4 font-semibold">Ngày đăng</th>
                    <th className="p-4 font-semibold">Nền tảng</th>
                    <th className="p-4 font-semibold w-1/3">Chủ đề & Hook</th>
                    <th className="p-4 font-semibold">Hình</th>
                    <th className="p-4 font-semibold text-center">Đánh giá prompt</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold text-right">Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {resolvedPlans.map(plan => (
                    <tr key={plan.id} className="hover:bg-secondary/20 transition-colors cursor-pointer group" onClick={() => setSelectedPlan(plan as ContentPlan)}>
                      {/* Checkbox */}
                      <td className="p-4" onClick={e => toggleOne(plan.id, e)}>
                        <div className={`flex items-center justify-center w-4 h-4 rounded border transition-all ${checkedIds.has(plan.id) ? "bg-primary border-primary" : "border-border/50 group-hover:border-border"}`}>
                          {checkedIds.has(plan.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{format(new Date(plan.publishDate), "dd/MM/yyyy")}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(plan.publishDate), "HH:mm")}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(plan.platform)}
                          <span className="text-sm font-medium capitalize">{plan.platform}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium line-clamp-1">{plan.topic}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{plan.hook}</p>
                      </td>
                      <td className="p-4">
                        {plan.imageUrl ? (
                          <img src={plan.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/50" />
                        ) : plan.imagePrompt ? (
                          <div className="w-10 h-10 rounded-lg bg-secondary/50 border border-dashed border-primary/30 flex items-center justify-center" title="Có prompt — click để tạo hình">
                            <Sparkles className="w-4 h-4 text-primary/40" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-secondary/30 border border-border/30 flex items-center justify-center">
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          </div>
                        )}
                      </td>
                      {/* Rating buttons */}
                      <td className="p-4">
                        <RatingButtons plan={plan as ContentPlan} onRated={(updated) => handlePlanUpdated(updated)} />
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>{getStatusText(plan.status)}</span>
                      </td>
                      <td className="p-4 text-right">
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto transition-opacity" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedPlan && (
        <PlanModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} onUpdated={handlePlanUpdated} />
      )}
    </AppLayout>
  );
}
