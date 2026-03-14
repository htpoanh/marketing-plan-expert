import { useState } from "react";
import { useListContentPlans, useListBrands, useUpdateContentPlan, getListContentPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { Calendar, Filter, Facebook, Instagram, Eye, Send, X, Copy, Sparkles, Image, Loader2, Edit3, Check, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { ContentPlan } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function generateImage(planId: number): Promise<{ imageUrl: string }> {
  const res = await fetch(`${BASE}/api/content-plans/${planId}/generate-image`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Lỗi tạo hình ảnh");
  }
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

function PlanModal({ plan, onClose, onUpdated }: { plan: ContentPlan; onClose: () => void; onUpdated: (p: ContentPlan) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateContentPlan({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
        onUpdated(updated);
      }
    }
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    hook: plan.hook ?? "",
    caption: plan.caption ?? "",
    cta: plan.cta ?? "",
    hashtags: plan.hashtags ?? "",
    imagePrompt: plan.imagePrompt ?? "",
    videoPrompt: plan.videoPrompt ?? "",
  });
  const [generatingImg, setGeneratingImg] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState(plan.imageUrl ?? "");

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

  const handleGenerateImage = async () => {
    setGeneratingImg(true);
    try {
      const { imageUrl } = await generateImage(plan.id);
      setLocalImageUrl(imageUrl);
      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey() });
      toast({ title: "Đã tạo hình ảnh!", description: "Hình DALL-E đã được lưu vào bài viết" });
    } catch (e: any) {
      toast({ title: "Lỗi tạo hình", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingImg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/50 p-5 flex items-center justify-between">
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
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {plan.status === "draft" && (
              <button
                onClick={handleSendReview}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Gửi phê duyệt
              </button>
            )}
            {plan.status === "review" && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang chờ phê duyệt
              </div>
            )}
            {plan.status === "approved" && (
              <Link href="/approvals" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg transition-all">
                <Check className="w-4 h-4" /> Đã duyệt · Xem lịch đăng
              </Link>
            )}
            <button
              onClick={() => setEditing(!editing)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all ${editing ? "bg-primary text-white border-primary" : "bg-secondary hover:bg-secondary/80 border-border"}`}
            >
              <Edit3 className="w-4 h-4" />
              {editing ? "Đang sửa..." : "Chỉnh sửa"}
            </button>
            {editing && (
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Lưu
              </button>
            )}
          </div>

          {/* Hook */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hook (câu mở đầu)</label>
            {editing ? (
              <textarea value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })}
                className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none min-h-[80px]" />
            ) : (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-semibold text-primary flex items-start justify-between gap-2">
                <span>{plan.hook || "—"}</span>
                {plan.hook && <button onClick={() => copyText(plan.hook!)} className="shrink-0 p-1 hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>}
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Caption</label>
            {editing ? (
              <textarea value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })}
                className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none min-h-[140px]" />
            ) : (
              <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-sm whitespace-pre-wrap relative group">
                {plan.caption || "—"}
                {plan.caption && (
                  <button onClick={() => copyText(plan.caption!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded-md shadow hover:text-primary transition-all">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CTA + Hashtags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CTA</label>
              {editing ? (
                <input value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })}
                  className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
              ) : (
                <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-sm font-medium text-amber-500">
                  {plan.cta || "—"}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hashtags</label>
              {editing ? (
                <input value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })}
                  className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
              ) : (
                <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-xs text-primary font-medium">
                  {plan.hashtags || "—"}
                </div>
              )}
            </div>
          </div>

          {/* Image section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" /> Hình ảnh
              </label>
              {plan.imagePrompt && (
                <button
                  onClick={handleGenerateImage}
                  disabled={generatingImg}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  {generatingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingImg ? "Đang tạo..." : "Tạo hình DALL-E"}
                </button>
              )}
            </div>

            {localImageUrl ? (
              <div className="rounded-xl overflow-hidden border border-border/50 bg-secondary/20">
                <img src={localImageUrl} alt="Generated" className="w-full object-cover max-h-80" />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border/50 bg-secondary/10 p-6 text-center text-sm text-muted-foreground">
                {plan.imagePrompt ? "Nhấn \"Tạo hình DALL-E\" để tạo hình ảnh từ prompt" : "Chưa có image prompt"}
              </div>
            )}

            {/* Image prompt */}
            {(plan.imagePrompt || editing) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Image Prompt (cho DALL-E/Midjourney)</label>
                {editing ? (
                  <textarea value={form.imagePrompt} onChange={e => setForm({ ...form, imagePrompt: e.target.value })}
                    className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/50 outline-none resize-none min-h-[80px] font-mono" />
                ) : (
                  <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-xs text-muted-foreground font-mono relative group">
                    {plan.imagePrompt}
                    <button onClick={() => copyText(plan.imagePrompt!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded-md shadow hover:text-primary transition-all">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video Prompt */}
          {(plan.videoPrompt || editing) && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Video Prompt (HailuoAI/Sora)</label>
              {editing ? (
                <textarea value={form.videoPrompt} onChange={e => setForm({ ...form, videoPrompt: e.target.value })}
                  className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/50 outline-none resize-none min-h-[80px] font-mono" />
              ) : (
                <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-xs text-muted-foreground font-mono relative group">
                  {plan.videoPrompt}
                  <button onClick={() => copyText(plan.videoPrompt!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-background rounded-md shadow hover:text-primary transition-all">
                    <Copy className="w-3 h-3" />
                  </button>
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
        </div>
      </div>
    </div>
  );
}

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
            <select
              value={selectedBrand || ""}
              onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
              className="px-2 py-1 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none cursor-pointer"
            >
              <option value="">Tất cả cửa hàng</option>
              {brands?.map(b => (
                <option key={b.id} value={b.id}>{b.brandName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Kế hoạch sắp tới
            </h2>
            <Link href="/pipeline" className="text-sm text-primary hover:underline font-medium">
              + Tạo bài mới
            </Link>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : !plans || plans.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              Chưa có kế hoạch nội dung nào.
            </div>
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
                    <th className="p-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {plans.map(plan => (
                    <tr
                      key={plan.id}
                      className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                      onClick={() => setSelectedPlan(plan)}
                    >
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
                          <div className="w-10 h-10 rounded-lg bg-secondary/50 border border-dashed border-border flex items-center justify-center" title="Có prompt, chưa tạo hình">
                            <Image className="w-4 h-4 text-muted-foreground/50" />
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
                        <button
                          className="p-2 hover:bg-secondary rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-xs font-medium ml-auto"
                          onClick={e => { e.stopPropagation(); setSelectedPlan(plan); }}
                        >
                          <Eye className="w-4 h-4" />
                          <ChevronRight className="w-3 h-3" />
                        </button>
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
