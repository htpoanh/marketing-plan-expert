import { useState } from "react";
import {
  useListReplyQueue,
  useListBrands,
  useGetAutoReplyStats,
  type ReplyPlatform,
  type ReplyStatus,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { QueueItemCard } from "./components/QueueItemCard";
import { AutoReplySettingsPanel } from "./components/AutoReplySettingsPanel";
import {
  Inbox,
  Settings as SettingsIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
} from "lucide-react";

const PLATFORM_TABS: { value: ReplyPlatform; label: string }[] = [
  { value: "google", label: "Google Reviews" },
  { value: "facebook", label: "FB Comments" },
  { value: "instagram", label: "IG Comments" },
  { value: "messenger", label: "Messenger" },
];

const STATUS_FILTERS: { value: ReplyStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "escalated", label: "Cần xử lý" },
  { value: "auto_sent", label: "Đã tự gửi" },
  { value: "manual_sent", label: "Đã gửi tay" },
  { value: "skipped", label: "Bỏ qua" },
];

export default function InboxPage() {
  const { data: brands } = useListBrands();
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [platform, setPlatform] = useState<ReplyPlatform>("google");
  const [status, setStatus] = useState<ReplyStatus | "all">("all");
  const [showSettings, setShowSettings] = useState(false);

  const statsParams = brandId !== undefined ? { brandId } : undefined;
  const { data: stats } = useGetAutoReplyStats(statsParams);

  const queueParams = {
    platform,
    ...(brandId !== undefined ? { brandId } : {}),
    ...(status !== "all" ? { status } : {}),
  };
  const { data: queue, isLoading } = useListReplyQueue(queueParams);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Hộp thư Auto-Reply</h1>
              <p className="text-sm text-muted-foreground">
                Đánh giá Google + bình luận FB/IG trong một hộp thư thống nhất
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={brandId === undefined ? "all" : String(brandId)}
              onValueChange={(v) => setBrandId(v === "all" ? undefined : Number(v))}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tất cả thương hiệu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả thương hiệu</SelectItem>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.brandName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showSettings ? "default" : "outline"}
              size="icon"
              onClick={() => setShowSettings((s) => !s)}
              disabled={brandId === undefined}
              title={brandId === undefined ? "Chọn 1 thương hiệu để cấu hình" : "Cài đặt"}
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label="Đã trả lời hôm nay" value={stats?.autoRepliedToday ?? 0} accent="text-green-600" />
          <StatCard icon={Clock} label="Chờ xử lý" value={stats?.pending ?? 0} accent="text-amber-600" />
          <StatCard icon={AlertTriangle} label="Cần xử lý (escalated)" value={stats?.escalated ?? 0} accent="text-red-600" />
          <StatCard
            icon={Timer}
            label="Thời gian phản hồi TB"
            value={stats?.avgResponseMinutes != null ? `${stats.avgResponseMinutes} ph` : "—"}
            accent="text-blue-600"
          />
        </div>

        {/* Settings drawer */}
        {showSettings && brandId !== undefined && (
          <AutoReplySettingsPanel brandId={brandId} />
        )}

        {/* Platform tabs + status filter */}
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as ReplyPlatform)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              {PLATFORM_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <Select value={status} onValueChange={(v) => setStatus(v as ReplyStatus | "all")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {PLATFORM_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {t.value === "messenger" ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Tin nhắn Messenger được xử lý tự động bởi AI đặt lịch.{" "}
                  <a href="/messenger" className="text-primary underline">Mở trang Messenger →</a>
                </Card>
              ) : isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : !queue || queue.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Chưa có mục nào cho kênh này.
                </Card>
              ) : (
                <div className="space-y-3">
                  {queue.map((item) => (
                    <QueueItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className={`w-4 h-4 ${accent}`} />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}
