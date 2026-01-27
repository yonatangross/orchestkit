import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyCodeStream - "CODE" living editor with syntax glow
 * Glass-morphism terminal, neon text-shadow, line-by-line stream
 */

interface ToyCodeStreamProps {
  frame: number;
  fps: number;
}

const CODE_LINES = [
  { code: "class AuthService:", color: "#a855f7", glow: "#a855f766" },
  { code: "    def __init__(self, db):", color: "#e6edf3", glow: "none" },
  { code: "        self.db = db", color: "#e6edf3", glow: "none" },
  { code: "        self.secret = config.JWT", color: "#e6edf3", glow: "none" },
  { code: "", color: "#e6edf3", glow: "none" },
  { code: "    async def login(self, cred):", color: "#06b6d4", glow: "#06b6d466" },
  { code: "        user = await self.db.find(cred)", color: "#e6edf3", glow: "none" },
  { code: "        if not verify(cred, user.hash):", color: "#e6edf3", glow: "none" },
  { code: "            raise AuthError('Invalid')", color: "#f59e0b", glow: "#f59e0b66" },
  { code: "        return self.create_token(user)", color: "#22c55e", glow: "#22c55e66" },
  { code: "", color: "#e6edf3", glow: "none" },
  { code: "    def create_token(self, user):", color: "#06b6d4", glow: "#06b6d466" },
  { code: "        payload = {'sub': user.id}", color: "#e6edf3", glow: "none" },
  { code: "        token = jwt.encode(payload)", color: "#e6edf3", glow: "none" },
  { code: "        return TokenResponse(token)", color: "#22c55e", glow: "#22c55e66" },
  { code: "", color: "#e6edf3", glow: "none" },
  { code: "class UserService:", color: "#a855f7", glow: "#a855f766" },
  { code: "    async def get_profile(self, id):", color: "#06b6d4", glow: "#06b6d466" },
  { code: "        return await self.db.users.get(id)", color: "#e6edf3", glow: "none" },
  { code: "", color: "#e6edf3", glow: "none" },
  { code: "    async def update(self, id, data):", color: "#06b6d4", glow: "#06b6d466" },
  { code: "        validated = Schema(**data)", color: "#e6edf3", glow: "none" },
  { code: "        return await self.db.update(id)", color: "#22c55e", glow: "#22c55e66" },
];

export const ToyCodeStream: React.FC<ToyCodeStreamProps> = ({ frame, fps }) => {
  const entryProgress = spring({ frame, fps, config: { stiffness: 200, damping: 15 } });

  // Scroll
  const scrollY = interpolate(frame, [0, fps * 4], [0, 600], { extrapolateRight: "clamp" });

  // Glow pulse
  const glowIntensity = interpolate(Math.sin(frame * 0.3), [-1, 1], [0.3, 0.7]);

  // Lines visible
  const linesPerSecond = 8;
  const visibleLines = Math.min(CODE_LINES.length, Math.floor((frame / fps) * linesPerSecond) + 5);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, #1a1b26 0%, #050508 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: 80,
          fontSize: 24,
          fontWeight: 700,
          color: "#8b949e",
          letterSpacing: 4,
          zIndex: 10,
        }}
      >
        4. CODE
      </div>

      {/* Terminal window - glass morphism */}
      <div
        style={{
          transform: `scale(${entryProgress})`,
          width: 900,
          height: 500,
          borderRadius: 16,
          backgroundColor: "rgba(13, 17, 23, 0.85)",
          border: "1px solid rgba(48, 54, 61, 0.8)",
          overflow: "hidden",
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.5),
            0 0 80px rgba(168, 85, 247, ${glowIntensity * 0.2}),
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            backgroundColor: "rgba(22, 27, 34, 0.9)",
            borderBottom: "1px solid rgba(48,54,61,0.6)",
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28c840" }} />
          <span style={{ color: "#8b949e", fontSize: 13, marginLeft: 10 }}>auth_service.py</span>
        </div>

        {/* Code content with neon glow */}
        <div
          style={{
            padding: 24,
            fontFamily: "SF Mono, Monaco, monospace",
            fontSize: 22,
            lineHeight: 1.6,
            transform: `translateY(-${scrollY}px)`,
          }}
        >
          {CODE_LINES.slice(0, visibleLines).map((line, idx) => (
            <div
              key={idx}
              style={{
                color: line.color,
                minHeight: 35,
                textShadow: line.glow !== "none" ? `0 0 10px ${line.glow}` : "none",
              }}
            >
              {line.code}
            </div>
          ))}
          {visibleLines < CODE_LINES.length && (
            <span style={{ color: "#f59e0b" }}>█</span>
          )}
        </div>
      </div>

      {/* Subtext */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          fontSize: 18,
          color: "#e6edf3",
          fontWeight: 500,
          opacity: entryProgress,
        }}
      >
        Generating 234 lines...
      </div>
    </AbsoluteFill>
  );
};
