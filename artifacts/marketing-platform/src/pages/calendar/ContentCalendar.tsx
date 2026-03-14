import { useState, useRef } from "react";
import { useListContentPlans, useListBrands, useUpdateContentPlan, getListContentPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import {
  Calendar, Filter, Facebook, Instagram, Send, X, Copy, Sparkles,
  Image, Loader2, Edit3, Check, ChevronRight, Upload, Download, Trash2,
  RefreshCw, Bot, Eye, ChevronDown, ChevronUp, Wand2,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { ContentPlan } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Provider = "dalle3" | "gpt-image-1" | "imagen3";

const PROVIDERS: { id: Provider; label: string; desc: string; color: string }[] = [
  { id: "dalle3", label: "DALL-E 3", desc: "Chân thực, chi tiết cao — tốt nhất cho sản phẩm & không gian", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { id: "gpt-image-1", label: "GPT-Image", desc: "Sáng tạo & linh hoạt hơn, theo sát phong cách thương hiệu", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { id: "imagen3", label: "Google Imagen 3", desc: "Nghệ thuật & phong cách đa dạng — tốt cho lifestyle & fashion", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
];

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

// ── Image Generator Section ─────────────────────────────────────────────────
function ImageGeneratorSection({ plan, brand }: { plan: ContentPlan; brand?: any }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<Provider>("dalle3");
  const [referenceImages, setReferenceImages] = useState<string[]>([]); // base64 data URLs
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ provider: Provider; imageUrl: string; enrichedPrompt?: string }[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [styleDescription, setStyleDescription] = useState("");

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newImages: string[] = [];
    let remaining = 3 - referenceImages.length;
    Array.from(files).slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setReferenceImages(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, result];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const removeRef = (idx: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/api/content-plans/${plan.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          referenceImages,
          saveToDb: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi tạo hình");

      const imageUrl = data.imageUrl ?? data.imageBase64;
      setResults(prev => [
        { provider: selectedProvider, imageUrl, enrichedPrompt: data.enrichedPrompt },
        ...prev.filter(r => r.provider !== selectedProvider),
      ]);
      if (data.styleDescription) setStyleDescription(data.styleDescription);
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: "Tạo hình thành công!", description: `${PROVIDERS.find(p => p.id === selectedProvider)?.label} đã tạo xong` });
    } catch (e: any) {
      toast({ title: "Lỗi tạo hình", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (url: string, provider: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.topic.replace(/\s+/g, "_")}_${provider}.png`;
    a.target = "_blank";
    a.click();
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy!" });
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
          {referenceImages.length > 0 && (
            <span className="text-xs text-emerald-400 font-medium">AI sẽ học theo phong cách này</span>
          )}
        </div>

        <div
          className="border-2 border-dashed border-border/50 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onDrop={handleDrop}
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
                  <img src={img} alt={`ref ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border/50" />
                  <button
                    onClick={() => removeRef(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-xs">Thêm</span>
                </button>
              )}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
      </div>

      {/* Style description from analysis */}
      {styleDescription && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> Phân tích phong cách từ hình mẫu:
          </p>
          <p className="text-xs text-emerald-300/80 leading-relaxed">{styleDescription}</p>
        </div>
      )}

      {/* Brand style info */}
      {brand && (
        <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl">
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> Dữ liệu training thương hiệu (tự động thêm vào prompt):
          </p>
          <div className="flex flex-wrap gap-2">
            {brand.industry && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">{brand.industry}</span>}
            {brand.brandVoice && <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full border border-border/50 max-w-[200px] truncate">{brand.brandVoice}</span>}
            {brand.targetAudience && <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full border border-border/50 max-w-[200px] truncate">{brand.targetAudience}</span>}
          </div>
        </div>
      )}

      {/* Provider selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chọn AI tạo hình</label>
        <div className="grid grid-cols-1 gap-2">
          {PROVIDERS.map(prov => (
            <button
              key={prov.id}
              onClick={() => setSelectedProvider(prov.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedProvider === prov.id ? prov.color + " ring-2 ring-current/30" : "border-border/50 bg-secondary/20 hover:bg-secondary/40"}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${selectedProvider === prov.id ? "border-current" : "border-border"}`}>
                {selectedProvider === prov.id && <div className="w-2 h-2 rounded-full bg-current" />}
              </div>
              <div>
                <div className="text-sm font-bold">{prov.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{prov.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-primary text-white shadow-lg shadow-purple-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0"
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {referenceImages.length > 0 ? "Đang phân tích phong cách & tạo hình..." : "Đang tạo hình..."}
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Tạo hình với {PROVIDERS.find(p => p.id === selectedProvider)?.label}
          </>
        )}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Image className="w-3.5 h-3.5" />
            Kết quả ({results.length} phiên bản)
            <span className="text-primary/60 font-normal normal-case">— Thử nhiều AI để chọn hình đẹp nhất</span>
          </div>
          {results.map((r, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-b border-border/50">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${PROVIDERS.find(p => p.id === r.provider)?.color ?? ""}`}>
                  {PROVIDERS.find(p => p.id === r.provider)?.label}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => window.open(r.imageUrl, "_blank")} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Xem full">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => downloadImage(r.imageUrl, r.provider)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors" title="Tải về">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <img src={r.imageUrl} alt={r.provider} className="w-full rounded-lg object-cover max-h-64" />
              </div>
              {r.enrichedPrompt && (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Xem prompt đã dùng
                  </button>
                  {showPrompt && (
                    <div className="mt-2 p-2 bg-secondary/30 rounded-lg text-xs text-muted-foreground font-mono relative group">
                      {r.enrichedPrompt}
                      <button onClick={() => copyText(r.enrichedPrompt!)} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 bg-background rounded shadow hover:text-primary transition-all">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image prompt info */}
      {plan.imagePrompt && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Prompt gốc (từ Pipeline AI):</label>
          <div className="p-3 bg-secondary/20 rounded-xl text-xs text-muted-foreground font-mono border border-border/30 relative group">
            {plan.imagePrompt}
            <button onClick={() => copyText(plan.imagePrompt!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded shadow hover:text-primary transition-all">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Detail Modal ────────────────────────────────────────────────────────
function PlanModal({ plan, onClose, onUpdated }: { plan: ContentPlan; onClose: () => void; onUpdated: (p: ContentPlan) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const brand = brands?.find(b => b.id === plan.brandId);

  const updateMutation = useUpdateContentPlan({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
        onUpdated(updated);
      }
    }
  });

  const [tab, setTab] = useState<"content" | "image">("content");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    hook: plan.hook ?? "",
    caption: plan.caption ?? "",
    cta: plan.cta ?? "",
    hashtags: plan.hashtags ?? "",
    imagePrompt: plan.imagePrompt ?? "",
    videoPrompt: plan.videoPrompt ?? "",
  });

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy!" });
  };

  const handleSave = () => {
    updateMutation.mutate({ id: plan.id, data: { ...form } }, {
      onSuccess: () => {
        setEditing(false);
        toast({ title: "Đã lưu", description: "Cập nhật nội dung thành công" });
      }
    });
  };

  const handleSendReview = () => {
    updateMutation.mutate({ id: plan.id, data: { status: "review" } }, {
      onSuccess: () => {
        toast({ title: "Đã gửi phê duyệt", description: "Bài viết đang chờ kiểm duyệt" });
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
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
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>
                {getStatusText(plan.status)}
              </span>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-xl">
            <button onClick={() => setTab("content")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "content" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Nội dung
            </button>
            <button onClick={() => setTab("image")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === "image" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Sparkles className="w-3.5 h-3.5" /> Tạo hình AI
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">

          {tab === "content" && (
            <>
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
                {plan.status === "approved" && (
                  <Link href="/approvals" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg transition-all">
                    <Check className="w-4 h-4" /> Đã duyệt
                  </Link>
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

              {/* Hook */}
              <Field label="Hook (câu mở đầu)" editing={editing} value={plan.hook ?? ""} editValue={form.hook}
                onChange={v => setForm({ ...form, hook: v })} onCopy={copyText}
                className="font-semibold text-primary" bg="bg-primary/10 border-primary/20" />

              {/* Caption */}
              <Field label="Caption" editing={editing} value={plan.caption ?? ""} editValue={form.caption}
                onChange={v => setForm({ ...form, caption: v })} onCopy={copyText} multiline minH="min-h-[140px]" />

              {/* CTA + Hashtags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="CTA" editing={editing} value={plan.cta ?? ""} editValue={form.cta}
                  onChange={v => setForm({ ...form, cta: v })} onCopy={copyText} className="text-amber-500 font-medium" />
                <Field label="Hashtags" editing={editing} value={plan.hashtags ?? ""} editValue={form.hashtags}
                  onChange={v => setForm({ ...form, hashtags: v })} onCopy={copyText} className="text-primary text-xs" />
              </div>

              {/* Video Prompt */}
              {(plan.videoPrompt || editing) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Video Prompt (HailuoAI / Sora / Kling)</label>
                  {editing ? (
                    <textarea value={form.videoPrompt} onChange={e => setForm({ ...form, videoPrompt: e.target.value })}
                      className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/50 outline-none resize-none min-h-[80px] font-mono" />
                  ) : (
                    <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-xs text-muted-foreground font-mono relative group">
                      {plan.videoPrompt}
                      <button onClick={() => copyText(plan.videoPrompt!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded shadow hover:text-primary transition-all"><Copy className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Reject reason */}
              {plan.rejectReason && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm">
                  <div className="font-bold text-rose-400 mb-1">Lý do từ chối:</div>
                  <p className="text-rose-300/80">{plan.rejectReason}</p>
                </div>
              )}

              {/* Quick image preview */}
              {plan.imageUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hình đã tạo</label>
                    <button onClick={() => setTab("image")} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Tạo lại / Thử AI khác
                    </button>
                  </div>
                  <img src={plan.imageUrl} alt="Generated" className="w-full rounded-xl object-cover max-h-48 border border-border/50" />
                </div>
              )}
              {!plan.imageUrl && plan.imagePrompt && (
                <button onClick={() => setTab("image")} className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-primary/80 hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4" /> Tạo hình AI cho bài này →
                </button>
              )}
            </>
          )}

          {tab === "image" && (
            <ImageGeneratorSection plan={plan} brand={brand} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable field component ─────────────────────────────────────────────────
function Field({ label, editing, value, editValue, onChange, onCopy, className = "", bg = "bg-secondary/30 border-border/50", multiline = false, minH = "min-h-[80px]" }: {
  label: string; editing: boolean; value: string; editValue: string;
  onChange: (v: string) => void; onCopy: (v: string) => void;
  className?: string; bg?: string; multiline?: boolean; minH?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
      {editing ? (
        multiline
          ? <textarea value={editValue} onChange={e => onChange(e.target.value)} className={`w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none ${minH}`} />
          : <input value={editValue} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
      ) : (
        <div className={`p-3 border rounded-xl text-sm relative group ${bg} ${className} ${multiline ? "whitespace-pre-wrap" : ""}`}>
          {value || <span className="text-muted-foreground/40">—</span>}
          {value && (
            <button onClick={() => onCopy(value)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded shadow hover:text-primary transition-all">
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Calendar Page ───────────────────────────────────────────────────────
export default function ContentCalendar() {
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const [selectedPlan, setSelectedPlan] = useState<ContentPlan | null>(null);
  const { data: brands } = useListBrands();
  const { data: plans, isLoading } = useListContentPlans({ brandId: selectedBrand });

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Lịch Nội dung
            </h1>
            <p className="mt-2 text-muted-foreground">Quản lý kế hoạch đăng bài trên tất cả nền tảng.</p>
          </div>
          <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            <select value={selectedBrand || ""} onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
              className="px-2 py-1 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none cursor-pointer">
              <option value="">Tất cả cửa hàng</option>
              {brands?.map(b => <option key={b.id} value={b.id}>{b.brandName}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Kế hoạch sắp tới
            </h2>
            <Link href="/pipeline" className="text-sm text-primary hover:underline font-medium">+ Tạo bài mới</Link>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
          ) : !plans || plans.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">Chưa có kế hoạch nội dung nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-secondary/10">
                    <th className="p-4 font-semibold">Ngày đăng</th>
                    <th className="p-4 font-semibold">Nền tảng</th>
                    <th className="p-4 font-semibold w-1/3">Chủ đề & Hook</th>
                    <th className="p-4 font-semibold">Hình</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold text-right">Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-secondary/20 transition-colors cursor-pointer group" onClick={() => setSelectedPlan(plan)}>
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
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>
                          {getStatusText(plan.status)}
                        </span>
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
        <PlanModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onUpdated={(updated) => setSelectedPlan(updated)}
        />
      )}
    </AppLayout>
  );
}
