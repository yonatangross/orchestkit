# Image Optimization Examples

## Hero Image with Blur Placeholder

```tsx
import Image from 'next/image';
import heroImage from '@/public/hero.jpg'; // Static import

function Hero() {
  return (
    <div className="relative h-[600px] w-full">
      <Image
        src={heroImage}
        alt="Beautiful landscape"
        fill
        priority
        placeholder="blur" // Automatic with static import
        sizes="100vw"
        style={{ objectFit: 'cover' }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <h1 className="text-5xl font-bold text-white">Welcome</h1>
      </div>
    </div>
  );
}
```

## Product Grid with Responsive Sizes

```tsx
function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <div key={product.id} className="relative aspect-square">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover rounded-lg"
          />
        </div>
      ))}
    </div>
  );
}
```

## Avatar with Fallback

```tsx
function UserAvatar({ user }) {
  const [error, setError] = useState(false);

  if (error || !user.avatarUrl) {
    return (
      <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
        <span className="text-white font-medium">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={user.avatarUrl}
      alt={user.name}
      width={40}
      height={40}
      className="rounded-full"
      onError={() => setError(true)}
    />
  );
}
```

## Art Direction (Different Crops)

```tsx
function ResponsiveBanner() {
  return (
    <>
      {/* Mobile: Portrait crop */}
      <div className="relative h-[400px] md:hidden">
        <Image
          src="/banner-mobile.jpg"
          alt="Banner"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Desktop: Landscape crop */}
      <div className="relative hidden h-[300px] md:block">
        <Image
          src="/banner-desktop.jpg"
          alt="Banner"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
    </>
  );
}
```

## Gallery with Lightbox

```tsx
function ImageGallery({ images }) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {images.map((image, i) => (
          <button
            key={image.id}
            onClick={() => setSelected(image)}
            className="relative aspect-square"
          >
            <Image
              src={image.thumbnailUrl}
              alt={image.alt}
              fill
              sizes="33vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {selected && (
        <Dialog open onClose={() => setSelected(null)}>
          <div className="relative h-[80vh] w-[90vw]">
            <Image
              src={selected.fullUrl}
              alt={selected.alt}
              fill
              sizes="90vw"
              quality={90}
              className="object-contain"
            />
          </div>
        </Dialog>
      )}
    </>
  );
}
```

## Background Image Pattern

```tsx
// For true background images, use CSS
function HeroWithCSSBackground() {
  return (
    <div
      className="h-[600px] bg-cover bg-center"
      style={{ backgroundImage: 'url(/hero.webp)' }}
    >
      <div className="h-full flex items-center justify-center bg-black/40">
        <h1 className="text-white text-5xl">Hero Title</h1>
      </div>
    </div>
  );
}

// For Next.js optimization, use Image with fill
function HeroWithNextImage() {
  return (
    <div className="relative h-[600px]">
      <Image
        src="/hero.webp"
        alt=""
        fill
        priority
        className="object-cover -z-10"
      />
      <div className="h-full flex items-center justify-center bg-black/40">
        <h1 className="text-white text-5xl">Hero Title</h1>
      </div>
    </div>
  );
}
```
