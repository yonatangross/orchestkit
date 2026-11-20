import type { Node } from "./api.js";
declare global {
  const h: (tag: string | ((props: never) => Node), props: Record<string, unknown> | null, ...children: unknown[]) => Node;
  namespace JSX {
    type Element = Node;
    interface IntrinsicAttributes { key?: string }
    interface ElementChildrenAttribute { children: unknown }
  }
}
