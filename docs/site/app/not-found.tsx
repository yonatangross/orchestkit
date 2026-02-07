import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold tabular-nums">404</h1>
      <p className="mt-4 text-lg text-fd-muted-foreground">
        This page doesn't exist.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground shadow-sm transition-colors hover:bg-fd-primary/90"
        >
          Home
        </Link>
        <Link
          href="/docs/foundations/overview"
          className="inline-flex h-10 items-center rounded-md border border-fd-border px-6 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          Documentation
        </Link>
      </div>
    </main>
  );
}
