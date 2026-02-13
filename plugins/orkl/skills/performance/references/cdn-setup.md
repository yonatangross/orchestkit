# Image CDN Configuration

Complete guide to configuring image CDNs and optimization pipelines.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Image Delivery Pipeline                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Source              CDN / Optimizer              Browser                   │
│  ┌────────┐          ┌─────────────┐            ┌──────────┐               │
│  │ Origin │──────────►│   Resize   │──AVIF────►│  Chrome  │               │
│  │ Server │           │   Format   │            │  Safari  │               │
│  │  /CMS  │           │   Quality  │──WebP────►│  Firefox │               │
│  └────────┘           │   Cache    │            │  Edge    │               │
│                       └─────────────┘            └──────────┘               │
│                             │                                                │
│                      ┌──────▼──────┐                                        │
│                      │  Edge Cache │                                        │
│                      │  (Global)   │                                        │
│                      └─────────────┘                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Next.js Remote Patterns

### Basic Configuration

```typescript
// next.config.js
module.exports = {
  images: {
    // Enable modern formats
    formats: ['image/avif', 'image/webp'],

    // Allowed remote sources (required for external images)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        pathname: '/my-bucket/**',
      },
    ],

    // Responsive breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Cache TTL (seconds) - default 60, increase for CDN
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days

    // Disable optimization in development (faster builds)
    unoptimized: process.env.NODE_ENV === 'development',
  },
};
```

### Environment-Based Configuration

```typescript
// next.config.js
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],

    // Different patterns per environment
    remotePatterns: [
      // Production CDN
      ...(isProd
        ? [
            {
              protocol: 'https',
              hostname: 'cdn.example.com',
            },
          ]
        : []),

      // Development/staging
      ...(!isProd
        ? [
            {
              protocol: 'https',
              hostname: 'staging-cdn.example.com',
            },
            {
              protocol: 'http',
              hostname: 'localhost',
              port: '3001',
            },
          ]
        : []),
    ],
  },
};
```

## Cloudinary Integration

### Loader Implementation

```typescript
// lib/loaders/cloudinary.ts
import type { ImageLoader } from 'next/image';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export const cloudinaryLoader: ImageLoader = ({ src, width, quality }) => {
  // Build transformation string
  const transforms = [
    `w_${width}`,
    `q_${quality || 'auto:good'}`,
    'f_auto', // Auto format (AVIF > WebP > JPEG)
    'c_limit', // Don't upscale
    'dpr_auto', // Auto DPR
  ].join(',');

  // Handle both full URLs and paths
  const imagePath = src.startsWith('http')
    ? src.replace(/^https?:\/\/[^/]+/, '')
    : src;

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${imagePath}`;
};

// Advanced loader with more options
export const cloudinaryAdvancedLoader: ImageLoader = ({ src, width, quality }) => {
  const params = new URLSearchParams();

  // Responsive width
  params.set('w', width.toString());

  // Quality (auto:good is a good default)
  params.set('q', quality?.toString() || 'auto:good');

  // Additional optimizations
  const transforms = [
    `w_${width}`,
    `q_${quality || 'auto:good'}`,
    'f_auto', // Best format for browser
    'c_limit', // Don't upscale
    'fl_progressive', // Progressive loading
    'fl_immutable_cache', // Long cache
  ].join(',');

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${src}`;
};

export default cloudinaryLoader;
```

### Usage

```tsx
import Image from 'next/image';
import { cloudinaryLoader } from '@/lib/loaders/cloudinary';

// Component usage
<Image
  loader={cloudinaryLoader}
  src="products/shoe-red.jpg" // Path in Cloudinary
  alt="Red running shoe"
  width={400}
  height={400}
  sizes="(max-width: 768px) 100vw, 400px"
/>

// Global loader configuration
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './lib/loaders/cloudinary.ts',
  },
};
```

## Imgix Integration

```typescript
// lib/loaders/imgix.ts
import type { ImageLoader } from 'next/image';

const IMGIX_DOMAIN = process.env.NEXT_PUBLIC_IMGIX_DOMAIN;

export const imgixLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(`https://${IMGIX_DOMAIN}${src}`);

  // Auto format negotiation
  url.searchParams.set('auto', 'format,compress');

  // Width
  url.searchParams.set('w', width.toString());

  // Quality
  url.searchParams.set('q', (quality || 75).toString());

  // Fit mode (contain, cover, fill, etc.)
  url.searchParams.set('fit', 'max');

  return url.toString();
};

// With advanced features
export const imgixAdvancedLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(`https://${IMGIX_DOMAIN}${src}`);

  url.searchParams.set('auto', 'format,compress');
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', (quality || 75).toString());
  url.searchParams.set('fit', 'max');

  // Face detection for portraits
  // url.searchParams.set('fit', 'facearea');
  // url.searchParams.set('facepad', '2');

  // Blur for placeholders
  // url.searchParams.set('blur', '200');
  // url.searchParams.set('px', '16');

  return url.toString();
};
```

## Cloudflare Images

```typescript
// lib/loaders/cloudflare.ts
import type { ImageLoader } from 'next/image';

// Using Cloudflare Image Resizing
export const cloudflareResizingLoader: ImageLoader = ({ src, width, quality }) => {
  // src should be the full URL of the original image
  const params = [
    `width=${width}`,
    `quality=${quality || 85}`,
    'format=auto', // Auto AVIF/WebP
    'fit=scale-down', // Don't upscale
  ].join(',');

  return `https://yourdomain.com/cdn-cgi/image/${params}/${src}`;
};

// Using Cloudflare Images (upload API)
const ACCOUNT_HASH = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH;

export const cloudflareImagesLoader: ImageLoader = ({ src, width }) => {
  // src is the image ID from Cloudflare
  // Variants are predefined in Cloudflare dashboard
  const variant = width <= 640 ? 'small' : width <= 1024 ? 'medium' : 'large';

  return `https://imagedelivery.net/${ACCOUNT_HASH}/${src}/${variant}`;
};
```

## AWS S3 + CloudFront

```typescript
// lib/loaders/aws.ts
import type { ImageLoader } from 'next/image';

const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;

// Basic CloudFront loader (requires Lambda@Edge for resizing)
export const cloudfrontLoader: ImageLoader = ({ src, width, quality }) => {
  // Lambda@Edge parses these query params
  const params = new URLSearchParams({
    w: width.toString(),
    q: (quality || 80).toString(),
    f: 'auto',
  });

  return `https://${CLOUDFRONT_DOMAIN}${src}?${params}`;
};

// For static S3 images (no resizing)
export const s3Loader: ImageLoader = ({ src }) => {
  return `https://${CLOUDFRONT_DOMAIN}${src}`;
};
```

## Vercel Image Optimization

```typescript
// Automatically enabled on Vercel
// Configure in next.config.js
module.exports = {
  images: {
    // Use Vercel's built-in optimizer
    loader: 'default',

    // External domains need explicit allowlist
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
      },
    ],

    // Increase cache for static images
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
};

// For non-Vercel deployments, use external loader
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './lib/loaders/cloudinary.ts',
  },
};
```

## Self-Hosted with Sharp

```typescript
// For self-hosted Next.js (Docker, Node.js)

// 1. Install Sharp
// npm install sharp

// 2. Configure next.config.js
module.exports = {
  images: {
    loader: 'default', // Uses Sharp internally
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days

    // Important for self-hosted
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },
};

// 3. Dockerfile - ensure Sharp can build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

## CDN Headers & Caching

### Nginx Configuration

```nginx
# /etc/nginx/conf.d/images.conf

# Image caching
location ~* \.(jpg|jpeg|png|webp|avif|gif|ico|svg)$ {
    # Long cache for immutable assets
    expires 1y;
    add_header Cache-Control "public, immutable";

    # Vary by Accept header for format negotiation
    add_header Vary "Accept";

    # Security headers
    add_header X-Content-Type-Options "nosniff";
}

# Next.js optimized images
location /_next/image {
    proxy_pass http://nextjs_upstream;
    proxy_cache_valid 200 365d;

    # Cache key includes Accept header for format
    proxy_cache_key "$scheme$request_method$host$request_uri$http_accept";

    add_header X-Cache-Status $upstream_cache_status;
}
```

### Cloudflare Page Rules

```json
{
  "targets": [
    {
      "target": "url",
      "constraint": {
        "operator": "matches",
        "value": "*.example.com/*.(jpg|jpeg|png|webp|avif|gif)"
      }
    }
  ],
  "actions": [
    {
      "id": "cache_level",
      "value": "cache_everything"
    },
    {
      "id": "edge_cache_ttl",
      "value": 2592000
    },
    {
      "id": "browser_cache_ttl",
      "value": 31536000
    },
    {
      "id": "polish",
      "value": "lossless"
    }
  ]
}
```

## Blur Placeholder Generation

### Build-Time with Plaiceholder

```typescript
// lib/blur.ts
import { getPlaiceholder } from 'plaiceholder';
import fs from 'fs/promises';
import path from 'path';

export async function getBlurDataURL(imagePath: string): Promise<string> {
  try {
    const file = await fs.readFile(path.join(process.cwd(), 'public', imagePath));
    const { base64 } = await getPlaiceholder(file);
    return base64;
  } catch {
    // Return a tiny transparent placeholder on error
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

// Usage in getStaticProps
export async function getStaticProps() {
  const blurDataURL = await getBlurDataURL('/images/hero.jpg');
  return {
    props: { blurDataURL },
  };
}
```

### Remote Image Blur

```typescript
// lib/remote-blur.ts
import { getPlaiceholder } from 'plaiceholder';

export async function getRemoteBlurDataURL(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { base64 } = await getPlaiceholder(buffer);
    return base64;
  } catch {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

// Cache blur data URLs
const blurCache = new Map<string, string>();

export async function getCachedBlurDataURL(imageUrl: string): Promise<string> {
  if (blurCache.has(imageUrl)) {
    return blurCache.get(imageUrl)!;
  }

  const blur = await getRemoteBlurDataURL(imageUrl);
  blurCache.set(imageUrl, blur);
  return blur;
}
```

## Image Validation & Error Handling

```typescript
// lib/image-validation.ts
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedHosts = ['cdn.example.com', 'images.unsplash.com'];
    return allowedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export function getOptimizedImageUrl(
  src: string,
  options: { width: number; quality?: number }
): string {
  // Use your CDN loader
  const { width, quality = 80 } = options;

  if (src.includes('cloudinary.com')) {
    return src.replace('/upload/', `/upload/w_${width},q_${quality},f_auto/`);
  }

  // Default: return as-is
  return src;
}
```
