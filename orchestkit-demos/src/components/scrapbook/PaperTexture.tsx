import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { SCRAPBOOK_PALETTE, SCRAPBOOK_ANIMATION } from "../../styles/scrapbook-style";

interface PaperTextureProps {
  backgroundColor?: string;
  grainOpacity?: number;
  showEdgeShadow?: boolean;
}

export const PaperTexture: React.FC<PaperTextureProps> = ({
  backgroundColor = SCRAPBOOK_PALETTE.background.primary,
  grainOpacity = SCRAPBOOK_ANIMATION.grainOpacity,
  showEdgeShadow = true,
}) => {
  const frame = useCurrentFrame();

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Warm-toned grain (subtle canvas texture)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 480;
    const h = 270;
    canvas.width = w;
    canvas.height = h;

    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = random(`grain-${i}-${frame % 3}`) * 255;
      // Warm tint: slightly more red/yellow than blue
      imageData.data[i] = Math.min(255, noise * 1.05);     // R
      imageData.data[i + 1] = Math.min(255, noise * 1.02);  // G
      imageData.data[i + 2] = noise * 0.95;                  // B
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [frame]);

  return (
    <AbsoluteFill>
      {/* Base warm paper color */}
      <AbsoluteFill style={{ backgroundColor }} />

      {/* Canvas grain overlay */}
      <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            opacity: grainOpacity,
            imageRendering: "pixelated",
          }}
        />
      </AbsoluteFill>

      {/* Warm vignette (paper edge shadow) */}
      {showEdgeShadow && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, rgba(180, 170, 150, 0.25) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
