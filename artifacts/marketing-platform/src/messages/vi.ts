// Vietnamese — default locale. Other locales fall back to these keys
// when missing. Keep keys flat + dot-namespaced.

const vi: Record<string, string> = {
  // ── Common ──────────────────────────────────────────────────────────────
  "common.brand": "Cửa hàng",
  "common.brand.choose": "— Chọn cửa hàng —",
  "common.service": "Service / sản phẩm",
  "common.language": "Ngôn ngữ",
  "common.bypassCache": "Bỏ qua cache (tạo mới — tốn token)",
  "common.bypassCache.hint":
    "Mặc định cùng input + cùng brand trong 7 ngày sẽ trả lại report cũ, miễn phí.",
  "common.cacheHit.title": "Cache hit — không gọi AI",
  "common.cacheHit.body":
    "(report cũ ngày {date} — tiết kiệm €{cost}). Tick \"Bỏ qua cache\" trong form nếu muốn tạo mới.",
  "common.error.notSelectedBrand": "Chưa chọn cửa hàng",
  "common.error.serverError": "Không kết nối được máy chủ",
  "common.action.generate": "Tạo",
  "common.action.export": "Export",
  "common.loading": "Đang tải...",

  // ── Ads Strategy page ──────────────────────────────────────────────────
  "ads.page.title": "Ads Strategy Agent",
  "ads.page.subtitle":
    "4 module AI giúp tối ưu quảng cáo: phân tích đối tượng (M1), keyword có sức nặng (M2), audit performance (M3), bắt trend (M4). Vietnamese UI, German output cho ads/copy.",
  "ads.tab.audience": "M1 — Đối tượng",
  "ads.tab.keywords": "M2 — Keyword",
  "ads.tab.performance": "M3 — Performance",
  "ads.tab.trend": "M4 — Trend",

  // ── M1 Audience ────────────────────────────────────────────────────────
  "ads.audience.title": "M1 — Phân tích đối tượng",
  "ads.audience.servicePlaceholder": "VD: Gel-Nägel Sommer 2026",
  "ads.audience.goal": "Mục tiêu chiến dịch",
  "ads.audience.goal.awareness": "Nhận diện thương hiệu",
  "ads.audience.goal.traffic": "Traffic website",
  "ads.audience.goal.leads": "Tìm khách tiềm năng (Leads)",
  "ads.audience.goal.conversions": "Chuyển đổi (Booking/Sale)",
  "ads.audience.goal.retention": "Giữ khách cũ",
  "ads.audience.budget": "Ngân sách hàng tháng (€)",
  "ads.audience.languageHint":
    "Tên persona + interests Meta luôn là tiếng Đức (yêu cầu Meta DE).",
  "ads.audience.submit.idle": "Tạo personas",
  "ads.audience.submit.loading": "Đang sinh personas…",
  "ads.audience.empty":
    "Nhập form bên trái và bấm \"Tạo personas\" để bắt đầu.",
  "ads.audience.empty.hint":
    "Output: 3-5 personas + Meta/Google targeting JSON sẵn sàng paste vào Ads Manager.",
  "ads.audience.toast.success": "Đã tạo personas",
  "ads.audience.toast.error": "Tạo persona thất bại",

  // ── M2 Keywords ────────────────────────────────────────────────────────
  "ads.keywords.title": "M2 — Keyword có sức nặng",
  "ads.keywords.servicePlaceholder": "VD: Gel-Nägel Kempten",
  "ads.keywords.competitors": "Đối thủ (mỗi dòng / dấu phẩy)",
  "ads.keywords.competitorsPlaceholder":
    "VD: Nail Lounge Kempten, Beauty Studio Allgäu",
  "ads.keywords.competitorsHint":
    "Để trống → bỏ qua nhóm \"defensive keywords\".",
  "ads.keywords.languageHint":
    "Keywords luôn là tiếng Đức (customer search language).",
  "ads.keywords.submit.idle": "Sinh keywords",
  "ads.keywords.submit.loading": "Đang sinh keywords…",
  "ads.keywords.empty":
    "Nhập form bên trái để sinh 4 nhóm keyword theo intent.",
  "ads.keywords.toast.success": "Đã sinh keywords",
  "ads.keywords.toast.error": "Sinh keywords thất bại",

  // ── M3 Performance ─────────────────────────────────────────────────────
  "ads.performance.title": "M3 — Performance Reality",
  "ads.performance.cplTarget": "CPL target (€)",
  "ads.performance.avgTicket": "Avg ticket (€)",
  "ads.performance.roasTarget": "ROAS target (tuỳ chọn)",
  "ads.performance.submit.idle": "Phân tích performance",
  "ads.performance.submit.loading": "Đang phân tích…",
  "ads.performance.empty":
    "Upload CSV ads (Meta hoặc Google) → AI sẽ phân tích lãng phí và đề xuất chia lại budget.",
  "ads.performance.exportPdf": "Print / Export PDF",
  "ads.performance.toast.success": "Đã phân tích xong",
  "ads.performance.toast.error": "Phân tích thất bại",

  // ── M4 Trend ───────────────────────────────────────────────────────────
  "ads.trend.title": "M4 — Trend Pulse",
  "ads.trend.regionFocus": "Region tập trung",
  "ads.trend.regionPlaceholder": "VD: Bayern",
  "ads.trend.regionHint":
    "Grok sẽ search web/X/news Đức trong region này.",
  "ads.trend.topic": "Topic seed (tuỳ chọn)",
  "ads.trend.topicPlaceholder":
    "VD: Nail Trends 2026 (để trống = tự discover)",
  "ads.trend.submit.idle": "Quét trend (Live Search)",
  "ads.trend.submit.loading": "Đang quét trend…",
  "ads.trend.empty":
    "Grok 3 sẽ search real-time web/X/news Đức để tìm trend đang lên trong region của bạn.",
  "ads.trend.toast.success": "Đã quét trend xong",
  "ads.trend.toast.error": "Quét trend thất bại",

  // ── Language switcher ─────────────────────────────────────────────────
  "lang.switcher.label": "Ngôn ngữ giao diện",
  "lang.vi": "Tiếng Việt",
  "lang.de": "Deutsch",
  "lang.en": "English",
};

export default vi;
