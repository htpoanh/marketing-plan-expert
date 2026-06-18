import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrands,
  useListMarketIntelligence,
  useScanMarketIntelligence,
  useDeleteMarketIntelligence,
  type MarketIntelligenceItem,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Globe, Radar, Trash2, Newspaper, MapPin, Hash, AlertCircle } from "lucide-react";

const SOURCE_META: Record<string, { label: string; icon: typeof Globe }> = {
  news: { label: "Tin tức", icon: Newspaper },
  maps: { label: "Đối thủ (Maps)", icon: MapPin },
  trends: { label: "Google Trends", icon: Hash },
  reddit: { label: "Reddit", icon: Globe },
  tiktok: { label: "TikTok", icon: Hash },
  claude: { label: "Claude", icon: Globe },
};

export default function MarketResearchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const [brandId, setBrandId] = useState<string>("");

  const scanMutation = useScanMarketIntelligence();
  const deleteMutation = useDeleteMarketIntelligence();
  const listParams = brandId ? { brandId: Number(brandId) } : undefined;
  const { data: items, isLoading } = useListMarketIntelligence(listParams);

  const refresh = () => queryClient.invalidateQueries();

  const scan = () => {
    if (!brandId) {
      toast({ title: "Chọn thương hiệu trước", variant: "destructive" });
      return;
    }
    scanMutation.mutate(
      { data: { brandId: Number(brandId) } },
      {
        onSuccess: (res) => {
          toast({ title: "Quét xong", description: `${res?.inserted?.length ?? 0} tín hiệu` });
          refresh();
        },
        onError: () => toast({ title: "Lỗi quét", variant: "destructive" }),
      },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Nghiên cứu thị trường</h1>
              <p className="text-sm text-muted-foreground">
                Tin tức + đối thủ (Maps) chạy ngay. Trends/Reddit/TikTok cần API key (sẽ kích hoạt sau).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Chọn thương hiệu" /></SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.brandName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={scan} disabled={scanMutation.isPending}>
              <Radar className="w-4 h-4 mr-1.5" />
              {scanMutation.isPending ? "Đang quét..." : "Quét thị trường"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !items || items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Chưa có tín hiệu. Chọn thương hiệu và bấm "Quét thị trường".
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it: MarketIntelligenceItem) => {
              const meta = SOURCE_META[it.source] ?? { label: it.source, icon: Globe };
              const Icon = meta.icon;
              const inactive = it.category === "inactive";
              const link = (it.content as { link?: string } | null)?.link;
              return (
                <Card key={it.id} className={`p-4 ${inactive ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{meta.label}</Badge>
                        {it.category && <Badge variant="outline">{it.category}</Badge>}
                        {inactive && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="w-3 h-3" /> cần key
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{it.title}</p>
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          Mở nguồn →
                        </a>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive flex-shrink-0"
                      onClick={() => deleteMutation.mutate({ id: it.id }, { onSuccess: refresh })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
