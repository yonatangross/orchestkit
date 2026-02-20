---
title: React Responsive Patterns
impact: HIGH
impactDescription: React component patterns for responsive layouts using hooks, container queries, and conditional rendering
tags: [react, responsive, hooks, container-queries]
---

# React Responsive Patterns

## Responsive Component with Container Queries

```tsx
import { cn } from '@/lib/utils';

interface CardProps {
  title: string;
  description: string;
  image: string;
}

export function ResponsiveCard({ title, description, image }: CardProps) {
  return (
    <div className="@container">
      <article className={cn(
        "flex flex-col gap-4",
        "@md:flex-row @md:gap-6" // Container query breakpoints
      )}>
        <img
          src={image}
          alt=""
          className="w-full @md:w-48 aspect-video object-cover rounded-lg"
        />
        <div className="flex flex-col gap-2">
          <h3 className="text-[clamp(1rem,0.5rem+3cqi,1.5rem)] font-semibold">
            {title}
          </h3>
          <p className="text-[clamp(0.875rem,0.5rem+2cqi,1rem)] text-muted-foreground">
            {description}
          </p>
        </div>
      </article>
    </div>
  );
}
```

## Tailwind CSS Container Queries

```tsx
// @container enables container query variants (@sm, @md, @lg, etc.)
<div className="@container">
  <div className="flex flex-col @lg:flex-row @xl:gap-8">
    <div className="@sm:p-4 @md:p-6 @lg:p-8">
      Content adapts to container
    </div>
  </div>
</div>
```

## useContainerQuery Hook

```tsx
import { useRef, useState, useEffect } from 'react';

function useContainerQuery(breakpoint: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [isAbove, setIsAbove] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setIsAbove(entry.contentRect.width >= breakpoint);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [breakpoint]);

  return [ref, isAbove] as const;
}

// Usage
function AdaptiveCard() {
  const [containerRef, isWide] = useContainerQuery(400);

  return (
    <div ref={containerRef}>
      {isWide ? <HorizontalLayout /> : <VerticalLayout />}
    </div>
  );
}
```

## Responsive Images Pattern

```tsx
function ResponsiveImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
}: {
  src: string;
  alt: string;
  sizes?: string;
}) {
  return (
    <picture>
      {/* Art direction with different crops */}
      <source
        media="(max-width: 640px)"
        srcSet={`${src}?w=640&aspect=1:1`}
      />
      <source
        media="(max-width: 1024px)"
        srcSet={`${src}?w=800&aspect=4:3`}
      />
      <img
        src={`${src}?w=1200`}
        alt={alt}
        sizes={sizes}
        loading="lazy"
        decoding="async"
        className="w-full h-auto object-cover"
      />
    </picture>
  );
}
```
