import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export interface CodePreviewProps {
  code: string;
  language?: string;
  filename?: string;
  primaryColor?: string;
  animateIn?: boolean;
  startFrame?: number;
  typewriterSpeed?: number;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

// Simple syntax highlighting colors
const TOKEN_COLORS: Record<string, string> = {
  keyword: "#c678dd", // purple
  string: "#98c379", // green
  number: "#d19a66", // orange
  comment: "#5c6370", // gray
  function: "#61afef", // blue
  type: "#e5c07b", // yellow
  operator: "#56b6c2", // cyan
  default: "#abb2bf", // light gray
};

const KEYWORDS = [
  "import",
  "export",
  "from",
  "const",
  "let",
  "var",
  "function",
  "async",
  "await",
  "return",
  "if",
  "else",
  "class",
  "extends",
  "new",
  "this",
  "interface",
  "type",
  "enum",
];

const tokenize = (code: string): Array<{ text: string; color: string }> => {
  const tokens: Array<{ text: string; color: string }> = [];
  let remaining = code;

  while (remaining.length > 0) {
    // String (double or single quotes)
    const stringMatch = remaining.match(/^(['"`]).*?\1/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: TOKEN_COLORS.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Comment
    const commentMatch = remaining.match(/^\/\/.*/);
    if (commentMatch) {
      tokens.push({ text: commentMatch[0], color: TOKEN_COLORS.comment });
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^\d+(\.\d+)?/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: TOKEN_COLORS.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Keyword or identifier
    const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const isKeyword = KEYWORDS.includes(word);
      const isType = /^[A-Z]/.test(word);
      const color = isKeyword
        ? TOKEN_COLORS.keyword
        : isType
          ? TOKEN_COLORS.type
          : TOKEN_COLORS.default;
      tokens.push({ text: word, color });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Operator
    const operatorMatch = remaining.match(/^[=<>!+\-*/&|:;,.{}()[\]]+/);
    if (operatorMatch) {
      tokens.push({ text: operatorMatch[0], color: TOKEN_COLORS.operator });
      remaining = remaining.slice(operatorMatch[0].length);
      continue;
    }

    // Whitespace or other
    tokens.push({ text: remaining[0], color: TOKEN_COLORS.default });
    remaining = remaining.slice(1);
  }

  return tokens;
};

export const CodePreview: React.FC<CodePreviewProps> = ({
  code,
  language = "typescript",
  filename,
  primaryColor = "#8b5cf6",
  animateIn = true,
  startFrame = 0,
  typewriterSpeed = 3,
  showLineNumbers = true,
  highlightLines = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Container animation
  const containerOpacity = animateIn
    ? interpolate(frame - startFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 1;

  const containerScale = animateIn
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 80, stiffness: 200 },
      })
    : 1;

  // Calculate visible characters for typewriter effect
  const totalChars = code.length;
  const visibleChars = Math.min(
    Math.floor((frame - startFrame - 10) * typewriterSpeed),
    totalChars
  );

  // Get visible code
  const visibleCode = code.slice(0, Math.max(0, visibleChars));
  const visibleLines = visibleCode.split("\n");

  return (
    <div
      style={{
        backgroundColor: "#1e1e2e",
        borderRadius: 8,
        overflow: "hidden",
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        border: `1px solid ${primaryColor}33`,
      }}
    >
      {/* Header */}
      {filename && (
        <div
          style={{
            backgroundColor: "#2d2d3a",
            padding: "8px 12px",
            borderBottom: "1px solid #3d3d4a",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* File icon */}
          <span style={{ fontSize: 12 }}>📄</span>
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              color: "#94a3b8",
            }}
          >
            {filename}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#6b7280",
              backgroundColor: "#1e1e2e",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {language}
          </span>
        </div>
      )}

      {/* Code content */}
      <div style={{ padding: "12px 0" }}>
        {visibleLines.map((line, lineIndex) => {
          const isHighlighted = highlightLines.includes(lineIndex + 1);
          const tokens = tokenize(line);
          const isLastLine = lineIndex === visibleLines.length - 1;
          const isIncomplete = isLastLine && visibleChars < totalChars;

          return (
            <div
              key={lineIndex}
              style={{
                display: "flex",
                alignItems: "flex-start",
                backgroundColor: isHighlighted
                  ? `${primaryColor}15`
                  : "transparent",
                borderLeft: isHighlighted
                  ? `3px solid ${primaryColor}`
                  : "3px solid transparent",
                paddingLeft: 8,
                paddingRight: 12,
                minHeight: 20,
              }}
            >
              {/* Line number */}
              {showLineNumbers && (
                <span
                  style={{
                    fontFamily: "Menlo, Monaco, monospace",
                    fontSize: 11,
                    color: "#4b5563",
                    width: 32,
                    textAlign: "right",
                    paddingRight: 12,
                    userSelect: "none",
                  }}
                >
                  {lineIndex + 1}
                </span>
              )}

              {/* Code line */}
              <span
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {tokens.map((token, tokenIndex) => (
                  <span key={tokenIndex} style={{ color: token.color }}>
                    {token.text}
                  </span>
                ))}
                {/* Cursor on last line if still typing */}
                {isIncomplete && (
                  <span
                    style={{
                      backgroundColor: primaryColor,
                      color: "#1e1e2e",
                    }}
                  >
                    █
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
