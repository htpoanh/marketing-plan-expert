import { useGetAdsCostSummary } from "@workspace/api-client-react";
import { Coins, Sparkles, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Bucket = {
  aiProvider: string;
  aiModel: string;
  module: string;
  callCount: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostEur: string;
};

/**
 * Compact dashboard showing AI spend MTD, grouped by module + model.
 *
 * Backend endpoint: GET /api/ads-strategy/cost-summary (no params = current
 * month UTC). Returns array of buckets.
 */
export function CostSummaryWidget() {
  // Default = current month
  const { data, isLoading, error } = useGetAdsCostSummary();
  const buckets = (data ?? []) as Bucket[];

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }
  if (error) {
    return null; // Fail quietly — widget is non-essential
  }

  const totalCalls = buckets.reduce((s, b) => s + b.callCount, 0);
  const totalCost = buckets.reduce(
    (s, b) => s + parseFloat(b.totalCostEur || "0"),
    0,
  );
  const totalTokens = buckets.reduce(
    (s, b) => s + b.totalTokensInput + b.totalTokensOutput,
    0,
  );

  if (totalCalls === 0) {
    return (
      <div className="border border-border/50 rounded-xl p-4 bg-card flex items-center gap-3 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 opacity-40" />
        Chưa có AI call nào trong tháng này. Mỗi lần generate sẽ track tự động ở đây.
      </div>
    );
  }

  return (
    <div
      className="border border-border/50 rounded-xl p-4 bg-card flex flex-wrap gap-4 items-center"
      data-testid="cost-summary-widget"
    >
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-amber-400" />
        <div>
          <div className="text-xs text-muted-foreground">AI spend (MTD)</div>
          <div className="font-semibold text-lg">€{totalCost.toFixed(4)}</div>
        </div>
      </div>
      <div className="h-10 w-px bg-border" />
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <div>
          <div className="text-xs text-muted-foreground">Calls</div>
          <div className="font-semibold text-lg">{totalCalls}</div>
        </div>
      </div>
      <div className="h-10 w-px bg-border" />
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-400" />
        <div>
          <div className="text-xs text-muted-foreground">Tokens</div>
          <div className="font-semibold text-lg">
            {(totalTokens / 1000).toFixed(1)}K
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap gap-1.5 max-w-md">
        {buckets.slice(0, 5).map((b, i) => (
          <span
            key={i}
            className="text-[10px] font-mono border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground"
            title={`${b.aiProvider}/${b.aiModel} • ${b.callCount} calls • €${b.totalCostEur}`}
          >
            {b.module} {b.aiProvider}/{b.aiModel.split("-")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
