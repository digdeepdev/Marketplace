import { Layout } from "@/components/layout";
import { ArrowLeftRight, Clock } from "lucide-react";

export default function P2P() {
  return (
    <Layout>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "3rem 1.5rem 4rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(6,182,212,0.1)",
            border: "1px solid rgba(6,182,212,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem",
          }}
        >
          <ArrowLeftRight style={{ width: 32, height: 32, color: "#06B6D4" }} />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">P2P Exchange</h1>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(6,182,212,0.1)",
            border: "1px solid rgba(6,182,212,0.3)",
            borderRadius: 999,
            padding: "4px 14px",
            marginBottom: "1.5rem",
          }}
        >
          <Clock style={{ width: 13, height: 13, color: "#06B6D4" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#06B6D4", letterSpacing: "0.05em" }}>
            COMING SOON
          </span>
        </div>

        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.7, maxWidth: 340 }}>
          Trade crypto peer-to-peer directly with other Subrefill users — fast, secure, and without intermediaries.
        </p>

        <div
          style={{
            marginTop: "2.5rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            width: "100%",
            maxWidth: 360,
          }}
        >
          {[
            { title: "Direct trades", desc: "User-to-user, no middleman" },
            { title: "Multi-token", desc: "VERSE, USDT, SOL & more" },
            { title: "Escrow", desc: "Funds locked until both sides confirm" },
            { title: "On-chain proof", desc: "Every trade verifiable on-chain" },
          ].map(({ title, desc }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "1rem",
                textAlign: "left",
              }}
            >
              <p style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                {title}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
