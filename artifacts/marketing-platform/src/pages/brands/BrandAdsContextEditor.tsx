import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetBrandAdsContext,
  useUpdateBrandAdsContext,
  useGetBrand,
  getGetBrandAdsContextQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react";

type Competitor = { name: string; url?: string | null; notes?: string | null };
type AdsContext = {
  uniqueSellingPoints?: string[];
  competitors?: Competitor[];
  pricePositioning?: "budget" | "mid" | "premium" | "luxury" | null;
  bookingUrl?: string | null;
  metaPixelId?: string | null;
  googleAdsCustomerId?: string | null;
  primaryRegions?: string[];
  excludedRegions?: string[];
  primaryLanguages?: string[];
  notes?: string | null;
};

/**
 * Edit a brand's `ads_context` JSONB + service_radius_km + avg_ticket_size_eur.
 * Saving bumps brands.updatedAt → 7-day Ads Strategy cache (M1/M2/M3/M4)
 * auto-invalidates because cacheKey includes brand.updatedAt.
 */
export default function BrandAdsContextEditor() {
  const { id } = useParams<{ id: string }>();
  const brandId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brand } = useGetBrand(brandId);
  const { data: contextEnvelope, isLoading } = useGetBrandAdsContext(brandId);

  const [usps, setUsps] = useState<string[]>([]);
  const [uspDraft, setUspDraft] = useState("");

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [compDraft, setCompDraft] = useState<Competitor>({ name: "" });

  const [pricePositioning, setPricePositioning] = useState<
    AdsContext["pricePositioning"] | ""
  >("");

  const [bookingUrl, setBookingUrl] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState("");

  const [primaryRegions, setPrimaryRegions] = useState<string[]>([]);
  const [regionDraft, setRegionDraft] = useState("");

  const [excludedRegions, setExcludedRegions] = useState<string[]>([]);
  const [excludedDraft, setExcludedDraft] = useState("");

  const [primaryLanguages, setPrimaryLanguages] = useState<string[]>(["de"]);

  const [notes, setNotes] = useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState<string>("");
  const [avgTicketSizeEur, setAvgTicketSizeEur] = useState<string>("");

  const update = useUpdateBrandAdsContext();

  // Hydrate state once the API responds
  useEffect(() => {
    if (!contextEnvelope) return;
    const ctx = (contextEnvelope.adsContext ?? {}) as AdsContext;
    setUsps(ctx.uniqueSellingPoints ?? []);
    setCompetitors(ctx.competitors ?? []);
    setPricePositioning(ctx.pricePositioning ?? "");
    setBookingUrl(ctx.bookingUrl ?? "");
    setMetaPixelId(ctx.metaPixelId ?? "");
    setGoogleAdsCustomerId(ctx.googleAdsCustomerId ?? "");
    setPrimaryRegions(ctx.primaryRegions ?? []);
    setExcludedRegions(ctx.excludedRegions ?? []);
    setPrimaryLanguages(ctx.primaryLanguages ?? ["de"]);
    setNotes(ctx.notes ?? "");
    setServiceRadiusKm(
      contextEnvelope.serviceRadiusKm != null
        ? String(contextEnvelope.serviceRadiusKm)
        : "",
    );
    setAvgTicketSizeEur(contextEnvelope.avgTicketSizeEur ?? "");
  }, [contextEnvelope]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: brandId,
        data: {
          adsContext: {
            uniqueSellingPoints: usps,
            competitors,
            pricePositioning: pricePositioning || null,
            bookingUrl: bookingUrl.trim() || null,
            metaPixelId: metaPixelId.trim() || null,
            googleAdsCustomerId: googleAdsCustomerId.trim() || null,
            primaryRegions,
            excludedRegions,
            primaryLanguages,
            notes: notes.trim() || null,
          },
          serviceRadiusKm: serviceRadiusKm ? Number(serviceRadiusKm) : null,
          avgTicketSizeEur: avgTicketSizeEur.trim() || null,
        },
      });
      queryClient.invalidateQueries({
        queryKey: getGetBrandAdsContextQueryKey(brandId),
      });
      toast({
        title: "Đã lưu brand context",
        description:
          "Cache 7 ngày của Ads Strategy AI tự invalidate — lần generate tiếp theo sẽ dùng context mới.",
      });
    } catch (err) {
      toast({
        title: "Lưu thất bại",
        description: (err as Error)?.message ?? "Lỗi không xác định",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !brand) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/brands")}
            className="mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h1 className="text-2xl font-bold">Brand Context cho AI</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {brand.brandName} · Context này sẽ inject vào prompt cho 4 module
              Ads Strategy (M1/M2/M3/M4). Càng chi tiết, AI output càng sharp.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={update.isPending}
            data-testid="brand-context-save"
          >
            {update.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Lưu
          </Button>
        </div>

        {/* Auto-invalidate banner */}
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            Khi bạn lưu, <strong>cache 7 ngày của AI tự invalidate</strong> cho
            brand này. Lần generate tiếp theo (M1/M2/M3/M4) sẽ dùng context mới
            — KHÔNG cần xoá thủ công.
          </div>
        </div>

        {/* Quick metrics */}
        <Section title="Số liệu cơ bản">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ctx-radius">Service radius (km)</Label>
              <Input
                id="ctx-radius"
                type="number"
                min="0"
                value={serviceRadiusKm}
                onChange={(e) => setServiceRadiusKm(e.target.value)}
                placeholder="VD: 30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-ticket">Avg ticket size (€)</Label>
              <Input
                id="ctx-ticket"
                type="text"
                inputMode="decimal"
                value={avgTicketSizeEur}
                onChange={(e) => setAvgTicketSizeEur(e.target.value)}
                placeholder="VD: 45.00"
              />
              <p className="text-[10px] text-muted-foreground">
                Decimal — dùng dấu chấm (45.00 thay vì 45,00).
              </p>
            </div>
          </div>
        </Section>

        {/* USPs */}
        <Section
          title="Unique Selling Points"
          hint="3-5 điểm khiến brand khác đối thủ. Càng cụ thể càng tốt."
        >
          <div className="flex gap-2">
            <Input
              value={uspDraft}
              onChange={(e) => setUspDraft(e.target.value)}
              placeholder="VD: Express service (30 phút) — duy nhất ở Allgäu"
              onKeyDown={(e) => {
                if (e.key === "Enter" && uspDraft.trim()) {
                  e.preventDefault();
                  setUsps([...usps, uspDraft.trim()]);
                  setUspDraft("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (uspDraft.trim()) {
                  setUsps([...usps, uspDraft.trim()]);
                  setUspDraft("");
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ChipList
            items={usps}
            onRemove={(i) => setUsps(usps.filter((_, j) => j !== i))}
          />
        </Section>

        {/* Competitors */}
        <Section
          title="Đối thủ trực tiếp"
          hint="Các nail studio / restaurant gần khu vực — AI sẽ đề xuất defensive keywords + tránh lặp lại pattern."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              value={compDraft.name}
              onChange={(e) => setCompDraft({ ...compDraft, name: e.target.value })}
              placeholder="Tên đối thủ"
            />
            <Input
              value={compDraft.url ?? ""}
              onChange={(e) => setCompDraft({ ...compDraft, url: e.target.value })}
              placeholder="Website / IG (tuỳ chọn)"
            />
            <div className="flex gap-2">
              <Input
                value={compDraft.notes ?? ""}
                onChange={(e) => setCompDraft({ ...compDraft, notes: e.target.value })}
                placeholder="Ghi chú ngắn"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (compDraft.name.trim()) {
                    setCompetitors([...competitors, { ...compDraft }]);
                    setCompDraft({ name: "" });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {competitors.length > 0 && (
            <div className="space-y-1">
              {competitors.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm border border-border/40 rounded-lg p-2"
                >
                  <Badge>{c.name}</Badge>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 truncate"
                    >
                      {c.url}
                    </a>
                  )}
                  {c.notes && (
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {c.notes}
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setCompetitors(competitors.filter((_, j) => j !== i))
                    }
                    className="h-6 w-6 ml-auto"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Price positioning */}
        <Section title="Price positioning">
          <select
            value={pricePositioning ?? ""}
            onChange={(e) =>
              setPricePositioning(
                e.target.value as AdsContext["pricePositioning"] | "",
              )
            }
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <option value="">— Chưa chọn —</option>
            <option value="budget">Budget (giá rẻ)</option>
            <option value="mid">Mid (tầm trung)</option>
            <option value="premium">Premium</option>
            <option value="luxury">Luxury</option>
          </select>
        </Section>

        {/* Regions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Region target chính" hint="VD: Kempten, Allgäu">
            <ChipInput
              value={regionDraft}
              onChange={setRegionDraft}
              onAdd={() => {
                if (regionDraft.trim()) {
                  setPrimaryRegions([...primaryRegions, regionDraft.trim()]);
                  setRegionDraft("");
                }
              }}
            />
            <ChipList
              items={primaryRegions}
              onRemove={(i) =>
                setPrimaryRegions(primaryRegions.filter((_, j) => j !== i))
              }
            />
          </Section>
          <Section title="Region cần tránh" hint="VD: München (cách quá xa)">
            <ChipInput
              value={excludedDraft}
              onChange={setExcludedDraft}
              onAdd={() => {
                if (excludedDraft.trim()) {
                  setExcludedRegions([...excludedRegions, excludedDraft.trim()]);
                  setExcludedDraft("");
                }
              }}
            />
            <ChipList
              items={excludedRegions}
              onRemove={(i) =>
                setExcludedRegions(excludedRegions.filter((_, j) => j !== i))
              }
            />
          </Section>
        </div>

        {/* Tracking IDs */}
        <Section title="Tracking IDs (tuỳ chọn)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctx-booking">Booking URL</Label>
              <Input
                id="ctx-booking"
                type="url"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-pixel">Meta Pixel ID</Label>
              <Input
                id="ctx-pixel"
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value)}
                placeholder="VD: 1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-gads">Google Ads Customer ID</Label>
              <Input
                id="ctx-gads"
                value={googleAdsCustomerId}
                onChange={(e) => setGoogleAdsCustomerId(e.target.value)}
                placeholder="VD: 123-456-7890"
              />
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section
          title="Ghi chú riêng cho AI"
          hint="Bất kỳ context gì AI nên biết về brand — thói quen khách, drama nội bộ, mục tiêu Q4..."
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm resize-y"
            placeholder="VD: Khách chính 80% là phụ nữ Đức 25-45 tuổi sinh sống Allgäu. Q3 muốn focus chuyển từ booking lên upsell..."
          />
        </Section>

        <div className="flex justify-end pt-4 border-t border-border/50">
          <Button
            onClick={handleSave}
            disabled={update.isPending}
            size="lg"
          >
            {update.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Lưu brand context
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 bg-card rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ChipList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (idx: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Chưa có item nào</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="text-xs gap-1 pr-1.5"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="hover:text-rose-400"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function ChipInput({
  value,
  onChange,
  onAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onAdd();
          }
        }}
      />
      <Button type="button" variant="outline" size="icon" onClick={onAdd}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
