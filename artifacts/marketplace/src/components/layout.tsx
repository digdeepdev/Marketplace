import { Link, useLocation } from "wouter";
import { Zap, Star, ArrowLeftRight } from "lucide-react";
import logoUrl from "@assets/Subrefill_1782727570118.svg?url";

const NAV_TABS = [
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/", label: "Top Up", icon: Zap },
  { href: "/p2p", label: "P2P", icon: ArrowLeftRight },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(240,10%,4%)", color: "hsl(0,0%,95%)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1rem", height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Link href="/">
            <img src={logoUrl} alt="Subrefill" style={{ height: 28, width: "auto", cursor: "pointer" }} />
          </Link>
        </div>
      </header>

      {/* Page content — padded at bottom so content clears the tab bar */}
      <main style={{ flex: 1, paddingBottom: 72 }}>{children}</main>

      {/* Bottom tab bar */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(10,10,15,0.95)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          height: 64,
        }}
      >
        {NAV_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                textDecoration: "none",
                color: active ? "#06B6D4" : "rgba(255,255,255,0.4)",
                transition: "color 0.15s",
                cursor: "pointer",
              }}
            >
              <Icon
                style={{
                  width: 22,
                  height: 22,
                  strokeWidth: active ? 2.2 : 1.8,
                  fill: active ? "rgba(6,182,212,0.15)" : "transparent",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: "0.02em" }}>
                {label}
              </span>
              {active && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    width: 32,
                    height: 2,
                    background: "#06B6D4",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
