import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrands,
  useListStrategyInboxItems,
  useCreateStrategyInboxItem,
  type StrategyInputType,
  type StrategyPriority,
  type StrategyStatus,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { StrategyItemCard } from "./components/StrategyItemCard";
import { Inbox, Send } from "lucide-react";

const TYPE_OPTIONS: { value: StrategyInputType; label: string }[] = [
  { value: "campaign_idea", label: "Ý tưởng campaign" },
  { value: "company_goal", label: "Mục tiêu công ty" },
  { value: "format_test", label: "Thử format mới" },
  { value: "feedback", label: "Phản hồi" },
  { value: "other", label: "Khác" },
];

const PRIORITY_OPTIONS: { value: StrategyPriority; label: string }[] = [
  { value: "high", label: "Cao" },
  { value: "medium", label: "Trung bình" },
  { value: "low", label: "Thấp" },
];

const STATUS_FILTERS: { value: StrategyStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Đang phân tích" },
  { value: "analyzed", label: "Đã phân tích" },
  { value: "incorporated", label: "Đã đưa vào KH" },
  { value: "archived", label: "Lưu trữ" },
];

export default function StrategyInboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const createMutation = useCreateStrategyInboxItem();

  const [brandId, setBrandId] = useState<string>("all");
  const [inputType, setInputType] = useState<StrategyInputType>("campaign_idea");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<StrategyPriority>("medium");
  const [deadline, setDeadline] = useState("");

  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<StrategyStatus | "all">("all");

  const listParams = {
    ...(filterBrand !== "all" ? { brandId: Number(filterBrand) } : {}),
    ...(filterStatus !== "all" ? { status: filterStatus } : {}),
  };
  const { data: items, isLoading } = useListStrategyInboxItems(listParams);

  const brandName = (id: number | null) =>
    id === null ? "Tất cả thương hiệu" : brands?.find((b) => b.id === id)?.brandName ?? `#${id}`;

  const submit = () => {
    if (!content.trim()) {
      toast({ title: "Nhập nội dung trước đã", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          brandId: brandId === "all" ? null : Number(brandId),
          inputType,
          content: content.trim(),
          priority,
          deadline: deadline || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Đã gửi", description: "Claude đã phân tích ý tưởng của bạn." });
          setContent("");
          setDeadline("");
          queryClient.invalidateQueries();
        },
        onError: () =>
          toast({ title: "Lỗi gửi", description: "Thử lại sau.", variant: "destructive" }),
      },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Inbox className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Hộp thư chiến lược</h1>
            <p className="text-sm text-muted-foreground">
              Gửi ý tưởng / mục tiêu / feedback bất cứ lúc nào — Claude phân tích tính khả thi, timeline, nguồn lực và rủi ro.
            </p>
          </div>
        </div>

        {/* Submit form */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Thương hiệu</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả thương hiệu</SelectItem>
                  {(brands ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.brandName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại</Label>
              <Select value={inputType} onValueChange={(v) => setInputType(v as StrategyInputType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ưu tiên</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as StrategyPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nội dung (tiếng Việt hoặc Đức)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="VD: Muốn thử campaign video ngắn cho Happy Wok dịp hè, ngân sách 300€..."
            />
          </div>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs">Deadline (tuỳ chọn)</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-44" />
            </div>
            <Button onClick={submit} disabled={createMutation.isPending}>
              <Send className="w-4 h-4 mr-1.5" />
              {createMutation.isPending ? "Claude đang phân tích..." : "Gửi & phân tích"}
            </Button>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Lọc thương hiệu" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thương hiệu</SelectItem>
              {(brands ?? []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.brandName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StrategyStatus | "all")}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !items || items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Chưa có mục nào. Gửi ý tưởng đầu tiên ở trên.
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <StrategyItemCard key={item.id} item={item} brandName={brandName(item.brandId)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
