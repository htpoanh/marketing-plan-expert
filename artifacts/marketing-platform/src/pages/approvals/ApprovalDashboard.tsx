import { useState } from "react";
import { 
  useListContentPlans, 
  useRejectContentPlan,
  getListContentPlansQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { X, CheckSquare, Eye, MessageSquareWarning, Loader2, Send, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Strip AIDA labels + ALL markdown bold/italic markers
// (Facebook/Instagram don't render ** markdown anyway)
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    // Remove AIDA label patterns first
    .replace(/\*{0,2}A[-‑]?ttention\*{0,2}:?\*{0,2}\s*/gi, "")
    .replace(/\*{0,2}I[-‑]?nterest\*{0,2}:?\*{0,2}\s*/gi, "")
    .replace(/\*{0,2}D[-‑]?esire\*{0,2}:?\*{0,2}\s*/gi, "")
    .replace(/\*{0,2}A[-‑]?ction\*{0,2}:?\*{0,2}\s*/gi, "")
    // Strip all remaining markdown bold/italic markers (**)
    .replace(/\*{1,2}/g, "")
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Helper: default schedule = tomorrow 10:00 Berlin (local input value)
function defaultScheduleValue(publishDate?: string | Date | null): string {
  const base = publishDate ? new Date(publishDate) : new Date();
  if (!publishDate || base <= new Date()) {
    base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
  }
  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

export default function ApprovalDashboard() {
  const { data: plans, isLoading } = useListContentPlans({ status: 'review' });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [publishingId, setPublishingId] = useState<number | null>(null);
  // Tracks user-chosen schedule per post
  const [schedules, setSchedules] = useState<Record<number, string>>({});

  const rejectMutation = useRejectContentPlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey({ status: 'review' }) });
        setRejectingId(null);
        setRejectReason("");
        toast({ title: "Đã từ chối", description: "Bài đăng đã được trả lại để chỉnh sửa." });
      }
    }
  });

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectingId) {
      rejectMutation.mutate({ id: rejectingId, data: { reason: rejectReason } });
    }
  };

  const getSchedule = (plan: { id: number; publishDate: string | Date }) =>
    schedules[plan.id] ?? defaultScheduleValue(plan.publishDate);

  // Approve + Publish to Metricool at the chosen time
  const handleApproveAndPublish = async (planId: number, scheduledLocal: string) => {
    setPublishingId(planId);
    try {
      // Convert datetime-local value (local Berlin time) to ISO UTC
      const localDate = new Date(scheduledLocal);
      if (isNaN(localDate.getTime())) throw new Error("Ngày giờ không hợp lệ");
      if (localDate <= new Date()) throw new Error("Ngày giờ phải ở tương lai");

      // Step 1: Approve
      const approveRes = await fetch(`${BASE}/api/content-plans/${planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Duyệt thất bại HTTP ${approveRes.status}`);
      }

      // Step 2: Publish to Metricool with chosen time
      const pubRes = await fetch(`${BASE}/api/content-plans/${planId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: localDate.toISOString() }),
      });
      const pubData = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok) {
        throw new Error(pubData.error ?? `Đăng thất bại HTTP ${pubRes.status}`);
      }

      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey({ status: 'review' }) });
      const dateStr = localDate.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
      toast({
        title: "✅ Đã duyệt & Lên lịch Metricool",
        description: `Bài đăng #${planId} được lên lịch lúc ${dateStr}.`,
      });
    } catch (e: any) {
      toast({
        title: "❌ Thất bại",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-emerald-400" />
            Phê duyệt Nội dung
          </h1>
          <p className="mt-2 text-muted-foreground">
            Xem lại nội dung AI tạo, chọn ngày giờ đăng, rồi duyệt để lên lịch Metricool.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-48 bg-card rounded-2xl"></div>)}
          </div>
        ) : !plans || plans.length === 0 ? (
          <div className="h-64 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center">
            <CheckSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold">Không có bài viết nào cần duyệt</h3>
            <p className="text-muted-foreground">Bạn đã xử lý hết tất cả công việc!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {plans.map(plan => (
              <div key={plan.id} className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col lg:flex-row">

                {/* Content preview */}
                <div className="p-6 flex-1 border-b lg:border-b-0 lg:border-r border-border/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-secondary text-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                      {plan.platform}
                    </span>
                    <span className="px-2 py-0.5 text-xs text-muted-foreground border border-border/40 rounded-full">
                      {plan.contentType}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-1 text-primary">{cleanText(plan.hook) || plan.topic}</h3>

                  <div className="p-4 bg-secondary/30 rounded-xl mb-4 border border-border/50 space-y-2">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{cleanText(plan.caption)}</p>
                    {plan.cta && !plan.caption?.includes(plan.cta) && (
                      <p className="text-sm font-semibold text-amber-400">{cleanText(plan.cta)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{plan.hashtags}</p>
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
                        placeholder="Yêu cầu sửa lại hook, thay đổi nội dung..."
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRejectingId(null)} className="flex-1 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80 font-medium">Hủy</button>
                        <button type="submit" disabled={rejectMutation.isPending} className="flex-1 py-2 rounded-lg text-sm bg-rose-500 hover:bg-rose-600 text-white font-bold">Xác nhận</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* Date/time picker */}
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
                        <p className="text-xs text-muted-foreground">Giờ theo múi giờ địa phương</p>
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
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
