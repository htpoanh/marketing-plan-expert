import { useState } from "react";
import { 
  useListReviews, 
  useListBrands,
  useGenerateReviewReply,
  useSaveReviewReply,
  getListReviewsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { Star, Bot, Check, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GoogleReviews() {
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const { data: brands } = useListBrands();
  const { data: reviews, isLoading } = useListReviews({ brandId: selectedBrand });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const generateReply = useGenerateReviewReply({
    mutation: {
      onSuccess: (data, variables) => {
        // Once generated, immediately save it
        saveReply.mutate({ id: variables.id, data: { replyText: data.reply } });
      },
      onError: () => {
        setGeneratingId(null);
        toast({ title: "Lỗi", description: "Không thể tạo phản hồi", variant: "destructive" });
      }
    }
  });

  const saveReply = useSaveReviewReply({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ brandId: selectedBrand }) });
        setGeneratingId(null);
        toast({ title: "Thành công", description: "Đã phản hồi đánh giá" });
      },
      onError: () => {
        setGeneratingId(null);
        toast({ title: "Lỗi", description: "Không thể lưu phản hồi", variant: "destructive" });
      }
    }
  });

  const handleAutoReply = (id: number) => {
    setGeneratingId(id);
    generateReply.mutate({ id });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Đánh giá Google
          </h1>
          <p className="mt-2 text-muted-foreground">Quản lý và trả lời đánh giá tự động bằng AI.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              placeholder="Tìm kiếm đánh giá..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select 
              value={selectedBrand || ""} 
              onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/50 outline-none appearance-none cursor-pointer"
            >
              <option value="">Tất cả cửa hàng</option>
              {brands?.map(b => (
                <option key={b.id} value={b.id}>{b.brandName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reviews List */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Đang tải...</div>
          ) : !reviews || reviews.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Chưa có đánh giá nào</h3>
              <p className="text-muted-foreground text-sm mt-1">Các đánh giá Google Maps sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {reviews.map((review) => (
                <div key={review.id} className="p-6 hover:bg-secondary/20 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center font-bold text-primary">
                          {review.reviewerName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{review.reviewerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(review.reviewDate), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="ml-auto flex">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-4 h-4 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      <p className="text-sm mt-3 leading-relaxed text-foreground/90">
                        {review.reviewText || <span className="italic text-muted-foreground">Không có nội dung đánh giá</span>}
                      </p>
                      
                      {review.replied && review.replyText && (
                        <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border/50 ml-4 relative">
                          <div className="absolute -left-2 top-4 w-2 h-2 bg-secondary border-t border-l border-border/50 rotate-45"></div>
                          <p className="text-xs font-bold text-primary mb-1 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Đã phản hồi
                          </p>
                          <p className="text-sm text-muted-foreground">{review.replyText}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="lg:w-48 flex items-start justify-end shrink-0">
                      {!review.replied ? (
                        <button
                          onClick={() => handleAutoReply(review.id)}
                          disabled={generatingId === review.id}
                          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 disabled:opacity-50"
                        >
                          {generatingId === review.id ? (
                            <span className="animate-pulse">Đang viết...</span>
                          ) : (
                            <>
                              <Bot className="w-4 h-4" />
                              AI Trả lời
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-medium w-full text-center flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Hoàn tất
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
