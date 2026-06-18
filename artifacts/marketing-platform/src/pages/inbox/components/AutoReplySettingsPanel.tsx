import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAutoReplySettings,
  useUpdateAutoReplySettings,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, ShieldCheck } from "lucide-react";

export function AutoReplySettingsPanel({ brandId }: { brandId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useGetAutoReplySettings(brandId);
  const updateMutation = useUpdateAutoReplySettings();

  const [form, setForm] = useState({
    googleEnabled: false,
    fbCommentsEnabled: false,
    igCommentsEnabled: false,
    dailyCap: 50,
    escalateThreshold: 2,
  });

  useEffect(() => {
    if (data) {
      setForm({
        googleEnabled: data.googleEnabled,
        fbCommentsEnabled: data.fbCommentsEnabled,
        igCommentsEnabled: data.igCommentsEnabled,
        dailyCap: data.dailyCap,
        escalateThreshold: data.escalateThreshold,
      });
    }
  }, [data]);

  const save = () => {
    updateMutation.mutate(
      { brandId, data: form },
      {
        onSuccess: () => {
          toast({ title: "Đã lưu cài đặt auto-reply" });
          queryClient.invalidateQueries();
        },
        onError: () => toast({ title: "Lỗi lưu cài đặt", variant: "destructive" }),
      },
    );
  };

  const toggle = (key: keyof typeof form) => (val: boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Cài đặt tự động trả lời</h3>
      </div>

      <div className="space-y-3">
        <SettingRow label="Tự trả lời Google Reviews (≥ ngưỡng + 1 sao)">
          <Switch checked={form.googleEnabled} onCheckedChange={toggle("googleEnabled")} />
        </SettingRow>
        <SettingRow label="Tự trả lời bình luận Facebook">
          <Switch checked={form.fbCommentsEnabled} onCheckedChange={toggle("fbCommentsEnabled")} />
        </SettingRow>
        <SettingRow label="Tự trả lời bình luận Instagram">
          <Switch checked={form.igCommentsEnabled} onCheckedChange={toggle("igCommentsEnabled")} />
        </SettingRow>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Giới hạn/ngày/kênh</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={form.dailyCap}
            onChange={(e) => setForm((f) => ({ ...f, dailyCap: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ngưỡng escalate (≤ sao này → người xử lý)</Label>
          <Input
            type="number"
            min={0}
            max={5}
            value={form.escalateThreshold}
            onChange={(e) => setForm((f) => ({ ...f, escalateThreshold: Number(e.target.value) }))}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Lưu ý: Job tự trả lời Google chạy mỗi giờ và <strong>mặc định tắt</strong>. Bật cron tại{" "}
        <a href="/automation" className="text-primary underline">Automation → Scheduled Jobs</a>.
        Khiếu nại và bình luận tiêu cực luôn được chuyển cho người xử lý, không tự gửi.
      </p>

      <Button onClick={save} disabled={updateMutation.isPending} size="sm">
        <Save className="w-4 h-4 mr-1.5" />
        {updateMutation.isPending ? "Đang lưu..." : "Lưu cài đặt"}
      </Button>
    </Card>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
