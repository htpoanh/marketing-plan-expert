import { useState } from "react";
import { useListBrands, useGetReviewStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Star, MessageCircleReply, MessageCircleWarning, TrendingUp } from "lucide-react";

export default function ReviewReports() {
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const { data: brands } = useListBrands();
  const { data: stats } = useGetReviewStats({ brandId: selectedBrand });

  const currentStats = stats?.[0]; // If filtered, or we map over them. Let's assume we show total or selected.
  
  // Aggregate if no brand selected
  const aggregated = stats?.reduce((acc, curr) => ({
    totalReviews: acc.totalReviews + curr.totalReviews,
    repliedCount: acc.repliedCount + curr.repliedCount,
    unrepliedCount: acc.unrepliedCount + curr.unrepliedCount,
    rating1Count: acc.rating1Count + curr.rating1Count,
    rating2Count: acc.rating2Count + curr.rating2Count,
    rating3Count: acc.rating3Count + curr.rating3Count,
    rating4Count: acc.rating4Count + curr.rating4Count,
    rating5Count: acc.rating5Count + curr.rating5Count,
    averageRating: 0 // Will calculate
  }), {
    totalReviews: 0, repliedCount: 0, unrepliedCount: 0,
    rating1Count: 0, rating2Count: 0, rating3Count: 0, rating4Count: 0, rating5Count: 0, averageRating: 0
  });

  if (aggregated && aggregated.totalReviews > 0) {
    aggregated.averageRating = (
      (aggregated.rating1Count * 1 + aggregated.rating2Count * 2 + aggregated.rating3Count * 3 + 
       aggregated.rating4Count * 4 + aggregated.rating5Count * 5) / aggregated.totalReviews
    );
  }

  const displayStats = selectedBrand ? currentStats : aggregated;

  const chartData = displayStats ? [
    { name: '1 Sao', value: displayStats.rating1Count, color: '#ef4444' },
    { name: '2 Sao', value: displayStats.rating2Count, color: '#f97316' },
    { name: '3 Sao', value: displayStats.rating3Count, color: '#f59e0b' },
    { name: '4 Sao', value: displayStats.rating4Count, color: '#84cc16' },
    { name: '5 Sao', value: displayStats.rating5Count, color: '#22c55e' },
  ] : [];

  const statCards = [
    { label: "Tổng đánh giá", value: displayStats?.totalReviews || 0, icon: Star, color: "text-blue-500" },
    { label: "Điểm trung bình", value: (displayStats?.averageRating || 0).toFixed(1), icon: TrendingUp, color: "text-amber-500" },
    { label: "Đã phản hồi", value: displayStats?.repliedCount || 0, icon: MessageCircleReply, color: "text-emerald-500" },
    { label: "Chưa phản hồi", value: displayStats?.unrepliedCount || 0, icon: MessageCircleWarning, color: "text-rose-500" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Báo cáo Đánh giá
            </h1>
            <p className="mt-2 text-muted-foreground">Phân tích hiệu quả dịch vụ qua phản hồi của khách hàng.</p>
          </div>
          
          <select 
            value={selectedBrand || ""} 
            onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
            className="px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/50 outline-none w-full sm:w-64"
          >
            <option value="">Tất cả cửa hàng (Tổng hợp)</option>
            {brands?.map(b => (
              <option key={b.id} value={b.id}>{b.brandName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, idx) => (
            <div key={idx} className="bg-card p-6 rounded-2xl border border-border/50 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <h3 className="text-3xl font-display font-bold mt-2">{card.value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-secondary ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-xl">
            <h3 className="text-lg font-bold mb-6 font-display">Phân bổ đánh giá</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                    contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff'}} 
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-xl flex flex-col justify-center items-center text-center">
             <div className="w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center relative mb-6">
                <div className="absolute inset-0 rounded-full border-8 border-primary" 
                     style={{clipPath: `polygon(0 0, 100% 0, 100% ${displayStats?.totalReviews ? (displayStats.repliedCount / displayStats.totalReviews * 100) : 0}%, 0 ${displayStats?.totalReviews ? (displayStats.repliedCount / displayStats.totalReviews * 100) : 0}%)`}}>
                </div>
                <span className="text-2xl font-bold font-display text-primary">
                  {displayStats?.totalReviews ? Math.round((displayStats.repliedCount / displayStats.totalReviews) * 100) : 0}%
                </span>
             </div>
             <h3 className="text-xl font-bold">Tỉ lệ phản hồi</h3>
             <p className="text-muted-foreground mt-2 max-w-sm">
               Hệ thống AI đang giúp bạn tự động trả lời 
               <strong className="text-foreground ml-1">{displayStats?.repliedCount}</strong> đánh giá, 
               cải thiện trải nghiệm khách hàng ngay lập tức.
             </p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
