import { db } from "@workspace/db";
import { brandsTable } from "@workspace/db/schema";

const brands = [
  {
    brandName: "Happy Wok Imbiss",
    industry: "F&B – Imbiss / Takeaway",
    branchLocation: "Kempten (Allgäu)",
    address: "Kotternerstraße 48, 87435 Kempten (Allgäu)",
    phone: "+49 831 69729590",
    businessHours: "Bitte auf Website prüfen",
    targetAudience: "Sinh viên từ 18 tuổi, người Đức, khách cần ăn take away. Đặc biệt: học sinh Berufsschule trong giờ nghỉ trưa.",
    brandVoice: `Tone: Năng động
Brand Tagline (DE): Frische asiatische Küche in Kempten – schnell, lecker & preiswert.
Content Pillars: Schulstart-Hook, Wok in Aktion, Mittagsangebote, ASMR Food
Hashtags: #HappyWokKempten #Kempten #BerufsschuleKempten #AsianFood #TakeAway
Lieferando: Ja – Liefergebühr 1€, Mindestbestellung 20€, Lieferzeit 30–50 min, Bewertung 4.6
Location Context: Cạnh siêu thị châu Á (Asia Supermarkt), đối diện trường Berufsschule. Không có chỗ gửi xe.
Hinweis: Gleiche Adresse und Telefon wie Asia Supermarkt Thai Hoang.`,
    websiteUrl: "https://www.happy-wok-imbiss.de",
    facebookUrl: "https://www.facebook.com/61581020969953",
    instagramUrl: "https://www.instagram.com/happywok.ke",
    tiktokUrl: "https://www.tiktok.com/@happywok.ke",
  },
  {
    brandName: "Paradise Nails Kempten",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Kempten (Allgäu)",
    address: "Kotterner Straße 70, 87435 Kempten (Allgäu)",
    phone: "+49 831 52370737",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten, từ 13 tuổi, sử dụng TikTok, Facebook, Instagram.",
    brandVoice: `Tone: Sang trọng
Content Pillars: Frühlings-/Saisondesigns, Before/After, Trending Nail Trends, Review-Aufruf
Hashtags: #ParadiseNailsKempten #NailsKempten #NagelstudioKempten #Kempten #NailTrends2026
Booking: https://paradise-nail-studio.de/en/book/kempten
Location Context: Đối diện trung tâm thương mại Forum Kempten.
Social: Facebook 541 followers, Instagram @paradisenails_ke 773 followers 376 posts, TikTok chung Paradise Nails Kempten0207`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/100051715183575",
    instagramUrl: "https://www.instagram.com/paradisenails_ke",
    tiktokUrl: "https://www.tiktok.com/@ParadiseNailsKempten0207",
  },
  {
    brandName: "Paradise Nails Memmingen",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Memmingen",
    address: "Kramerstraße 10, 87700 Memmingen",
    phone: "+49 8331 9292662",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, từ 13 tuổi, sử dụng TikTok, Facebook, Instagram. Thích design.",
    brandVoice: `Tone: Sang trọng, thích design
Content Pillars: Design-Inspiration, Saison-Rabattaktionen, Quick Nail Reels
Hashtags: #ParadiseNailsMemmingen #Memmingen #NagelstudioMemmingen #NailsMemmingen
Booking: https://paradise-nail-studio.de/en/book/memmingen
Location Context: Khu phố cổ Memmingen (Altstadt).
Social: Instagram @paradisenails.memmingen 148 followers 12 posts
PRIORITÄT: Sehr schwache Social-Media-Präsenz (12 Posts IG). Höchste Priorität für Content-Aufbau.`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: null,
    instagramUrl: "https://www.instagram.com/paradisenails.memmingen",
    tiktokUrl: null,
  },
  {
    brandName: "Paradise Nails Lindau",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Lindau (Bodensee)",
    address: "Rickenbacher Straße 8, 88131 Lindau (Bodensee)",
    phone: "+49 8382 2737826",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, từ 13 tuổi, sử dụng TikTok, Facebook, Instagram. Lịch lãm, đi mua sắm rồi làm nails.",
    brandVoice: `Tone: Sang trọng, lịch lãm – mua sắm & nails lifestyle
Content Pillars: Sommerwimpern, WOW-Reveal, Lindaupark Location, Design-Carousel
Hashtags: #ParadiseNailsLindau #Lindau #LindauBodensee #NagelstudioLindau #LindauPark
Booking: https://paradise-nail-studio.de/en/book/lindau
Location Context: Điểm giao nhau của Áo–Đức–Thụy Sĩ (Dreiländereck). Nah am Lindaupark.
Social: Facebook 683 followers, Instagram @paradisenails.lindau 1120 followers 113 posts`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/100063490955319",
    instagramUrl: "https://www.instagram.com/paradisenails.lindau",
    tiktokUrl: null,
  },
  {
    brandName: "Halong Salon de Beauté Kempten",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Kempten (Allgäu) – Forum Allgäu",
    address: "OG 1, August-Fischer-Platz 1, 87435 Kempten (Allgäu) – Forum Allgäu",
    phone: "+49 831 57538389",
    businessHours: "Mo–Sa 09:00–20:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, khách mua sắm tại Forum Allgäu.",
    brandVoice: `Tone: TBD – Brand profile not fully configured
Content Pillars: Forum Allgäu Shopping, Walk-in Angebote, Frühlings-Designs
Hashtags: #HalongNailsKempten #ForumAllgäu #Kempten #NagelstudioKempten
Booking: https://paradise-nail-studio.de/en/book/halong
Location Context: Im Einkaufszentrum Forum Allgäu OG 1. Hohes Laufkundschaft-Potenzial.
⚠️ ON HOLD: FB Page privat, kein Instagram. Zugang klären bevor Content erstellt wird.`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/100083326152909",
    instagramUrl: null,
    tiktokUrl: null,
  },
  {
    brandName: "Paradise Nails Friedrichshafen (Schanzstraße)",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Friedrichshafen",
    address: "Schanzstraße 16, 88045 Friedrichshafen",
    phone: "+49 7541 3783983",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, từ 13 tuổi, sử dụng TikTok, Facebook, Instagram. Thích design.",
    brandVoice: `Tone: Sang trọng, thích design
Content Pillars: Trending Designs, Bodensee-Region Lifestyle, Youth-Kampagnen
Hashtags: #ParadiseNailsFN #Friedrichshafen #NagelstudioFN #NailsFriedrichshafen #FriedrichshafenBodensee
Booking: https://paradise-nail-studio.de/en/book/friedrichshafen
Location Context: Khu vực dân giàu có, trung tâm phố đi bộ và sầm uất Friedrichshafen.
Social: Facebook 95 followers, Instagram @paradisenails.fn 2917 followers 119 posts – Bestes IG im gesamten System!`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/100088097525699",
    instagramUrl: "https://www.instagram.com/paradisenails.fn",
    tiktokUrl: null,
  },
  {
    brandName: "Paradise Nails Friedrichshafen (Karlstraße) – U20 Studio",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Friedrichshafen",
    address: "Karlstraße 38, 88045 Friedrichshafen",
    phone: "+49 7541 9412484",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, từ 13 tuổi. Đặc biệt: khách hàng U20 với giá ưu đãi.",
    brandVoice: `Tone: Sang trọng, thích design – U20 friendly
Content Pillars: U20 Kampagne, Jugend-Zielgruppe, Aktionspreise
Hashtags: #ParadiseNailsFN #Friedrichshafen #U20Angebot #Jugendangebot
Booking: https://paradise-nail-studio.de/en/book/friedrichshafen
Location Context: Khu vực dân giàu có Friedrichshafen. Chương trình U20 giảm giá.
U20 Sonderangebot: Neumodellage Farbe 30€ / Natur 25€ · Auffüllen Farbe 30€ / Natur 25€ – Nur für Kunden bis 20 Jahre, Ausweis erforderlich, nur Karlstr. 38.
WhatsApp: +4915252682822
Hinweis: Teilt FB/IG-Page mit Standort Schanzstr. 16.`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/100088097525699",
    instagramUrl: "https://www.instagram.com/paradisenails.fn",
    tiktokUrl: null,
  },
  {
    brandName: "Coco Nails & Beauty Kempten",
    industry: "Nails & Beauty – Nagelstudio",
    branchLocation: "Kempten (Allgäu)",
    address: "Klostersteige 15, 87435 Kempten (Allgäu)",
    phone: "+49 1511 2322434",
    businessHours: "Mo–Sa 09:00–19:00",
    targetAudience: "Phụ nữ quan tâm làm đẹp, làm móng, từ 13 tuổi, sử dụng TikTok, Facebook, Instagram. Trẻ trung, thích design.",
    brandVoice: `Tone: Trẻ trung, thích design
Content Pillars: Trendy Designs, Preisliste-Carousel, Weekend Booking, Young Audience
Hashtags: #CocoNailsKempten #NailsKempten #NagelstudioKempten #Kempten #NailTrends2026
Booking: https://paradise-nail-studio.de/book/coco
Location Context: Phố đi bộ Kempten (Fußgängerzone).
Social: Facebook 137 followers, Instagram @coco.nails0831 383 followers 100 posts, TikTok chung Paradise Nails Kempten0207`,
    websiteUrl: "https://paradise-nail-studio.de",
    facebookUrl: "https://www.facebook.com/103984482494512",
    instagramUrl: "https://www.instagram.com/coco.nails0831",
    tiktokUrl: "https://www.tiktok.com/@ParadiseNailsKempten0207",
  },
  {
    brandName: "Thai Hoang Asia Supermarkt",
    industry: "F&B – Supermarkt / Asia Grocery",
    branchLocation: "Kempten (Allgäu)",
    address: "Kotternerstraße 48, 87435 Kempten (Allgäu)",
    phone: "+49 831 69729590",
    businessHours: "Mo–Sa 09:00–20:00",
    targetAudience: "Khách hàng Đức và nước ngoài yêu thích ẩm thực Á Đông. Hơn 10.000 mặt hàng thực phẩm khô, tươi từ châu Á.",
    brandVoice: `Tone: Năng động, tiềm năng
Content Pillars: Produkt-Spotlight (seltene Zutaten), Rezept-Ideen, Wochenend-Deals, Store Walk-through
Hashtags: #ThaiHoangSupermarkt #AsiaSupermarktKempten #Kempten #AsiatischeLebensmittel #AsianGrocery
Location Context: Siêu thị châu Á với hơn 10.000 mặt hàng. Đối diện Berufsschule. Không có chỗ gửi xe.
Social: Facebook @ThaiHoangAsianSupermarkt 9 followers (rất mới), Kein Instagram (Empfehlung: @thaihoang.supermarkt), TikTok 7608471550320443410
Hinweis: Gleiche Adresse und Telefon wie Happy Wok. FB-Page sehr neu.`,
    websiteUrl: "https://www.asiasupermarkt-th.de/",
    facebookUrl: "https://www.facebook.com/61588364853237",
    instagramUrl: null,
    tiktokUrl: null,
  },
  {
    brandName: "Taki Taki Restaurant Memmingen",
    industry: "F&B – Restaurant (Vietnamesisch-Japanisch Fusion)",
    branchLocation: "Memmingen",
    address: "Ulmer Straße 7, 87700 Memmingen",
    phone: "+49 8331 4987040",
    businessHours: "Mo–So 11:30–14:30 & 17:30–22:00 (keine Ruhetage)",
    targetAudience: "Khách hàng địa phương và người du lịch. Yêu thích ẩm thực châu Á cao cấp. Capacity ~200 khách.",
    brandVoice: `Tone: Sang trọng
Content Pillars: Food Photography, Mittagsangebote, Abend-Atmosphäre, VN-JP Fusion Stories
Hashtags: #TakiTakiMemmingen #Memmingen #MemmingenRestaurant #VietnamesischJapanisch #Sushi #Pho #AltstadtMemmingen
Cuisine: Vietnamesisch-Japanisch Fusion (Sushi + Pho + Asian Fusion)
Location Context: Nằm trong phố cổ Memmingen (Altstadt), phong cách sang trọng.
Lieferando: Ja
Social: Facebook 272 followers, Instagram @taki_taki_memmingen 884 followers 211 posts`,
    websiteUrl: "https://takitakirestaurant.de/de",
    facebookUrl: "https://www.facebook.com/61552667445398",
    instagramUrl: "https://www.instagram.com/taki_taki_memmingen",
    tiktokUrl: null,
  },
  {
    brandName: "Hafencafé Bodensee",
    industry: "F&B – Café / Restaurant (Saisonal)",
    branchLocation: "Immenstaad am Bodensee",
    address: "Hafencafé Schloss Kirchberg, 88090 Immenstaad am Bodensee",
    phone: "+49 7545 9492120",
    businessHours: "Täglich 11:00–22:00",
    targetAudience: "Touristen, Ausflügler, Bodensee-Region Besucher.",
    brandVoice: `Tone: Entspannt, Bodensee-Lifestyle, Genuss
Content Pillars: Bodensee-Panorama, Kaffee & Atmosphäre, Saisonale Ausflugstipps, Sonnenuntergang-Content
Hashtags: #HafencaféBodensee #Bodensee #Immenstaad #KaffeeAmSee #BodenseeLife
Location Context: Am Bodensee, Schloss Kirchberg in Immenstaad. Saisonales Café mit Seeblick.
⚠️ Noch nicht in Pipeline. FB + IG komplett fehlen. Launch-Woche geplant: 14.04.2026.`,
    websiteUrl: "https://www.hafencafe-bodensee.de",
    facebookUrl: null,
    instagramUrl: null,
    tiktokUrl: null,
  },
];

async function seed() {
  console.log(`Seeding ${brands.length} brands...`);

  // Check existing brands
  const existing = await db.select().from(brandsTable);
  if (existing.length > 0) {
    console.log(`⚠️  ${existing.length} brands already exist. Skipping to avoid duplicates.`);
    console.log("Existing:", existing.map(b => b.brandName).join(", "));
    process.exit(0);
  }

  for (const brand of brands) {
    const [inserted] = await db.insert(brandsTable).values(brand).returning();
    console.log(`✓ Created: ${inserted.brandName} (id: ${inserted.id})`);
  }

  console.log("\n✅ All brands seeded successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
