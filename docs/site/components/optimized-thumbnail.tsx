"use client";

import { useState } from "react";
import Image from "next/image";

interface OptimizedThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  /** SVG size for fallback placeholder icon (default 32) */
  placeholderSize?: number;
  /** Additional opacity class applied to the image (e.g. "opacity-60") */
  opacity?: string;
}

/**
 * Shared wrapper around next/image for composition thumbnails.
 * Uses `fill` + `sizes` for responsive srcset and AVIF/WebP conversion.
 * Shows a play-icon placeholder on error instead of DOM manipulation.
 */
export function OptimizedThumbnail({
  src,
  alt,
  className = "",
  placeholderSize = 32,
  opacity,
}: OptimizedThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={placeholderSize}
          height={placeholderSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-fd-muted-foreground/50"
          aria-hidden="true"
        >
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className={`object-cover ${opacity ?? ""} ${className}`.trim()}
      onError={() => setHasError(true)}
    />
  );
}
