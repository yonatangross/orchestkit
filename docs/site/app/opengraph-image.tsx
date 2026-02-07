import { ImageResponse } from "next/og";
import { SITE, COUNTS } from "@/lib/constants";

export const size = { width: 1200, height: 630 };
export const alt = `${SITE.name} — AI Development Toolkit`;
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A0A0A",
          color: "#FAFAFA",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "#6EE7B7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: 800,
              color: "#0A0A0A",
            }}
          >
            O
          </div>
          <span style={{ fontSize: "48px", fontWeight: 700 }}>
            {SITE.name}
          </span>
        </div>

        <p
          style={{
            fontSize: "28px",
            color: "#A1A1AA",
            marginBottom: "48px",
            textAlign: "center",
            maxWidth: "700px",
          }}
        >
          Stop explaining your stack. Start shipping.
        </p>

        <div
          style={{
            display: "flex",
            gap: "48px",
          }}
        >
          {[
            [COUNTS.skills, "Skills"],
            [COUNTS.agents, "Agents"],
            [COUNTS.hooks, "Hooks"],
          ].map(([count, label]) => (
            <div
              key={String(label)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "56px", fontWeight: 800, color: "#6EE7B7" }}>
                {count}
              </span>
              <span style={{ fontSize: "20px", color: "#71717A" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
