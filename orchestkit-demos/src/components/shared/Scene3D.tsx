import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/**
 * Scene3D - Three.js integration components
 *
 * Note: These components require @remotion/three and related packages.
 * If packages are not installed, components will render fallback UI.
 */

// ============================================================================
// FLOATING LOGO (3D text with rotation)
// ============================================================================

interface FloatingLogoProps {
  text: string;
  color?: string;
  secondaryColor?: string;
  rotationSpeed?: number;
}

export const FloatingLogo: React.FC<FloatingLogoProps> = ({
  text,
  color = "#8b5cf6",
  secondaryColor = "#22c55e",
  rotationSpeed = 0.02,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const rotation = frame * rotationSpeed;
  const bobY = Math.sin(frame * 0.05) * 10;

  // CSS-only 3D transform fallback
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        perspective: "1000px",
      }}
    >
      <div
        style={{
          transform: `
            scale(${scale})
            rotateY(${rotation}rad)
            translateY(${bobY}px)
          `,
          transformStyle: "preserve-3d",
        }}
      >
        <span
          style={{
            fontSize: 96,
            fontWeight: 800,
            fontFamily: "Inter, system-ui",
            background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: `0 20px 40px ${color}40`,
            letterSpacing: "-0.02em",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// PARTICLE SPHERE (Spherical particle arrangement)
// ============================================================================

interface ParticleSphereProps {
  particleCount?: number;
  radius?: number;
  color?: string;
  rotationSpeed?: number;
}

export const ParticleSphere: React.FC<ParticleSphereProps> = ({
  particleCount = 200,
  radius = 200,
  color = "#8b5cf6",
  rotationSpeed = 0.01,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate sphere points using Fibonacci distribution
  const particles = useMemo(() => {
    const points: Array<{ x: number; y: number; z: number; size: number }> = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < particleCount; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);

      points.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        size: 2 + Math.sin(i * 0.5) * 2,
      });
    }
    return points;
  }, [particleCount]);

  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const rotation = frame * rotationSpeed;

  return (
    <div
      style={{
        position: "relative",
        width: radius * 2,
        height: radius * 2,
        transform: `scale(${scale})`,
      }}
    >
      {particles.map((p, i) => {
        // Apply rotation around Y axis
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const rotatedX = p.x * cosR - p.z * sinR;
        const rotatedZ = p.x * sinR + p.z * cosR;

        // Project to 2D with perspective
        const perspective = 400;
        const scale2D = perspective / (perspective + rotatedZ * radius);
        const screenX = radius + rotatedX * radius * scale2D;
        const screenY = radius + p.y * radius * scale2D;

        // Depth-based opacity
        const opacity = interpolate(rotatedZ, [-1, 1], [0.2, 1]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: screenX,
              top: screenY,
              width: p.size * scale2D,
              height: p.size * scale2D,
              borderRadius: "50%",
              backgroundColor: color,
              opacity,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 ${p.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// CUBE GRID (3D grid of cubes)
// ============================================================================

interface CubeGridProps {
  gridSize?: number;
  cubeSize?: number;
  color?: string;
  waveAmplitude?: number;
}

export const CubeGrid: React.FC<CubeGridProps> = ({
  gridSize = 5,
  cubeSize = 40,
  color = "#8b5cf6",
  waveAmplitude = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cubes = useMemo(() => {
    const items: Array<{ x: number; y: number; i: number; j: number }> = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        items.push({
          x: (i - gridSize / 2 + 0.5) * cubeSize * 1.5,
          y: (j - gridSize / 2 + 0.5) * cubeSize * 1.5,
          i,
          j,
        });
      }
    }
    return items;
  }, [gridSize, cubeSize]);

  const scale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  return (
    <div
      style={{
        position: "relative",
        width: gridSize * cubeSize * 2,
        height: gridSize * cubeSize * 2,
        transform: `scale(${scale}) perspective(1000px) rotateX(60deg) rotateZ(45deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {cubes.map((cube, idx) => {
        // Wave animation based on distance from center
        const distance = Math.sqrt(cube.i * cube.i + cube.j * cube.j);
        const waveOffset = Math.sin(frame * 0.1 - distance * 0.5) * waveAmplitude;

        const cubeOpacity = interpolate(
          waveOffset,
          [-waveAmplitude, waveAmplitude],
          [0.3, 1]
        );

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cubeSize,
              height: cubeSize,
              backgroundColor: color,
              opacity: cubeOpacity,
              transform: `
                translate(-50%, -50%)
                translateX(${cube.x}px)
                translateY(${cube.y}px)
                translateZ(${waveOffset}px)
              `,
              boxShadow: `0 ${waveOffset / 2}px ${waveOffset}px rgba(0,0,0,0.3)`,
              borderRadius: 4,
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// ORBITING RINGS (Concentric animated rings)
// ============================================================================

interface OrbitingRingsProps {
  ringCount?: number;
  baseRadius?: number;
  color?: string;
}

export const OrbitingRings: React.FC<OrbitingRingsProps> = ({
  ringCount = 3,
  baseRadius = 100,
  color = "#8b5cf6",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 15 },
  });

  return (
    <div
      style={{
        position: "relative",
        width: baseRadius * ringCount * 2,
        height: baseRadius * ringCount * 2,
        transform: `scale(${scale})`,
      }}
    >
      {Array.from({ length: ringCount }).map((_, i) => {
        const radius = baseRadius * (i + 1);
        const rotationX = 70 - i * 10;
        const rotationZ = frame * (0.02 + i * 0.01) * (i % 2 === 0 ? 1 : -1);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: radius * 2,
              height: radius * 2,
              border: `2px solid ${color}`,
              borderRadius: "50%",
              transform: `
                translate(-50%, -50%)
                rotateX(${rotationX}deg)
                rotateZ(${rotationZ}rad)
              `,
              opacity: 0.3 + (ringCount - i) * 0.2,
              boxShadow: `0 0 20px ${color}40`,
            }}
          />
        );
      })}

      {/* Center dot */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 20,
          height: 20,
          backgroundColor: color,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 30px ${color}`,
        }}
      />
    </div>
  );
};

// ============================================================================
// MORPH SHAPE (Shape morphing animation)
// ============================================================================

interface MorphShapeProps {
  size?: number;
  color?: string;
  morphSpeed?: number;
}

export const MorphShape: React.FC<MorphShapeProps> = ({
  size = 200,
  color = "#8b5cf6",
  morphSpeed = 0.05,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  // Morph between circle, square, and triangle using border-radius
  const morphProgress = (Math.sin(frame * morphSpeed) + 1) / 2;

  // Interpolate border radius for shape morphing
  const borderRadius = interpolate(
    morphProgress,
    [0, 0.5, 1],
    [50, 10, 50] // circle -> square-ish -> circle
  );

  // Rotation
  const rotation = frame * 0.02;

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: `${borderRadius}%`,
        transform: `scale(${scale}) rotate(${rotation}rad)`,
        boxShadow: `
          0 0 60px ${color}60,
          inset 0 0 60px rgba(255,255,255,0.1)
        `,
        background: `linear-gradient(135deg, ${color}, ${color}80)`,
      }}
    />
  );
};

// ============================================================================
// WIREFRAME BOX (Animated wireframe cube)
// ============================================================================

interface WireframeBoxProps {
  size?: number;
  color?: string;
  lineWidth?: number;
}

export const WireframeBox: React.FC<WireframeBoxProps> = ({
  size = 200,
  color = "#8b5cf6",
  lineWidth = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const rotateY = frame * 0.02;
  const rotateX = frame * 0.015;

  // Define cube vertices
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];

  // Define edges as pairs of vertex indices
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // Front face
    [4, 5], [5, 6], [6, 7], [7, 4], // Back face
    [0, 4], [1, 5], [2, 6], [3, 7], // Connecting edges
  ];

  // Project 3D to 2D with rotation
  const project = (x: number, y: number, z: number) => {
    // Rotate around Y
    const x1 = x * Math.cos(rotateY) - z * Math.sin(rotateY);
    const z1 = x * Math.sin(rotateY) + z * Math.cos(rotateY);

    // Rotate around X
    const y1 = y * Math.cos(rotateX) - z1 * Math.sin(rotateX);
    const z2 = y * Math.sin(rotateX) + z1 * Math.cos(rotateX);

    // Perspective projection
    const perspective = 3;
    const scale2D = perspective / (perspective + z2);

    return {
      x: x1 * scale2D * (size / 2) + size / 2,
      y: y1 * scale2D * (size / 2) + size / 2,
      z: z2,
    };
  };

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: `scale(${scale})` }}
    >
      {edges.map((edge, i) => {
        const p1 = project(
          vertices[edge[0]][0],
          vertices[edge[0]][1],
          vertices[edge[0]][2]
        );
        const p2 = project(
          vertices[edge[1]][0],
          vertices[edge[1]][1],
          vertices[edge[1]][2]
        );

        // Depth-based opacity
        const avgZ = (p1.z + p2.z) / 2;
        const opacity = interpolate(avgZ, [-1.5, 1.5], [0.3, 1]);

        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={color}
            strokeWidth={lineWidth}
            opacity={opacity}
          />
        );
      })}

      {/* Draw vertices as dots */}
      {vertices.map((v, i) => {
        const p = project(v[0], v[1], v[2]);
        const opacity = interpolate(p.z, [-1.5, 1.5], [0.3, 1]);

        return (
          <circle
            key={`v-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};
