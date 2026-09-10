import {
	Children,
	isValidElement,
	type ComponentProps,
	type ReactElement,
	type ReactNode,
} from "react";
import Link from "next/link";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { LibraryMark } from "@/components/category-mark";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemHeader,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";

export type HookEventRow = {
	name: string;
	matcher: string;
	behavior: string;
	description: string;
};

export type HookIndexRow = {
	category: string;
	href: string;
	count: string;
	description: string;
};

function textOf(node: ReactNode): string {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (isValidElement(node)) {
		return textOf((node.props as { children?: ReactNode }).children);
	}
	return "";
}

function hrefOf(node: ReactNode): string | null {
	if (node == null || typeof node === "boolean") return null;
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = hrefOf(child);
			if (found) return found;
		}
		return null;
	}
	if (!isValidElement(node)) return null;
	const href = (node.props as { href?: unknown }).href;
	if (typeof href === "string" && href.length > 0) return href;
	return hrefOf((node.props as { children?: ReactNode }).children);
}

function collectRows(node: ReactNode): ReactElement[] {
	const rows: ReactElement[] = [];
	const visit = (n: ReactNode) => {
		if (n == null || typeof n === "boolean") return;
		if (Array.isArray(n)) {
			n.forEach(visit);
			return;
		}
		if (!isValidElement(n)) return;
		if (n.type === "tr") {
			rows.push(n);
			return;
		}
		visit((n.props as { children?: ReactNode }).children);
	};
	visit(node);
	return rows;
}

function cellNodes(row: ReactElement): ReactElement[] {
	return Children.toArray((row.props as { children?: ReactNode }).children).filter(
		(child): child is ReactElement =>
			isValidElement(child) && (child.type === "td" || child.type === "th"),
	);
}

const HOOK_HEADERS = ["hook", "matcher", "behavior", "description"];
const INDEX_HEADERS = ["category", "hooks", "description"];

export function parseHookEventTable(children: ReactNode): HookEventRow[] | null {
	const rows = collectRows(children);
	if (rows.length < 2) return null;
	const headers = cellNodes(rows[0]).map((cell) => textOf(cell).trim().toLowerCase());
	if (headers.length !== 4) return null;
	if (!HOOK_HEADERS.every((label, i) => headers[i] === label)) return null;

	return rows.slice(1).map((row) => {
		const cells = cellNodes(row);
		return {
			name: textOf(cells[0]).trim(),
			matcher: textOf(cells[1]).trim(),
			behavior: textOf(cells[2]).trim(),
			description: textOf(cells[3]).trim() || "—",
		};
	});
}

export function parseHookIndexTable(children: ReactNode): HookIndexRow[] | null {
	const rows = collectRows(children);
	if (rows.length < 2) return null;
	const headers = cellNodes(rows[0]).map((cell) => textOf(cell).trim().toLowerCase());
	if (headers.length !== 3) return null;
	if (!INDEX_HEADERS.every((label, i) => headers[i] === label)) return null;

	return rows.slice(1).flatMap((row) => {
		const cells = cellNodes(row);
		const href = hrefOf(cells[0]);
		if (!href) return [];
		return [
			{
				category: textOf(cells[0]).trim(),
				href,
				count: textOf(cells[1]).trim(),
				description: textOf(cells[2]).trim(),
			},
		];
	});
}

function BehaviorBadge({ children }: { children: string }) {
	return (
		<span className="shrink-0 rounded border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-fd-primary">
			{children}
		</span>
	);
}

export function HookEventTable({ rows }: { rows: HookEventRow[] }) {
	return (
		<ItemGroup>
			{rows.map((row, i) => (
				<Item key={`${row.name}:${row.matcher}:${i}`} variant="outline" size="sm">
					<ItemMedia
						variant="icon"
						className="border-fd-primary/25 bg-[var(--color-fd-primary-10)] text-fd-primary"
					>
						<LibraryMark kind="hooks" />
					</ItemMedia>
					<ItemContent>
						<ItemHeader>
							<ItemTitle className="font-mono text-[13px]">{row.name}</ItemTitle>
							<BehaviorBadge>{row.behavior}</BehaviorBadge>
						</ItemHeader>
						<ItemDescription>{row.description}</ItemDescription>
						<p className="font-mono text-[11px] text-fd-muted-foreground">
							matcher {row.matcher}
						</p>
					</ItemContent>
				</Item>
			))}
		</ItemGroup>
	);
}

export function HookIndexList({ rows }: { rows: HookIndexRow[] }) {
	return (
		<ItemGroup className="gap-2">
			{rows.map((row) => (
				<Link
					key={row.href}
					href={row.href}
					className="not-prose text-inherit no-underline"
				>
					<Item variant="outline" size="sm" className="items-center">
						<ItemMedia
							variant="icon"
							className="border-fd-primary/25 bg-[var(--color-fd-primary-10)] text-fd-primary"
						>
							<LibraryMark kind="hooks" />
						</ItemMedia>
						<ItemContent>
							<ItemHeader>
								<ItemTitle>{row.category}</ItemTitle>
								<span className="shrink-0 font-mono text-[11px] tabular-nums text-fd-muted-foreground">
									{row.count}
								</span>
							</ItemHeader>
							<ItemDescription>{row.description}</ItemDescription>
						</ItemContent>
					</Item>
				</Link>
			))}
		</ItemGroup>
	);
}

const FumadocsTable = defaultMdxComponents.table;

export function DocsTable(props: ComponentProps<"table">) {
	const hookRows = parseHookEventTable(props.children);
	if (hookRows) return <HookEventTable rows={hookRows} />;
	const indexRows = parseHookIndexTable(props.children);
	if (indexRows && indexRows.length > 0) return <HookIndexList rows={indexRows} />;
	return <FumadocsTable {...props} />;
}
