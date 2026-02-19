/** macOS-style terminal window chrome with traffic lights */

import React from "react";
import { SANS } from "./constants";

interface TerminalChromeProps {
  title: string;
  opacity: number;
}

export const TerminalChrome: React.FC<TerminalChromeProps> = ({
  title,
  opacity,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      padding: "14px 20px",
      backgroundColor: "#161b22",
      borderBottom: "1px solid #30363d",
      opacity,
    }}
  >
    <div style={{ display: "flex", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((bg) => (
        <div
          key={bg}
          style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: bg }}
        />
      ))}
    </div>
    <div
      style={{
        flex: 1,
        textAlign: "center",
        fontFamily: SANS,
        fontSize: 14,
        color: "#8b949e",
        fontWeight: 500,
      }}
    >
      {title}
    </div>
    <div style={{ width: 62 }} />
  </div>
);
