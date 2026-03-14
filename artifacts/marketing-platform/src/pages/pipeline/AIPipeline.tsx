import { useState, useEffect } from "react";
import { 
  useListBrands, 
  useRunPipeline, 
  useListPipelineRuns, 
  useDeletePipelineRun,
  useGetPipelineRun
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Sparkles, Bot, Search, BrainCircuit, PenTool, Palette, Save, 
  ChevronDown, ChevronUp, Copy, CheckCircle2, XCircle, Clock, Trash2, ExternalLink, Eye, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const AGENT_STEPS = [
  { id: 1, name: "Phân tích xu hướng", icon: Search, desc: "Trend Research Agent", time: 8000 },
  { id: 2, name: "Lập chiến lược", icon: BrainCircuit, desc: "Strategy Planner Agent", time: 8000 },
  { id: 3, name: "Viết nội dung", icon: PenTool, desc: "Content Writer Agent", time: 8000 },
  { id: 4, name: "Tạo prompt hình ảnh & video", icon: Palette, desc: "Prompt Generator Agent", time: 8000 },
  { id: 5, name: "Lưu vào kho", icon: Save, desc: "Saving", time: 2000 }
];

export default function AIPipeline() {
  const [activeTab, setActiveTab] = useState<"run" | "history">("run");
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            AI Marketing Pipeline
          </h1>
          <p className="mt-2 text-muted-foreground">Chạy toàn bộ quy trình marketing với đội ngũ Agent AI tự động.</p>
        </div>

        <div className="flex gap-4 border-b border-border/50 pb-px">
          <button 
            onClick={() => setActiveTab("run")}
            className={`pb-3 font-medium text-sm transition-all relative ${activeTab === "run" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Chạy Pipeline Mới
            {activeTab === "run" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`pb-3 font-medium text-sm transition-all relative ${activeTab === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Lịch sử Pipeline
            {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        </div>

        {activeTab === "run" ? <RunPipelineTab /> : <HistoryTab />}
      </div>
    </AppLayout>
  );
}

function RunPipelineTab() {
  const { data: brands } = useListBrands();
  const { toast } = useToast();
  const runMutation = useRunPipeline();
  
  const [formData, setFormData] = useState({
    brandId: 0,
    topic: "",
    goal: "",
    platforms: ["Facebook"] as string[],
    contentCount: 1,
    storeSituation: ""
  });

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    let timer: any;
    if (isRunning && currentStep < AGENT_STEPS.length) {
      timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, AGENT_STEPS[currentStep].time);
    }
    return () => clearTimeout(timer);
  }, [isRunning, currentStep]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn cửa hàng", variant: "destructive" });
      return;
    }
    
    setIsRunning(true);
    setCurrentStep(0);
    setResult(null);

    if (formData.platforms.length === 0) {
      toast({ title: "Lỗi", description: "Vui lòng chọn ít nhất 1 nền tảng", variant: "destructive" });
      return;
    }

    runMutation.mutate({ data: { ...formData, platform: formData.platforms.join(",") } }, {
      onSuccess: (data) => {
        setIsRunning(false);
        setCurrentStep(AGENT_STEPS.length);
        setResult(data);
        const totalPlans = data.savedPlanIds?.length ?? 0;
        const platList = formData.platforms.join(", ");
        toast({ title: "Thành công", description: `Đã tạo ${totalPlans} bài viết cho ${platList}` });
      },
      onError: (err) => {
        setIsRunning(false);
        toast({ title: "Lỗi", description: "Có lỗi xảy ra khi chạy pipeline", variant: "destructive" });
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy", description: "Đã lưu vào bộ nhớ tạm" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Form */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Thương hiệu</label>
              <select 
                required
                value={formData.brandId} 
                onChange={e => setFormData({...formData, brandId: Number(e.target.value)})}
                disabled={isRunning}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50"
              >
                <option value={0}>-- Chọn cửa hàng --</option>
                {brands?.map(b => (
                  <option key={b.id} value={b.id}>{b.brandName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                Tình trạng cửa hàng
                <span className="text-xs text-muted-foreground font-normal">(không bắt buộc)</span>
              </label>
              <textarea
                rows={4}
                value={formData.storeSituation}
                onChange={e => setFormData({...formData, storeSituation: e.target.value})}
                disabled={isRunning}
                placeholder={"Vd: Tiệm mới mở được 2 tháng, lượng khách chưa đông, chủ yếu khách walk-in, chưa có nhiều review Google. Muốn tăng nhận diện và kéo khách đặt lịch trước..."}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50 resize-none text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">AI sẽ phân tích tình trạng thực tế và đưa ra chiến lược phù hợp hơn</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chủ đề (Topic)</label>
              <input 
                required
                value={formData.topic}
                onChange={e => setFormData({...formData, topic: e.target.value})}
                disabled={isRunning}
                placeholder="Vd: Nail mùa hè 2025"
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mục tiêu (Goal)</label>
              <input 
                required
                value={formData.goal}
                onChange={e => setFormData({...formData, goal: e.target.value})}
                disabled={isRunning}
                placeholder="Vd: Kéo khách tới tiệm, tăng nhận diện"
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Nền tảng</span>
                {formData.platforms.length > 0 && (
                  <span className="text-xs text-primary font-normal">{formData.platforms.join(", ")}</span>
                )}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Facebook', 'Instagram', 'TikTok'].map(plat => {
                  const selected = formData.platforms.includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        const next = selected
                          ? formData.platforms.filter(p => p !== plat)
                          : [...formData.platforms, plat];
                        setFormData({ ...formData, platforms: next });
                      }}
                      className={`py-2 text-sm rounded-lg border font-medium transition-all ${selected ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary'} disabled:opacity-50`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Chọn nhiều nền tảng — AI sẽ viết nội dung riêng cho từng nền tảng</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Số lượng bài viết</label>
              <input 
                type="number"
                min={1}
                max={5}
                required
                value={formData.contentCount}
                onChange={e => setFormData({...formData, contentCount: Number(e.target.value)})}
                disabled={isRunning}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50"
              />
            </div>

            <button 
              type="submit"
              disabled={isRunning || runMutation.isPending}
              className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRunning ? (
                <span className="animate-pulse flex items-center gap-2">
                  <Bot className="w-5 h-5 animate-spin" /> Đang chạy Agents...
                </span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Chạy Pipeline AI
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Results / Progress */}
      <div className="lg:col-span-8">
        {!isRunning && !result && (
          <div className="h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-card/50">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Hệ thống AI Agents</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">Điền thông tin và chạy pipeline để đội ngũ AI tự động nghiên cứu, lập chiến lược và viết nội dung.</p>
          </div>
        )}

        {isRunning && (
          <div className="bg-card rounded-2xl border border-border/50 p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Bot className="w-6 h-6 text-primary animate-bounce" /> 
              Pipeline đang xử lý...
            </h3>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {AGENT_STEPS.map((step, idx) => {
                const isActive = currentStep === idx;
                const isPast = currentStep > idx;
                const isPending = currentStep < idx;
                
                return (
                  <div key={step.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active transition-all duration-500 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-secondary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-300">
                      {isPast ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : isActive ? (
                        <step.icon className="w-4 h-4 text-primary animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      )}
                    </div>
                    <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border transition-all duration-300 ${isActive ? 'bg-primary/10 border-primary/50 shadow-md translate-x-1' : 'bg-card border-border/50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{step.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                      {isActive && (
                        <div className="mt-3 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-1.5 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result && !isRunning && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div>
                  <h3 className="font-bold text-emerald-600 dark:text-emerald-400">Pipeline hoàn tất thành công!</h3>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">Đã tạo và lưu {result.savedPlanIds?.length ?? result.contentCount} bài viết cho {result.platform} vào kho nội dung.</p>
                </div>
              </div>
              <Link href="/calendar" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                Xem Lịch <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            {/* Results sections */}
            <div className="bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden">
              <ResultSection title="1. Phân tích Xu hướng" icon={Search} defaultOpen={true}>
                {result.trendData && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Điểm xu hướng</span>
                        <span className="font-bold text-primary">{result.trendData.trendScore}/100</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div className="bg-gradient-to-r from-yellow-500 to-red-500 h-2 rounded-full" style={{ width: `${result.trendData.trendScore}%` }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Từ khóa thịnh hành</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.trendData.keywords.map((kw: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-secondary text-sm rounded-full border border-border/50">{kw}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Góc tiếp cận đề xuất</h4>
                        <ul className="space-y-1">
                          {result.trendData.recommendedAngles.map((angle: string, i: number) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span> {angle}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Bối cảnh thời điểm</h4>
                        <p className="text-sm">{result.trendData.seasonalContext}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ResultSection>

              <div className="h-px bg-border/50 w-full" />

              <ResultSection title="2. Chiến lược Marketing" icon={BrainCircuit} defaultOpen={true}>
                {result.strategyData && (
                  <div className="space-y-6">
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-primary text-white text-xs font-bold rounded uppercase">{result.strategyData.marketingModel}</span>
                        <span className="text-sm font-medium text-primary">Mô hình được chọn</span>
                      </div>
                      <p className="text-sm mb-3">{result.strategyData.modelExplanation}</p>
                      <p className="text-sm text-muted-foreground border-t border-primary/10 pt-3"><span className="font-semibold text-foreground">Lý do:</span> {result.strategyData.reasoning}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Góc độ Campaign</span>
                        <p className="font-medium mt-1">{result.strategyData.campaignAngle}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Giai đoạn phễu</span>
                        <p className="font-medium mt-1">{result.strategyData.funnelStage}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Cảm xúc mục tiêu</span>
                        <p className="font-medium mt-1">{result.strategyData.targetEmotion}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ResultSection>

              <div className="h-px bg-border/50 w-full" />

              <ResultSection title="3. Nội dung & Copywriting" icon={PenTool} defaultOpen={false}>
                {result.contentData && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-3">Hooks Thu Hút</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {result.contentData.hooks.map((hook: string, i: number) => (
                          <div key={i} className="p-3 bg-secondary/50 rounded-xl text-sm border border-border/50 relative group">
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">{i+1}</span>
                            {hook}
                            <button onClick={() => copyToClipboard(hook)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-background rounded-md shadow"><Copy className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-3">Nội dung chính</h4>
                      <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-sm whitespace-pre-wrap relative group">
                        {result.contentData.mainCaption}
                        <button onClick={() => copyToClipboard(result.contentData.mainCaption)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-background rounded-md shadow hover:text-primary"><Copy className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {result.contentData.hashtags.map((tag: string, i: number) => (
                        <span key={i} className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </ResultSection>

              <div className="h-px bg-border/50 w-full" />

              <ResultSection title="4. Prompts Hình ảnh/Video" icon={Palette} defaultOpen={false}>
                {result.promptData && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2"><Palette className="w-4 h-4 text-purple-500" /> Image Prompt</h4>
                        <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-sm relative group h-full">
                          {result.promptData.imagePrompt}
                          <button onClick={() => copyToClipboard(result.promptData.imagePrompt)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-background rounded-md shadow hover:text-primary"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2"><Palette className="w-4 h-4 text-blue-500" /> Video Prompt</h4>
                        <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-sm relative group h-full">
                          {result.promptData.videoPrompt}
                          <button onClick={() => copyToClipboard(result.promptData.videoPrompt)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-background rounded-md shadow hover:text-primary"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-4">
                      <div className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium border border-border/50">
                        <span className="text-muted-foreground mr-1">Style:</span> {result.promptData.visualStyle}
                      </div>
                      <div className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium border border-border/50">
                        <span className="text-muted-foreground mr-1">Camera:</span> {result.promptData.cameraDirection}
                      </div>
                      <div className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium border border-border/50">
                        <span className="text-muted-foreground mr-1">Color:</span> {result.promptData.colorPalette}
                      </div>
                    </div>
                  </div>
                )}
              </ResultSection>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultSection({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const [brandId, setBrandId] = useState<number | undefined>();
  const { data: brands } = useListBrands();
  const { data: runs, isLoading } = useListPipelineRuns({ brandId });
  const deleteMutation = useDeletePipelineRun();
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    if (confirm("Bạn có chắc muốn xóa lịch sử này?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Thành công", description: "Đã xóa lịch sử pipeline" });
        }
      });
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
      <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/10">
        <h3 className="font-bold text-lg">Lịch sử chạy Pipeline</h3>
        <select 
          value={brandId || ""}
          onChange={e => setBrandId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/50 outline-none text-sm"
        >
          <option value="">Tất cả cửa hàng</option>
          {brands?.map(b => (
            <option key={b.id} value={b.id}>{b.brandName}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/20">
            <tr>
              <th className="px-6 py-4 font-medium">Cửa hàng / Thời gian</th>
              <th className="px-6 py-4 font-medium">Chủ đề & Mục tiêu</th>
              <th className="px-6 py-4 font-medium">Nền tảng</th>
              <th className="px-6 py-4 font-medium">Trạng thái</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Đang tải dữ liệu...</td>
              </tr>
            ) : !runs || runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Chưa có lịch sử chạy pipeline nào</td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{run.brandName || `Cửa hàng #${run.brandId}`}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> {formatDate(run.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="font-medium truncate">{run.topic}</div>
                    <div className="text-xs text-muted-foreground truncate mt-1">Mục tiêu: {run.goal}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium border border-border/50">
                      {run.platform}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {run.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                      </span>
                    ) : run.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" /> Thất bại
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        <Bot className="w-3.5 h-3.5 animate-pulse" /> Đang chạy
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedRunId(run.id)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(run.id)}
                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRunId && (
        <RunDetailModal id={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  );
}

function RunDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: run, isLoading } = useGetPipelineRun(id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-border/50 flex flex-col animate-in fade-in zoom-in duration-300">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-secondary/10">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Chi tiết Pipeline #{id}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Bot className="w-10 h-10 text-muted-foreground animate-spin" />
              <p className="mt-4 text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          ) : !run ? (
            <div className="py-20 text-center text-muted-foreground">Không tìm thấy dữ liệu.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Chủ đề</span>
                  <p className="font-medium text-sm">{run.topic}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Mục tiêu</span>
                  <p className="font-medium text-sm">{run.goal}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Nền tảng</span>
                  <p className="font-medium text-sm">{run.platform}</p>
                </div>
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Số bài viết</span>
                  <p className="font-medium text-sm">{run.contentCount}</p>
                </div>
              </div>

              {run.storeSituation && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-xs text-amber-500/80 font-medium uppercase tracking-wide block mb-1">Tình trạng cửa hàng</span>
                  <p className="text-sm text-foreground/80 leading-relaxed">{run.storeSituation}</p>
                </div>
              )}

              {run.errorMessage && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-sm">
                  <strong className="block mb-1">Lỗi:</strong> {run.errorMessage}
                </div>
              )}

              <div className="space-y-4">
                {run.trendData && (
                  <ResultSection title="Phân tích Xu hướng" icon={Search} defaultOpen={false}>
                    <div className="text-sm space-y-2">
                      <p><strong>Điểm xu hướng:</strong> {run.trendData.trendScore}</p>
                      <p><strong>Từ khóa:</strong> {run.trendData.keywords.join(", ")}</p>
                      <p><strong>Bối cảnh:</strong> {run.trendData.seasonalContext}</p>
                    </div>
                  </ResultSection>
                )}
                
                {run.strategyData && (
                  <ResultSection title="Chiến lược Marketing" icon={BrainCircuit} defaultOpen={false}>
                    <div className="text-sm space-y-2">
                      <p><strong>Mô hình:</strong> {run.strategyData.marketingModel}</p>
                      <p><strong>Lý do:</strong> {run.strategyData.reasoning}</p>
                      <p><strong>Góc độ:</strong> {run.strategyData.campaignAngle}</p>
                      <p><strong>Giai đoạn phễu:</strong> {run.strategyData.funnelStage}</p>
                    </div>
                  </ResultSection>
                )}
                
                {run.contentData && (
                  <ResultSection title="Nội dung" icon={PenTool} defaultOpen={false}>
                    <div className="text-sm space-y-2">
                      <p className="whitespace-pre-wrap"><strong>Nội dung chính:</strong><br/>{run.contentData.mainCaption}</p>
                      <p><strong>CTA:</strong> {run.contentData.cta}</p>
                    </div>
                  </ResultSection>
                )}
                
                {run.promptData && (
                  <ResultSection title="Prompts" icon={Palette} defaultOpen={false}>
                    <div className="text-sm space-y-2">
                      <p><strong>Hình ảnh:</strong> {run.promptData.imagePrompt}</p>
                      <p><strong>Video:</strong> {run.promptData.videoPrompt}</p>
                      <p><strong>Phong cách:</strong> {run.promptData.visualStyle}</p>
                    </div>
                  </ResultSection>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
