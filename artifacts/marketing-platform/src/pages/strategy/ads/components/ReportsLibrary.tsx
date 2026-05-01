import { useState } from "react";
import {
  useListAdsReports,
  useDeleteAdsReport,
  getListAdsReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import type { AdsReport } from "../types";

const MODULE_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "audience", label: "M1 Audience" },
  { value: "keyword", label: "M2 Keyword" },
  { value: "performance", label: "M3 Performance" },
  { value: "trend", label: "M4 Trend" },
] as const;

const MODULE_BADGE: Record<string, string> = {
  audience: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  keyword: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  performance: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  trend: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function ReportsLibrary() {
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListAdsReports(
    moduleFilter
      ? { module: moduleFilter as "audience" | "keyword" | "performance" | "trend", limit: 50 }
      : { limit: 50 },
  );
  const reports = (data ?? []) as AdsReport[];

  const deleteMutation = useDeleteAdsReport({
    mutation: {
      onSuccess: () => {
        toast({ title: "Đã xoá report" });
        queryClient.invalidateQueries({ queryKey: getListAdsReportsQueryKey() });
      },
      onError: (err: unknown) => {
        toast({
          title: "Xoá thất bại",
          description: (err as Error)?.message ?? String(err),
          variant: "destructive",
        });
      },
    },
  });

  return (
    <div
      className="border border-border/50 rounded-xl bg-card"
      data-testid="reports-library"
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors rounded-xl"
      >
        <FolderOpen className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm flex-1">
          Reports đã lưu{" "}
          {!isLoading && (
            <span className="text-muted-foreground font-normal">
              ({reports.length})
            </span>
          )}
        </h3>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {MODULE_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={moduleFilter === f.value ? "default" : "outline"}
                onClick={() => setModuleFilter(f.value)}
                className="text-xs h-7"
              >
                {f.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-md" />
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Chưa có report nào
              {moduleFilter ? ` cho module "${moduleFilter}"` : ""}.
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="border border-border/40 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3 hover:bg-secondary/20 transition-colors">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${MODULE_BADGE[r.module] ?? ""}`}
                    >
                      {r.module}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Brand {r.brandId} •{" "}
                        {(r.input as { service?: string })?.service ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {new Date(r.createdAt).toLocaleString("de-DE")} •{" "}
                        {r.aiModel} • €{r.costEur ?? "0.0000"} •{" "}
                        {r.latencyMs ?? 0}ms
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                      className="text-xs h-7"
                    >
                      {expandedId === r.id ? "Ẩn" : "Xem"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Xoá report này? Không thể hoàn tác.",
                          )
                        ) {
                          deleteMutation.mutate({ id: r.id });
                        }
                      }}
                      className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {expandedId === r.id && (
                    <div className="bg-secondary/30 border-t border-border/40 p-3">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                        Output JSON
                      </div>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                        {JSON.stringify(r.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
