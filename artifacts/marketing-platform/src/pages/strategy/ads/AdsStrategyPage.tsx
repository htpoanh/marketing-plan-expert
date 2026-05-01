import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Target, Hash, BarChart3, Radar } from "lucide-react";
import { useListBrands } from "@workspace/api-client-react";

import AudienceTab from "./AudienceTab";
import KeywordsTab from "./KeywordsTab";
import { CostSummaryWidget } from "./components/CostSummaryWidget";
import { ReportsLibrary } from "./components/ReportsLibrary";

/**
 * Ads Strategy Agent — main page.
 *
 * Phase 2 (this commit): M1 Audience + M2 Keywords are functional.
 * Phase 3 will fill in M3 Performance, Phase 4 fills in M4 Trend.
 */
export default function AdsStrategyPage() {
  const { data: brands = [], isLoading: brandsLoading } = useListBrands();
  const [activeTab, setActiveTab] = useState<
    "audience" | "keywords" | "performance" | "trend"
  >("audience");

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Ads Strategy Agent</h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              4 module AI giúp tối ưu quảng cáo: phân tích đối tượng (M1),
              keyword có sức nặng (M2), audit performance (M3), bắt trend (M4).
              Vietnamese UI, German output cho ads/copy.
            </p>
          </div>
        </div>

        {/* Cost summary always visible */}
        <CostSummaryWidget />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger
              value="audience"
              className="data-[state=active]:bg-violet-500/15 data-[state=active]:border-violet-500/40 border border-border/50 px-4 py-3 h-auto flex flex-col items-start gap-1"
              data-testid="tab-audience"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <Target className="w-3.5 h-3.5" /> M1 — Đối tượng
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Claude Haiku
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="keywords"
              className="data-[state=active]:bg-emerald-500/15 data-[state=active]:border-emerald-500/40 border border-border/50 px-4 py-3 h-auto flex flex-col items-start gap-1"
              data-testid="tab-keywords"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <Hash className="w-3.5 h-3.5" /> M2 — Keyword
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Gemini Flash
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="data-[state=active]:bg-amber-500/15 data-[state=active]:border-amber-500/40 border border-border/50 px-4 py-3 h-auto flex flex-col items-start gap-1 opacity-60"
              data-testid="tab-performance"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <BarChart3 className="w-3.5 h-3.5" /> M3 — Performance
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Phase 3
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="trend"
              className="data-[state=active]:bg-rose-500/15 data-[state=active]:border-rose-500/40 border border-border/50 px-4 py-3 h-auto flex flex-col items-start gap-1 opacity-60"
              data-testid="tab-trend"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <Radar className="w-3.5 h-3.5" /> M4 — Trend
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Phase 4
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audience">
            <AudienceTab brands={brands} brandsLoading={brandsLoading} />
          </TabsContent>
          <TabsContent value="keywords">
            <KeywordsTab brands={brands} brandsLoading={brandsLoading} />
          </TabsContent>
          <TabsContent value="performance">
            <ComingSoonNotice
              moduleName="M3 — Performance Reality"
              description="Upload CSV ads (Meta/Google) → Claude Sonnet phân tích lãng phí + đề xuất chia lại budget cụ thể €. Phase 3."
            />
          </TabsContent>
          <TabsContent value="trend">
            <ComingSoonNotice
              moduleName="M4 — Trend Pulse"
              description="Trend real-time từ Đức + Bayern qua Grok 3 với web search. Phase 4."
            />
          </TabsContent>
        </Tabs>

        {/* Reports library always at bottom */}
        <ReportsLibrary />
      </div>
    </AppLayout>
  );
}

function ComingSoonNotice({
  moduleName,
  description,
}: {
  moduleName: string;
  description: string;
}) {
  return (
    <div className="border border-border/50 bg-secondary/30 rounded-xl p-8 text-center space-y-2">
      <div className="text-lg font-semibold">{moduleName}</div>
      <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
        {description}
      </p>
    </div>
  );
}
