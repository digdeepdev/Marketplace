import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Smartphone } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { AIRTIME_PRODUCTS, SITE_ORIGIN } from "@/lib/airtime-products";
import { useSeo } from "@/lib/seo";

export default function TopUp() {
  useSeo({
    title: "Top Up Airtime & Data with Crypto | Subrefill",
    description:
      "Top up MTN, Airtel, Glo and T2 Mobile airtime and data instantly with crypto on Subrefill.",
    canonicalUrl: `${SITE_ORIGIN}/top-up`,
  });

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
            <Link
              key={product.id}
              href={`/airtime/${product.slug}`}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] rounded-xl"
              aria-label={`${product.name} — ${product.description}`}
            >
              <ProductCard product={product} />
            </Link>
          ))}
        </div>
      </section>

    </Layout>
  );
}
