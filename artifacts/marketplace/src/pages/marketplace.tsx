import { useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ArrowRight, Smartphone, Shirt } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import { ProductCard, Product } from "@/components/product-card";
import { AirtimeModal } from "@/components/airtime-modal";
import { MerchComingSoonModal } from "@/components/merch-coming-soon-modal";
import mtnLogoUrl from "@assets/MTN_Nigeria_1780562125673.svg?url";
import airtelLogoUrl from "@assets/Airtel_Nigeria_1780567636022.svg?url";
import gloLogoUrl from "@assets/Glo_Nigeria_1780568187203.svg?url";
import t2LogoUrl from "@assets/T2_Nigeria_1780571958531.svg?url";
import carouselBgUrl from "@assets/header_(1)_1780589750503.png?url";
import verseTeeUrl from "@assets/Threaded_Round_Neck_(1)_1780683904381.png?url";
import verseHoodieUrl from "@assets/quarterzip_hoodie_1780685237495.png?url";
import verseCapUrl from "@assets/fila_cap_1780685259464.png?url";

const CAROUSEL_SLIDES = [
  { title: "", subtitle: "", cta: "", category: "logo", image: carouselBgUrl },
  { title: "Airtime & Data", subtitle: "Top up across all Nigerian networks", cta: "Spend Now", category: "banner", image: carouselBgUrl },
  { title: "Verse Merch", subtitle: "Branded tees, hoodies, and accessories for the community", cta: "Spend Now", category: "template", image: carouselBgUrl },
];

const AIRTIME_PRODUCTS: Product[] = [
  {
    id: "airtime-1",
    name: "MTN",
    description: "Instant MTN recharge. Valid for 30 days. Delivered via PIN.",
    price: 1000,
    currency: "₦",
    thumbnail: mtnLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-2",
    name: "Airtel",
    description: "10GB monthly data bundle. Valid for 30 days.",
    price: 3000,
    currency: "₦",
    thumbnail: airtelLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-3",
    name: "Glo",
    description: "5GB GLO data bundle. Valid for 30 days.",
    price: 1500,
    currency: "₦",
    thumbnail: gloLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-4",
    name: "T2 Mobile",
    description: "Instant T2 Mobile recharge. Valid for 30 days.",
    price: 500,
    currency: "₦",
    thumbnail: t2LogoUrl,
    type: "airtime",
  },
];

const MERCH_PRODUCTS: Product[] = [
  {
    id: "merch-1",
    name: "Verse Logo Tee — Black",
    description: "Premium cotton tee with embroidered Verse logo. Unisex fit.",
    price: 15000,
    currency: "₦",
    thumbnail: verseTeeUrl,
    type: "merch",
    tag: "New",
  },
  {
    id: "merch-2",
    name: "Verse Hoodie — Navy",
    description: "Heavyweight hoodie with front pocket and printed back graphic.",
    price: 25000,
    currency: "₦",
    thumbnail: verseHoodieUrl,
    type: "merch",
  },
  {
    id: "merch-3",
    name: "Verse Cap — Snapback",
    description: "Adjustable snapback with 3D embroidered Verse badge.",
    price: 8000,
    currency: "₦",
    thumbnail: verseCapUrl,
    type: "merch",
  },
  {
    id: "merch-4",
    name: "Verse Sticker Pack",
    description: "Set of 10 waterproof vinyl stickers. Laptop and phone friendly.",
    price: 2500,
    currency: "₦",
    thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=450&fit=crop",
    type: "merch",
    tag: "Limited",
  },
];

export default function Marketplace() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [merchModalOpen, setMerchModalOpen] = useState(false);
  const carouselRef = useRef<any>(null);

  const handleAirtimeClick = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleMerchClick = () => {
    setMerchModalOpen(true);
  };

  return (
    <Layout>
      {/* Hero Carousel */}
      <section className="container mx-auto px-4 pt-6 pb-6 z-10">
        <Carousel
          opts={{ align: "start", loop: true }}
          plugins={[
            Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
          ]}
          className="w-full"
          setApi={(api) => {
            carouselRef.current = api;
            if (api) {
              api.on("select", () => setActiveIndex(api.selectedScrollSnap()));
            }
          }}
        >
          <CarouselContent className="-ml-0">
            {CAROUSEL_SLIDES.map((slide, idx) => (
              <CarouselItem key={idx} className="pl-0 basis-full">
                <div className="relative h-[240px] md:h-[300px] rounded-2xl overflow-hidden border border-white/5">
                  <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    {idx === 0 && (
                      <>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                          <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#06B6D4,#ffffff)]">
                            Marketplace
                          </span>
                        </h1>
                        <p className="text-white/80 text-base md:text-lg max-w-md mb-6">
                          Spend Verse On...
                        </p>
                      </>
                    )}
                    {idx !== 0 && (
                      <>
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{slide.title}</h2>
                        <p className="text-white/70 text-sm md:text-base max-w-md mb-6">{slide.subtitle}</p>
                        <a href={slide.category === "banner" ? "#airtime-section" : "#merch-section"}>
                          <Button className="bg-[#06B6D4] text-black border-0 hover:bg-[#0891B2]" size="sm">
                            {slide.cta}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          <div className="flex justify-center gap-2 mt-4">
            {CAROUSEL_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => carouselRef.current?.scrollTo(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === activeIndex ? "w-6 bg-[#06B6D4]" : "w-2 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <CarouselPrevious className="left-4 bg-background/60 border-white/10 hover:bg-background hover:border-[#06B6D4]/50" />
          <CarouselNext className="right-4 bg-background/60 border-white/10 hover:bg-background hover:border-[#06B6D4]/50" />
        </Carousel>
      </section>

      {/* Ad Banner */}
      <section className="container mx-auto px-4 pb-4 z-10">
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-[#06B6D4]/15 via-[#0d0d1a] to-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.10)_0%,transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-4 px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-[#06B6D4]/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#06B6D4]">Ads</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">
                  Swap <span className="text-[#06B6D4]">Verse</span> directly to your wallet
                </p>
                <p className="text-xs text-white/50 truncate">Sideshift.ai direct to wallet trading</p>
              </div>
            </div>
            <a
              href="https://sideshift.ai/usdtpolygon/versepolygon/a/digdeep"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-white hover:text-[#06B6D4] transition-colors whitespace-nowrap"
            >
              Swap Now →
            </a>
          </div>
        </div>
      </section>

      {/* Airtime & Data Section */}
      <section id="airtime-section" className="container mx-auto px-4 pb-12 z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[#06B6D4]/15 flex items-center justify-center">
            <Smartphone className="h-4 w-4 text-[#06B6D4]" />
          </div>
          <h2 className="text-xl font-bold">Airtime & Data</h2>
          <span className="text-sm text-muted-foreground ml-2">{AIRTIME_PRODUCTS.length} products</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {AIRTIME_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} onClick={() => handleAirtimeClick(product)} />
          ))}
        </div>
      </section>


      <AirtimeModal product={selectedProduct} open={modalOpen} onClose={() => setModalOpen(false)} />
      <MerchComingSoonModal open={merchModalOpen} onClose={() => setMerchModalOpen(false)} />
    </Layout>
  );
}
