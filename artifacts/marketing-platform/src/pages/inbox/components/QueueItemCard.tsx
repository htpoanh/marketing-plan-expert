import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSendReplyQueueItem,
  useUpdateReplyQueueItem,
  type ReplyQueueItem,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  X,
  Star,
  MessageCircle,
  Globe,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Chờ xử lý", className: "bg-amber-100 text-amber-800", icon: Clock },
  auto_sent: { label: "Đã tự gửi", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
  manual_sent: { label: "Đã gửi tay", className: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  escalated: { label: "Cần xử lý", className: "bg-red-100 text-red-800", icon: AlertTriangle },
  skipped: { label: "Bỏ qua", className: "bg-gray-100 text-gray-600", icon: X },
};

const INTENT_LABEL: Record<string, string> = {
  booking: "Đặt lịch",
  price: "Hỏi giá",
  complaint: "Khiếu nại",
  compliment: "Khen ngợi",
  other: "Khác",
};

export function QueueItemCard({ item }: { item: ReplyQueueItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(item.suggestedReply ?? "");

  const sendMutation = useSendReplyQueueItem();
  const updateMutation = useUpdateReplyQueueItem();

  const refresh = () => queryClient.invalidateQueries();

  const isSent = item.status === "auto_sent" || item.status === "manual_sent";
  const isSkipped = item.status === "skipped";
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
  const StatusIcon = statusMeta.icon;

  const handleSend = () => {
    sendMutation.mutate(
      { id: item.id, data: { replyText: draft } },
      {
        onSuccess: () => {
          toast({ title: "Đã gửi phản hồi", description: "Phản hồi đã được đăng." });
          refresh();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Không gửi được. Kiểm tra kết nối API.";
          toast({ title: "Lỗi gửi", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleSkip = () => {
    updateMutation.mutate(
      { id: item.id, data: { status: "skipped" } },
      {
        onSuccess: () => {
          toast({ title: "Đã bỏ qua" });
          refresh();
        },
      },
    );
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">{item.platform}</Badge>
        {item.intent && <Badge variant="outline">{INTENT_LABEL[item.intent] ?? item.intent}</Badge>}
        {typeof item.rating === "number" && (
          <span className="inline-flex items-center gap-0.5 text-amber-500 text-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < (item.rating ?? 0) ? "fill-current" : "opacity-30"}`} />
            ))}
          </span>
        )}
        {item.replyMode && (
          <Badge variant="outline" className="gap-1">
            {item.replyMode === "private" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {item.replyMode === "private" ? "DM" : "Công khai"}
          </Badge>
        )}
        <Badge className={`gap-1 ${statusMeta.className}`}>
          <StatusIcon className="w-3 h-3" />
          {statusMeta.label}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString("de-DE")}
        </span>
      </div>

      {item.authorName && (
        <div className="text-sm font-medium text-foreground">{item.authorName}</div>
      )}
      {item.originalMessage && (
        <div className="flex gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3">
          <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="whitespace-pre-wrap">{item.originalMessage}</p>
        </div>
      )}

      {item.statusReason && (
        <p className="text-xs text-muted-foreground italic">{item.statusReason}</p>
      )}

      {!isSent && !isSkipped ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Soạn / chỉnh phản hồi (tiếng Đức)..."
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendMutation.isPending || !draft.trim()}
            >
              <Send className="w-4 h-4 mr-1.5" />
              {sendMutation.isPending ? "Đang gửi..." : "Gửi"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSkip} disabled={updateMutation.isPending}>
              <X className="w-4 h-4 mr-1.5" />
              Bỏ qua
            </Button>
          </div>
        </>
      ) : (
        item.sentReply && (
          <div className="text-sm text-foreground bg-green-50 border border-green-100 rounded-lg p-3 whitespace-pre-wrap">
            {item.sentReply}
          </div>
        )
      )}
    </Card>
  );
}
