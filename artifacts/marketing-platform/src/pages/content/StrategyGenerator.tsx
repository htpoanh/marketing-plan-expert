import { useState } from "react";
import { useListBrands, useGenerateStrategy } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Lightbulb, Target, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StrategyGenerator() {
  const { data: brands } = useListBrands();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    brandId: 0,
    platform: "Đa nền tảng",
    campaignGoal: "",
    duration: "1 Tuần"
  });

  const generateMutation = useGenerateStrategy();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn cửa hàng", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ data: formData });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400" />
            AI Phân tích Chiến lược
          </h1>
          <p className="mt-2 text-muted-foreground">Ứng dụng các mô hình Marketing (AIDA, 4P, STP) để lên kế hoạch.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-card rounded-2xl border border-border/50 p-6 shadow-lg h-fit">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cửa hàng cần phân tích</label>
                <select 
                  required
                  value={formData.brandId} 
                  onChange={e => setFormData({...formData, brandId: Number(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                >
                  <option value={0}>-- Chọn cửa hàng --</option>
                  {brands?.map(b => (
                    <option key={b.id} value={b.id}>{b.brandName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mục tiêu chiến dịch (Goal)</label>
                <textarea 
                  required
                  value={formData.campaignGoal}
                  onChange={e => setFormData({...formData, campaignGoal: e.target.value})}
                  placeholder="Vd: Đẩy mạnh doanh thu cuối tuần, xả hàng tồn kho..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nền tảng</label>
                  <select 
                    value={formData.platform}
                    onChange={e => setFormData({...formData, platform: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                  >
                    <option>Đa nền tảng</option>
                    <option>Facebook</option>
                    <option>TikTok</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Thời gian</label>
                  <select 
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                  >
                    <option>1 Tuần</option>
                    <option>1 Tháng</option>
                    <option>Quý</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 animate-spin" /> Phân tích...
                  </span>
                ) : (
                  <>
                    <Target className="w-5 h-5" /> Phân tích chiến lược
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8">
            {generateMutation.isPending ? (
              <div className="h-full min-h-[400px] bg-card rounded-2xl border border-border/50 flex flex-col items-center justify-center">
                 <BrainCircuit className="w-16 h-16 text-amber-500 animate-bounce mb-4" />
                 <p className="text-muted-foreground animate-pulse text-lg">Hệ thống đang thiết kế chiến lược...</p>
              </div>
            ) : generateMutation.data ? (
              <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                 <div className="p-6 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent">
                   <h2 className="text-2xl font-bold font-display text-amber-500 flex items-center gap-2">
                     <Target className="w-6 h-6" /> {generateMutation.data.campaignAngle}
                   </h2>
                 </div>
                 
                 <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Mô hình áp dụng</p>
                        <p className="font-bold text-primary">{generateMutation.data.marketingModel}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Giai đoạn Phễu</p>
                        <p className="font-bold text-emerald-500">{generateMutation.data.funnelStage}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Cảm xúc mục tiêu</p>
                        <p className="font-bold text-rose-500">{generateMutation.data.targetEmotion}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Chiến lược CTA</p>
                        <p className="font-bold text-blue-500">{generateMutation.data.ctaStrategy}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-amber-500" /> Lý luận AI (Reasoning)
                      </h4>
                      <p className="p-4 bg-secondary/20 rounded-xl text-sm leading-relaxed text-muted-foreground border border-border/50">
                        {generateMutation.data.reasoning}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-foreground">Gợi ý chủ đề triển khai</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {generateMutation.data.suggestedTopics.map((topic, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-xl border border-border hover:border-amber-500/50 transition-colors cursor-default">
                            <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {i+1}
                            </div>
                            <p className="text-sm">{topic}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                 <Target className="w-16 h-16 text-muted-foreground/30 mb-4" />
                 <h3 className="text-xl font-bold">Chưa có bản kế hoạch</h3>
                 <p className="text-muted-foreground mt-2">Nhập thông tin mục tiêu để AI giúp bạn vạch ra chiến lược.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
