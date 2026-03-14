import { useState } from "react";
import { 
  useListContentPlans, 
  useApproveContentPlan, 
  useRejectContentPlan,
  getListContentPlansQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Check, X, CheckSquare, Eye, MessageSquareWarning, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ApprovalDashboard() {
  const { data: plans, isLoading } = useListContentPlans({ status: 'review' });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [publishingId, setPublishingId] = useState<number | null>(null);

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

  // Approve + Publish to Metricool in one step
  const handleApproveAndPublish = async (planId: number) => {
    setPublishingId(planId);
    try {
      // Step 1: Approve
      const approveRes = await fetch(`${BASE}/api/content-plans/${planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Approve thất bại HTTP ${approveRes.status}`);
      }

      // Step 2: Publish to Metricool
      const pubRes = await fetch(`${BASE}/api/content-plans/${planId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const pubData = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok) {
        throw new Error(pubData.error ?? `Đăng thất bại HTTP ${pubRes.status}`);
      }

      queryClient.invalidateQueries({ queryKey: getListContentPlansQueryKey({ status: 'review' }) });
      toast({
        title: "✅ Đã duyệt & Đăng lên Metricool",
        description: `Bài đăng #${planId} đã được lên lịch thành công.`,
      });
    } catch (e: any) {
      toast({
        title: "❌ Đăng thất bại",
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
            Kiểm duyệt các bài đăng do AI tạo trước khi xuất bản lên Metricool.
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
                <div className="p-6 flex-1 border-b lg:border-b-0 lg:border-r border-border/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-secondary text-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                      {plan.platform}
                    </span>
                    <span className="text-sm text-muted-foreground">{new Date(plan.publishDate).toLocaleString('vi-VN')}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{plan.topic}</h3>
                  <div className="p-4 bg-secondary/30 rounded-xl mb-4 border border-border/50">
                    <p className="font-semibold text-primary mb-2">{plan.hook}</p>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{plan.caption}</p>
                    <p className="text-sm font-medium text-amber-500 mt-2">{plan.cta}</p>
                    <p className="text-xs text-muted-foreground mt-2">{plan.hashtags}</p>
                  </div>
                  {plan.imagePrompt && (
                    <div className="text-xs text-muted-foreground flex items-start gap-2">
                      <Eye className="w-4 h-4 shrink-0 text-primary" /> 
                      <span className="italic">Gợi ý hình ảnh: {plan.imagePrompt}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-6 lg:w-72 bg-secondary/10 flex flex-col justify-center gap-4">
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
                        placeholder="Yêu cầu sửa lại hook, thay đổi hình ảnh..."
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRejectingId(null)} className="flex-1 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80 font-medium">Hủy</button>
                        <button type="submit" disabled={rejectMutation.isPending} className="flex-1 py-2 rounded-lg text-sm bg-rose-500 hover:bg-rose-600 text-white font-bold">Xác nhận</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleApproveAndPublish(plan.id)}
                        disabled={publishingId === plan.id}
                        className="w-full py-4 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                      >
                        {publishingId === plan.id ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Đang đăng...</>
                        ) : (
                          <><Send className="w-5 h-5" /> Duyệt & Đăng Metricool</>
                        )}
                      </button>
                      <button 
                        onClick={() => setRejectingId(plan.id)}
                        disabled={publishingId === plan.id}
                        className="w-full py-3 rounded-xl font-bold bg-card border border-border hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        <X className="w-5 h-5" /> Từ chối
                      </button>
                      <p className="text-xs text-center text-muted-foreground">
                        Bài sẽ được lên lịch Metricool ngay khi bạn duyệt
                      </p>
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
