"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Sliding-indicator tabs. Shape from 21st.dev Animated Tabs (24930).
 * Tokens are Fumadocs `fd-*`. Reduced-motion skips the layout animation.
 */

export type AnimatedTabItem<Id extends string = string> = {
	id: Id;
	label: ReactNode;
	href?: string;
};

export function AnimatedTabs<Id extends string>({
	tabs,
	value,
	onChange,
	onKeyDown,
	ariaLabel,
	layoutId,
	className,
}: {
	tabs: readonly AnimatedTabItem<Id>[];
	value: Id;
	onChange: (id: Id) => void;
	onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
	ariaLabel: string;
	layoutId: string;
	className?: string;
}) {
	return (
		<LayoutGroup id={layoutId}>
		<div
			role="tablist"
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
			className={cn(
				"relative mb-6 inline-flex w-max max-w-full flex-wrap items-center gap-1 rounded-lg border border-fd-border p-1",
				className,
			)}
		>
			{tabs.map((tab) => {
				const selected = tab.id === value;
				const shared = cn(
					"relative z-0 inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors [&_svg]:block [&_svg]:shrink-0",
					selected
						? "text-fd-primary"
						: "text-fd-muted-foreground hover:text-fd-foreground",
				);
				const indicator = selected ? (
					<motion.span
						layoutId={layoutId}
						className="absolute inset-0 -z-10 rounded-md bg-[var(--color-fd-primary-10)]"
						transition={{ type: "spring", stiffness: 380, damping: 32 }}
						aria-hidden="true"
					/>
				) : null;

				if (tab.href) {
					return (
						<a
							key={tab.id}
							href={tab.href}
							role="tab"
							aria-selected={selected}
							tabIndex={selected ? 0 : -1}
							id={`library-tab-${tab.id}`}
							aria-controls={`library-panel-${tab.id}`}
							className={shared}
							onClick={(e) => {
								if (
									e.metaKey ||
									e.ctrlKey ||
									e.shiftKey ||
									e.altKey ||
									e.button !== 0
								) {
									return;
								}
								e.preventDefault();
								onChange(tab.id);
							}}
						>
							{indicator}
							{tab.label}
						</a>
					);
				}

				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={selected}
						tabIndex={selected ? 0 : -1}
						id={`library-tab-${tab.id}`}
						aria-controls={`library-panel-${tab.id}`}
						className={shared}
						onClick={() => onChange(tab.id)}
					>
						{indicator}
						{tab.label}
					</button>
				);
			})}
		</div>
		</LayoutGroup>
	);
}
