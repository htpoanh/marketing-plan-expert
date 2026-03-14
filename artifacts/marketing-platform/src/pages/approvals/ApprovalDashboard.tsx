import { useState, useRef } from "react";
import {
  useListContentPlans,
  useListBrands,
  useRejectContentPlan,
  getListContentPlansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { X, CheckSquare, Eye, MessageSquareWarning, Loader2, Send, Calendar, Store, ChevronsDown, ChevronsUp, FileText, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Strip ALL marketing model labels (AIDA, PAS, Hook-Value-CTA, Storytelling, BAB, 4P, FAB...)
// Rule: only strip when word is followed by colon (label pattern), not when used naturally in sentences
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  const MARKETING_LABELS =
    /\*{0,2}(Attention|Interest|Desire|Action|Problem|Agitate|Amplify|Lösung|Solution|Hook|Value|CTA|Story|Storytelling|Situation|Challenge|Transformation|Before|After|Bridge|Promise|Picture|Proof|Push|Feature|Advantage|Benefit|AIDA|PAS|BAB|FAB|Schritt\s*\d*|Step\s*\d*|Teil\s*\d*|Phase\s*\d*|Kontext|Hintergrund|Konflikt|Auflösung|Nutzwert|Handlungsaufruf)\*{0,2}:\*{0,2}\s*/gi;
  return text
    .replace(MARKETING_LABELS, "")
    .replace(/\*{1,2}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Helper: default schedule = tomorrow 10:00 (local time)
function defaultScheduleValue(publishDate?: string | Date | null): string {
  const base = publishDate ? new Date(publishDate) : new Date();
  if (!publishDate || base <= new Date()) {
    base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

export default function ApprovalDashboard() {
  const { data: brands = [] } = useListBrands();
  const [activeBrandId, setActiveBrandId] = useState<number | "all">("all");

  const queryParams = activeBrandId === "all"
    ? { status: "review" as const }
    : { status: "review" as const, brandId: activeBrandId };

  const { data: plans, isLoading } = useListContentPlans(queryParams as any);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Record<number, string>>({});
  const [rewritingId, setRewritingId] = useState<{ id: number; direction: "shorter" | "longer" } | null>(null);
  const [localCaptions, setLocalCaptions] = useState<Record<number, string>>({});
  const [selections, setSelections] = useState<Record<number, { start: number; end: number; text: string } | null>>({});
  const [rewritingSelectionId, setRewritingSelectionId] = useState<{ id: number; direction: "shorter" | "longer" } | null>(null);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const rejectMutation = useRejectContentPlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey({ status: "review" }) });
        setRejectingId(null);
        setRejectReason("");
        toast({ title: "Đã từ chối", description: "Bài đăng đã được trả lại." });
      },
    },
  });

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectingId) rejectMutation.mutate({ id: rejectingId, data: { reason: rejectReason } });
  };

  const getSchedule = (plan: { id: number; publishDate: string | Date }) =>
    schedules[plan.id] ?? defaultScheduleValue(plan.publishDate);

  const handleApproveAndPublish = async (planId: number, scheduledLocal: string) => {
    setPublishingId(planId);
    try {
      const localDate = new Date(scheduledLocal);
      if (isNaN(localDate.getTime())) throw new Error("Ngày giờ không hợp lệ");
      if (localDate <= new Date()) throw new Error("Ngày giờ phải ở tương lai");

      const approveRes = await fetch(`${BASE}/api/content-plans/${planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Duyệt thất bại HTTP ${approveRes.status}`);
      }

      const pubRes = await fetch(`${BASE}/api/content-plans/${planId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: localDate.toISOString() }),
      });
      const pubData = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok) throw new Error(pubData.error ?? `Đăng thất bại HTTP ${pubRes.status}`);

      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey({ status: "review" }) });
      const dateStr = localDate.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
      toast({ title: "✅ Đã duyệt & Lên lịch Metricool", description: `Bài #${planId} lên lịch lúc ${dateStr}.` });
    } catch (e: any) {
      toast({ title: "❌ Thất bại", description: e.message, variant: "destructive" });
    } finally {
      setPublishingId(null);
    }
  };

  const handleRewrite = async (planId: number, direction: "shorter" | "longer") => {
    setRewritingId({ id: planId, direction });
    try {
      const res = await fetch(`${BASE}/api/content-plans/${planId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLocalCaptions(prev => ({ ...prev, [planId]: cleanText(data.plan?.caption ?? "") }));
      const label = direction === "shorter" ? "ngắn hơn" : "dài hơn";
      toast({ title: `✅ Đã viết lại ${label}`, description: `${data.wordCount ?? "?"} từ` });
    } catch (e: any) {
      toast({ title: "❌ Lỗi viết lại", description: e.message, variant: "destructive" });
    } finally {
      setRewritingId(null);
    }
  };

  const handleSelectionChange = (planId: number) => {
    const el = textareaRefs.current[planId];
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = el.value.slice(start, end).trim();
    if (text.length > 8) {
      setSelections(prev => ({ ...prev, [planId]: { start, end, text } }));
    } else {
      setSelections(prev => ({ ...prev, [planId]: null }));
    }
  };

  const handleRewriteSelection = async (planId: number, direction: "shorter" | "longer", brandId: number) => {
    const sel = selections[planId];
    if (!sel || !sel.text) return;
    setRewritingSelectionId({ id: planId, direction });
    try {
      const res = await fetch(`${BASE}/api/content-plans/rewrite-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sel.text, direction, brandId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // Replace only the selected portion in the caption
      const current = localCaptions[planId] ?? cleanText((plans as any[])?.find((p: any) => p.id === planId)?.caption);
      const newCaption = current.slice(0, sel.start) + data.result + current.slice(sel.end);
      setLocalCaptions(prev => ({ ...prev, [planId]: newCaption }));
      setSelections(prev => ({ ...prev, [planId]: null }));
      const label = direction === "shorter" ? "ngắn hơn" : "dài hơn";
      toast({ title: `✅ Đoạn đã viết lại ${label}`, description: `${data.wordCount ?? "?"} từ → ${data.result.slice(0, 40)}…` });
    } catch (e: any) {
      toast({ title: "❌ Lỗi viết lại đoạn", description: e.message, variant: "destructive" });
    } finally {
      setRewritingSelectionId(null);
    }
  };

  // Count pending per brand
  const pendingByBrand: Record<number, number> = {};
  if (activeBrandId === "all" && Array.isArray(plans)) {
    plans.forEach((p: any) => {
      pendingByBrand[p.brandId] = (pendingByBrand[p.brandId] ?? 0) + 1;
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-emerald-400" />
            Phê duyệt Nội dung
          </h1>
          <p className="mt-2 text-muted-foreground">
            Xem lại nội dung AI tạo, chọn ngày giờ đăng, rồi duyệt để lên lịch Metricool.
          </p>
        </div>

        {/* Store tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveBrandId("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              activeBrandId === "all"
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Store className="w-4 h-4" />
            Tất cả
            {Array.isArray(plans) && activeBrandId === "all" && plans.length > 0 && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{plans.length}</span>
            )}
          </button>
          {brands.map((b: any) => {
            const count = pendingByBrand[b.id] ?? 0;
            const isActive = activeBrandId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBrandId(b.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                    : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Store className="w-4 h-4" />
                {b.brandName}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-amber-500/20 text-amber-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-48 bg-card rounded-2xl border border-border/50"></div>)}
          </div>
        ) : !plans || plans.length === 0 ? (
          <div className="h-64 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center">
            <CheckSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold">Không có bài viết nào cần duyệt</h3>
            <p className="text-muted-foreground">
              {activeBrandId === "all" ? "Bạn đã xử lý hết tất cả!" : `Cửa hàng này chưa có bài nào chờ duyệt.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {plans.map((plan: any) => {
              const brandName = brands.find((b: any) => b.id === plan.brandId)?.brandName;
              const displayCaption = localCaptions[plan.id] ?? cleanText(plan.caption);
              const wordCount = displayCaption.split(/\s+/).filter(Boolean).length;
              const isRewritingShorter = rewritingId?.id === plan.id && rewritingId.direction === "shorter";
              const isRewritingLonger = rewritingId?.id === plan.id && rewritingId.direction === "longer";
              const anyRewriting = isRewritingShorter || isRewritingLonger;
              const sel = selections[plan.id];
              const isRewritingSelShorter = rewritingSelectionId?.id === plan.id && rewritingSelectionId.direction === "shorter";
              const isRewritingSelLonger = rewritingSelectionId?.id === plan.id && rewritingSelectionId.direction === "longer";
              const anyRewritingSel = isRewritingSelShorter || isRewritingSelLonger;

              return (
                <div key={plan.id} className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col lg:flex-row">
                  {/* Content preview */}
                  <div className="p-6 flex-1 border-b lg:border-b-0 lg:border-r border-border/50">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      {brandName && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                          <Store className="w-3 h-3" /> {brandName}
                        </span>
                      )}
                      <span className="px-3 py-1 bg-secondary text-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                        {plan.platform}
                      </span>
                      <span className="px-2 py-0.5 text-xs text-muted-foreground border border-border/40 rounded-full">
                        {plan.contentType}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold mb-3 text-primary">{cleanText(plan.hook) || plan.topic}</h3>

                    <div className="relative mb-3">
                      <textarea
                        ref={el => { textareaRefs.current[plan.id] = el; }}
                        value={displayCaption}
                        onChange={e => setLocalCaptions(prev => ({ ...prev, [plan.id]: e.target.value }))}
                        onSelect={() => handleSelectionChange(plan.id)}
                        onMouseUp={() => handleSelectionChange(plan.id)}
                        onKeyUp={() => handleSelectionChange(plan.id)}
                        rows={6}
                        disabled={anyRewriting || anyRewritingSel || publishingId === plan.id}
                        className={`w-full p-4 bg-secondary/30 rounded-xl border border-border/50 text-sm text-foreground/90 resize-y leading-relaxed transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/30 ${anyRewriting || anyRewritingSel ? "opacity-40" : "opacity-100"}`}
                      />
                      {/* Floating selection rewrite toolbar */}
                      {sel && !anyRewriting && !anyRewritingSel && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 bg-card border border-border shadow-lg rounded-full z-10 animate-in fade-in slide-in-from-bottom-2 duration-150">
                          <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-medium mr-1">Đoạn đã chọn:</span>
                          <button
                            onClick={() => handleRewriteSelection(plan.id, "shorter", plan.brandId)}
                            disabled={anyRewritingSel}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            {isRewritingSelShorter ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronsDown className="w-3 h-3" />}
                            Ngắn lại
                          </button>
                          <button
                            onClick={() => handleRewriteSelection(plan.id, "longer", plan.brandId)}
                            disabled={anyRewritingSel}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-500 text-white hover:bg-violet-600 transition-colors disabled:opacity-50"
                          >
                            {isRewritingSelLonger ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronsUp className="w-3 h-3" />}
                            Dài hơn
                          </button>
                          <button
                            onClick={() => setSelections(prev => ({ ...prev, [plan.id]: null }))}
                            className="ml-1 p-1 rounded-full hover:bg-secondary transition-colors text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {plan.cta && !plan.caption?.includes(plan.cta) && (
                      <p className="text-sm font-semibold text-amber-400 mb-2">{cleanText(plan.cta)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mb-3">{plan.hashtags}</p>

                    {/* Rewrite controls */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${
                        wordCount > 220 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-secondary border-border/50 text-muted-foreground"
                      }`}>
                        <FileText className="w-3 h-3" />
                        {wordCount} từ {wordCount > 220 && <span className="text-amber-600">/ 250 max</span>}
                      </span>
                      <button
                        onClick={() => handleRewrite(plan.id, "shorter")}
                        disabled={anyRewriting || anyRewritingSel || publishingId === plan.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isRewritingShorter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronsDown className="w-3.5 h-3.5" />}
                        Viết ngắn hơn (toàn bài)
                      </button>
                      <button
                        onClick={() => handleRewrite(plan.id, "longer")}
                        disabled={anyRewriting || anyRewritingSel || publishingId === plan.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isRewritingLonger ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronsUp className="w-3.5 h-3.5" />}
                        Viết dài hơn (toàn bài)
                      </button>
                      {!sel && (
                        <span className="text-xs text-muted-foreground italic">· Bôi đen đoạn bất kỳ để viết lại ngắn/dài</span>
                      )}
                    </div>

                    {plan.imagePrompt && (
                      <div className="text-xs text-muted-foreground flex items-start gap-2">
                        <Eye className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                        <span className="italic">Gợi ý hình ảnh: {plan.imagePrompt}</span>
                      </div>
                    )}
                  </div>

                  {/* Action panel */}
                  <div className="p-6 lg:w-72 bg-secondary/10 flex flex-col justify-start gap-4">
                    {rejectingId === plan.id ? (
                      <form onSubmit={handleReject} className="space-y-3 animate-in fade-in zoom-in-95">
                        <label className="text-sm font-medium flex items-center gap-2 text-rose-500">
                          <MessageSquareWarning className="w-4 h-4" /> Lý do từ chối
                        </label>
                        <textarea
                          autoFocus
                          required
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="w-full p-3 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-rose-500 outline-none"
                          placeholder="Yêu cầu sửa lại nội dung..."
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setRejectingId(null)} className="flex-1 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80 font-medium">Hủy</button>
                          <button type="submit" disabled={rejectMutation.isPending} className="flex-1 py-2 rounded-lg text-sm bg-rose-500 hover:bg-rose-600 text-white font-bold">Xác nhận</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Calendar className="w-3.5 h-3.5" /> Thời gian đăng
                          </label>
                          <input
                            type="datetime-local"
                            value={getSchedule(plan)}
                            onChange={e => setSchedules(s => ({ ...s, [plan.id]: e.target.value }))}
                            min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                          />
                          <p className="text-xs text-muted-foreground">Giờ địa phương (Berlin/Kempten)</p>
                        </div>

                        <button
                          onClick={() => handleApproveAndPublish(plan.id, getSchedule(plan))}
                          disabled={publishingId === plan.id}
                          className="w-full py-4 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                        >
                          {publishingId === plan.id ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Đang lên lịch...</>
                          ) : (
                            <><Send className="w-5 h-5" /> Duyệt & Lên lịch</>
                          )}
                        </button>

                        <button
                          onClick={() => setRejectingId(plan.id)}
                          disabled={publishingId === plan.id}
                          className="w-full py-3 rounded-xl font-bold bg-card border border-border hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          <X className="w-5 h-5" /> Từ chối
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
