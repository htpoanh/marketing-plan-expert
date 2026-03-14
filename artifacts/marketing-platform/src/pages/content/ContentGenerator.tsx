import { useState } from "react";
import { useListBrands, useGenerateContent, useCreateContentPlan } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Sparkles, Copy, CalendarPlus, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ContentGenerator() {
  const { data: brands } = useListBrands();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    brandId: 0,
    platform: "Facebook",
    contentType: "Bài viết tương tác",
    topic: "",
    campaignGoal: "",
    additionalContext: ""
  });

  const generateMutation = useGenerateContent();
  const createPlanMutation = useCreateContentPlan();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn cửa hàng", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ data: formData });
  };

  const handleSaveToPlan = () => {
    if (!generateMutation.data) return;
    const content = generateMutation.data;
    
    createPlanMutation.mutate({
      data: {
        brandId: formData.brandId,
        publishDate: new Date().toISOString(),
        platform: formData.platform,
        contentType: formData.contentType,
        topic: formData.topic,
        hook: content.hooks[0], // Pick first hook by default
        caption: content.mainCaption,
        shortCaption: content.shortCaption,
        cta: content.cta,
        hashtags: content.hashtags.join(" "),
        imagePrompt: content.imagePrompt,
        videoPrompt: content.videoPrompt
      }
    }, {
      onSuccess: () => {
        toast({ title: "Thành công", description: "Đã lưu vào lịch nội dung" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            AI Content Generator
          </h1>
          <p className="mt-2 text-muted-foreground">Tạo bài viết thu hút cho các nền tảng mạng xã hội chỉ trong vài giây.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form */}
          <div className="lg:col-span-4 bg-card rounded-2xl border border-border/50 p-6 shadow-lg h-fit">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Thương hiệu / Cửa hàng</label>
                <select 
                  required
                  value={formData.brandId} 
                  onChange={e => setFormData({...formData, brandId: Number(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value={0}>-- Chọn cửa hàng --</option>
                  {brands?.map(b => (
                    <option key={b.id} value={b.id}>{b.brandName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nền tảng</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Facebook', 'Instagram', 'TikTok'].map(plat => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setFormData({...formData, platform: plat})}
                      className={`py-2 text-sm rounded-lg border font-medium transition-all ${formData.platform === plat ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary'}`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Chủ đề bài viết</label>
                <input 
                  required
                  value={formData.topic}
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                  placeholder="Vd: Ra mắt thức uống mới mùa hè..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mục tiêu chiến dịch</label>
                <input 
                  required
                  value={formData.campaignGoal}
                  onChange={e => setFormData({...formData, campaignGoal: e.target.value})}
                  placeholder="Vd: Tăng nhận diện, thu hút khách tới quán..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <Wand2 className="w-5 h-5 animate-spin" /> Đang tạo...
                  </span>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" /> Tạo nội dung
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="lg:col-span-8">
            {generateMutation.isPending ? (
              <div className="h-full min-h-[400px] bg-card rounded-2xl border border-border/50 p-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground animate-pulse">AI đang phân tích dữ liệu cửa hàng và viết bài...</p>
              </div>
            ) : generateMutation.data ? (
              <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b border-border/50 flex justify-between items-center bg-secondary/20">
                  <h3 className="font-bold text-lg">Kết quả tạo nội dung</h3>
                  <button 
                    onClick={handleSaveToPlan}
                    disabled={createPlanMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg text-sm font-medium transition-all"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    {createPlanMutation.isPending ? "Đang lưu..." : "Lưu vào Lịch"}
                  </button>
                </div>
                
                <div className="p-6 space-y-8">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-primary uppercase tracking-wider">3 Hooks thu hút (Chọn 1)</h4>
                    <ul className="space-y-2">
                      {generateMutation.data.hooks.map((hook, idx) => (
                        <li key={idx} className="p-3 bg-secondary/30 rounded-xl text-sm border border-border/50 hover:border-primary/30 transition-colors">
                          <span className="font-bold text-primary mr-2">#{idx + 1}</span> {hook}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Nội dung chính</h4>
                    <div className="p-4 bg-secondary/20 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border border-border/50 relative group">
                      {generateMutation.data.mainCaption}
                      <button className="absolute top-2 right-2 p-2 bg-background rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary shadow-md">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Call to Action (CTA)</h4>
                      <p className="p-3 bg-secondary/30 rounded-xl text-sm font-medium text-amber-500">
                        {generateMutation.data.cta}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Hashtags</h4>
                      <p className="text-sm text-primary/80 font-medium">
                        {generateMutation.data.hashtags.join(" ")}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" /> Gợi ý hình ảnh/Video
                    </h4>
                    <p className="text-sm text-muted-foreground"><strong className="text-foreground">Hình ảnh:</strong> {generateMutation.data.imagePrompt}</p>
                    <p className="text-sm text-muted-foreground mt-2"><strong className="text-foreground">Video:</strong> {generateMutation.data.videoPrompt}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <Wand2 className="w-10 h-10 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Chưa có dữ liệu</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">Điền thông tin vào form bên trái và nhấn "Tạo nội dung" để AI bắt đầu làm việc.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
