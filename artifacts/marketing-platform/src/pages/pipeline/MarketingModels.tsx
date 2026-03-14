import { useListMarketingModels } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BrainCircuit, Info, ListOrdered, Sparkles, Target, Zap } from "lucide-react";

export default function MarketingModels() {
  const { data: models, isLoading } = useListMarketingModels();

  // Helper to get color based on model name/type
  const getModelColor = (name: string) => {
    if (name === "AIDA" || name === "PAS") return "from-blue-500/20 to-cyan-500/20 text-blue-500 border-blue-500/30";
    if (name === "BAB" || name === "PPPP") return "from-rose-500/20 to-pink-500/20 text-rose-500 border-rose-500/30";
    if (name === "FAB" || name === "4Cs") return "from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30";
    if (name === "Storytelling" || name === "Hero's Journey") return "from-purple-500/20 to-fuchsia-500/20 text-purple-500 border-purple-500/30";
    return "from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/30";
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-primary" />
            Mô hình Marketing AI
          </h1>
          <p className="mt-2 text-muted-foreground">Thư viện các mô hình tư duy tiếp thị được AI sử dụng để phân tích và lập chiến lược nội dung.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[400px] rounded-2xl bg-card border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {models?.map((model) => {
              const colorClass = getModelColor(model.name);
              return (
                <div key={model.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
                  <div className={`p-6 border-b border-border/50 bg-gradient-to-br ${colorClass} bg-opacity-10`}>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-3xl font-display font-black tracking-tight">{model.name}</h2>
                      <Sparkles className="w-5 h-5 opacity-50" />
                    </div>
                    <p className="font-medium opacity-90">{model.fullName}</p>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col gap-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" /> Mô tả
                      </h4>
                      <p className="text-sm leading-relaxed">{model.description}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" /> Khi nào nên dùng
                      </h4>
                      <p className="text-sm font-medium text-primary/80 bg-primary/5 p-3 rounded-xl border border-primary/10">
                        {model.whenToUse}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        <ListOrdered className="w-3.5 h-3.5" /> Các bước (Framework)
                      </h4>
                      <div className="space-y-2">
                        {model.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-3 text-sm">
                            <span className="font-bold text-foreground opacity-50">{idx + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" /> Ví dụ thực tế
                      </h4>
                      <blockquote className="text-sm italic text-muted-foreground border-l-2 border-primary/50 pl-4 py-1">
                        "{model.example}"
                      </blockquote>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
