/**
 * Optimized Image component wrapper
 * Handles: blur placeholder, responsive sizes, error states
 */
'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '21:9';
  showSkeleton?: boolean;
}

// ============================================
// Aspect Ratio Map
// ============================================

const aspectRatioClasses = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
};

// ============================================
// Component
// ============================================

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.jpg',
  aspectRatio,
  showSkeleton = true,
  className,
  fill,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageSrc = hasError ? fallbackSrc : src;

  // For fill mode, wrap in aspect ratio container
  if (fill && aspectRatio) {
    return (
      <div
        className={cn(
          'relative overflow-hidden',
          aspectRatioClasses[aspectRatio],
          className
        )}
      >
        <Image
          src={imageSrc}
          alt={alt}
          fill
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading && showSkeleton ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          {...props}
        />
        {isLoading && showSkeleton && (
          <div className="absolute inset-0 animate-pulse bg-gray-200" />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Image
        src={imageSrc}
        alt={alt}
        fill={fill}
        className={cn(
          'transition-opacity duration-300',
          isLoading && showSkeleton ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        {...props}
      />
      {isLoading && showSkeleton && !fill && props.width && props.height && (
        <div
          className="absolute inset-0 animate-pulse bg-gray-200"
          style={{ width: props.width, height: props.height }}
        />
      )}
    </div>
  );
}

// ============================================
// Hero Image (Optimized for LCP)
// ============================================

interface HeroImageProps {
  src: string;
  alt: string;
  overlayContent?: React.ReactNode;
}

export function HeroImage({ src, alt, overlayContent }: HeroImageProps) {
  return (
    <div className="relative h-[60vh] min-h-[400px] w-full">
      <Image
        src={src}
        alt={alt}
        fill
        priority // Critical for LCP
        sizes="100vw"
        quality={85}
        className="object-cover"
      />
      {overlayContent && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          {overlayContent}
        </div>
      )}
    </div>
  );
}

// ============================================
// Avatar Image
// ============================================

interface AvatarImageProps {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackInitials?: string;
}

const avatarSizes = {
  sm: { container: 'h-8 w-8', text: 'text-xs' },
  md: { container: 'h-10 w-10', text: 'text-sm' },
  lg: { container: 'h-12 w-12', text: 'text-base' },
  xl: { container: 'h-16 w-16', text: 'text-lg' },
};

export function AvatarImage({
  src,
  alt,
  size = 'md',
  fallbackInitials,
}: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);
  const { container, text } = avatarSizes[size];

  if (!src || hasError) {
    return (
      <div
        className={cn(
          container,
          'flex items-center justify-center rounded-full bg-gray-200'
        )}
      >
        <span className={cn(text, 'font-medium text-gray-600')}>
          {fallbackInitials || alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(container, 'relative overflow-hidden rounded-full')}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={size === 'xl' ? '64px' : size === 'lg' ? '48px' : '40px'}
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
