import type { Product } from "@/components/product-card";
import mtnLogoUrl from "@assets/MTN_Nigeria_1780562125673.svg?url";
import airtelLogoUrl from "@assets/Airtel_Nigeria_1780567636022.svg?url";
import gloLogoUrl from "@assets/Glo_Nigeria_1780568187203.svg?url";
import t2LogoUrl from "@assets/T2_Nigeria_1780571958531.svg?url";

export const SITE_ORIGIN = "https://subrefill.com";

export interface AirtimeProduct extends Product {
  slug: string;
}

export const AIRTIME_PRODUCTS: AirtimeProduct[] = [
  {
    id: "airtime-1",
    slug: "mtn",
    name: "MTN Refill",
    description: "Buy MTN Airtime and Data With Crypto.",
    price: 1000,
    currency: "₦",
    thumbnail: mtnLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-2",
    slug: "airtel",
    name: "Airtel Refill",
    description: "Buy Airtel Airtime and Data With Crypto.",
    price: 3000,
    currency: "₦",
    thumbnail: airtelLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-3",
    slug: "glo",
    name: "Glo Refill",
    description: "Buy Glo Airtime and Data With Crypto.",
    price: 1500,
    currency: "₦",
    thumbnail: gloLogoUrl,
    type: "airtime",
  },
  {
    id: "airtime-4",
    slug: "t2",
    name: "T2 Mobile",
    description: "Buy T2Mobile Airtime and Data With Crypto.",
    price: 500,
    currency: "₦",
    thumbnail: t2LogoUrl,
    type: "airtime",
  },
];

export function getAirtimeProductBySlug(slug: string): AirtimeProduct | undefined {
  return AIRTIME_PRODUCTS.find((p) => p.slug === slug);
}

export function airtimeProductUrl(product: AirtimeProduct): string {
  return `${SITE_ORIGIN}/airtime/${product.slug}`;
}
