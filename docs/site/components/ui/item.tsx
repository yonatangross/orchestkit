import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn Item primitives, adapted from 21st.dev:
 * - Item (group) — https://21st.dev/shadcn/item (demo 8666)
 * - Item Image list — https://21st.dev/uiable/item-image (demo 26783)
 *
 * No @radix-ui/react-slot or class-variance-authority: the docs site's `cn`
 * is a filter-join, and these items are not asChild-composed.
 */

export function ItemGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			role="list"
			data-slot="item-group"
			className={cn("not-prose flex flex-col gap-3", className)}
			{...props}
		/>
	);
}

export function Item({
	className,
	variant = "outline",
	size = "sm",
	...props
}: ComponentProps<"div"> & {
	variant?: "default" | "outline" | "muted";
	size?: "default" | "sm";
}) {
	return (
		<div
			data-slot="item"
			role="listitem"
			className={cn(
				"flex items-start rounded-md text-sm outline-none",
				variant === "default" && "border border-transparent",
				variant === "outline" &&
					"border border-fd-border bg-[var(--color-fd-surface-raised)]",
				variant === "muted" && "border border-transparent bg-fd-muted/50",
				size === "default" && "gap-4 p-4",
				size === "sm" && "gap-2.5 px-3 py-2.5",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemMedia({
	className,
	variant = "icon",
	...props
}: ComponentProps<"div"> & { variant?: "default" | "icon" | "image" }) {
	return (
		<div
			data-slot="item-media"
			className={cn(
				"flex shrink-0 items-center justify-center",
				variant === "icon" &&
					"size-8 rounded-sm border border-fd-border bg-fd-muted [&_svg]:size-4",
				variant === "image" && "size-10 overflow-hidden rounded-sm",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-content"
			className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
			{...props}
		/>
	);
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-title"
			className={cn(
				"flex w-fit max-w-full items-center gap-2 text-sm font-medium leading-snug break-words",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			data-slot="item-description"
			className={cn(
				"text-sm font-normal leading-normal text-fd-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemHeader({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<div
			data-slot="item-header"
			className={cn(
				"flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1",
				className,
			)}
		>
			{children}
		</div>
	);
}
