"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class LazyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-fd-border bg-fd-muted text-sm text-fd-muted-foreground">
          Failed to load component. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}
