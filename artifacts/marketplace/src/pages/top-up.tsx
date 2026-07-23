import { useState } from "react";
import { Layout } from "@/components/layout";
import { Smartphone } from "lucide-react";
import { ProductCard, Product } from "@/components/product-card";
import { AirtimeModal } from "@/components/airtime-modal";
import mtnLogoUrl from "@assets/MTN_Nigeria_1780562125673.svg?url";
import airtelLogoUrl from "@assets/Airtel_Nigeria_1780567636022.svg?url";
import gloLogoUrl from "@assets/Glo_Nigeria_1780568187203.svg?url";
import t2LogoUrl from "@assets/T2_Nigeria_1780571958531.svg?url";

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

export default function TopUp() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAirtimeClick = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  return (
    <Layout>
      {/* Ad Banner — visible on all screen sizes */}
      <section className="container mx-auto px-4 pt-6 pb-4 z-10">
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

      {/* Airtime & Data Section — visible on all screen sizes */}
      <section className="container mx-auto px-4 pb-12 z-10">
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
    </Layout>
  );
}
