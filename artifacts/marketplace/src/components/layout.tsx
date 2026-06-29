export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(240,10%,4%)", color: "hsl(0,0%,95%)" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1rem", height: 56, display: "flex", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.01em" }}>
            <span style={{ background: "linear-gradient(90deg,#06B6D4,#ffffff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Verse</span>
            {" "}Marketplace
          </span>
        </div>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
