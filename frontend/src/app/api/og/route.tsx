import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a12 0%, #12102a 50%, #0a0a12 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
          }}
        />

        {/* Shield icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "20px",
            background: "rgba(139,92,246,0.15)",
            border: "2px solid rgba(139,92,246,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
            fontSize: "40px",
          }}
        >
          🛡️
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          Neural Shield AI
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "26px",
            color: "rgba(255,255,255,0.6)",
            textAlign: "center",
            maxWidth: "700px",
            lineHeight: "1.4",
            marginBottom: "40px",
          }}
        >
          Stop scams before they stop you — AI fraud detection built for India
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {["Messages", "URLs", "UPI IDs", "QR Codes", "Screenshots"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 18px",
                borderRadius: "999px",
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.35)",
                color: "#c4b5fd",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
