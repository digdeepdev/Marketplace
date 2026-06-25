import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  thumbnail: string;
  type: "airtime" | "merch";
  tag?: string;
}

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const isAirtime = product.type === "airtime";

  return (
    <Card
      className="group overflow-hidden border-white/5 bg-card/50 transition-all hover:bg-card hover:border-primary/30 hover:shadow-[0_0_30px_-10px_rgba(19,111,211,0.2)] cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-[16/10] relative overflow-hidden bg-muted/30 border-b border-white/5 flex items-center justify-center">
        <img
          src={product.thumbnail}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-2 left-2">
          <Badge
            className={
              isAirtime
                ? "bg-[#136FD3]/20 text-[#136FD3] border-[#136FD3]/30 text-[10px] px-1.5 py-0"
                : "bg-[#D90BFB]/20 text-[#D90BFB] border-[#D90BFB]/30 text-[10px] px-1.5 py-0"
            }
          >
            {isAirtime ? "Airtime / Data" : "Merch"}
          </Badge>
        </div>
        {product.tag && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
              {product.tag}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="space-y-0.5">
          <h3 className="font-semibold text-sm truncate" title={product.name}>
            {product.name}
          </h3>
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
            {product.description}
          </p>
        </div>
        <div className="flex items-center justify-center pt-1">
          <Button
            size="sm"
            className={
              isAirtime
                ? "bg-[#136FD3] text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-[#1060ba]"
                : "bg-[#D90BFB] text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-[#c009e0]"
            }
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Buy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
