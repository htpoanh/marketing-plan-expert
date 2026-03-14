import { useListBrands, useListReviews, useListContentPlans } from "@workspace/api-client-react";
import { Store, MessageSquareText, CalendarDays, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Dashboard() {
  const { data: brands } = useListBrands();
  const { data: reviews } = useListReviews();
  const { data: plans } = useListContentPlans();

  const stats = [
    {
      title: "Tổng số cửa hàng",
      value: brands?.length || 0,
      icon: Store,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      title: "Đánh giá chờ phản hồi",
      value: reviews?.filter(r => !r.replied).length || 0,
      icon: MessageSquareText,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    },
    {
      title: "Bài đăng chờ duyệt",
      value: plans?.filter(p => p.status === 'review').length || 0,
      icon: CheckCircle2,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20"
    },
    {
      title: "Bài đăng đã lên lịch",
      value: plans?.filter(p => p.status === 'scheduled').length || 0,
      icon: CalendarDays,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Tổng quan hệ thống
          </h1>
          <p className="mt-2 text-muted-foreground">Theo dõi toàn bộ hoạt động marketing của các cửa hàng.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div 
              key={idx} 
              className={`glass-panel p-6 rounded-2xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${stat.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                  <h3 className="text-3xl font-display font-bold">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Reviews Summary */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-primary" />
              Đánh giá gần đây
            </h3>
            {(!reviews || reviews.length === 0) ? (
              <p className="text-muted-foreground text-sm">Chưa có đánh giá nào.</p>
            ) : (
              <div className="space-y-4">
                {reviews.slice(0, 4).map(review => (
                  <div key={review.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{review.reviewerName}</span>
                      <span className="text-amber-500 text-xs flex items-center">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{review.reviewText || "Không có nội dung"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Content */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Bài đăng sắp tới
            </h3>
            {(!plans || plans.length === 0) ? (
              <p className="text-muted-foreground text-sm">Chưa có bài đăng nào được lên lịch.</p>
            ) : (
              <div className="space-y-4">
                {plans.slice(0, 4).map(plan => (
                  <div key={plan.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary">
                      <span className="text-xs font-medium uppercase">{new Date(plan.publishDate).toLocaleDateString('vi-VN', { month: 'short' })}</span>
                      <span className="font-bold">{new Date(plan.publishDate).getDate()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{plan.topic}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{plan.platform}</span>
                        <span className="text-xs text-muted-foreground">
                          Trạng thái: <span className="text-primary">{plan.status}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
