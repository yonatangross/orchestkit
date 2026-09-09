"use client";

import { type ReactNode, useEffect } from "react";
import { KineticGrid } from "@/components/lab/kinetic-grid";

/** Client shell so 21st.dev Kinetic Grid hydrates under fumadocs HomeLayout. */
export function HomeShell({ children }: { children: ReactNode }) {
	useEffect(() => {
		document.documentElement.classList.add("has-kinetic-grid");
		return () => document.documentElement.classList.remove("has-kinetic-grid");
	}, []);

	return (
		<>
			<KineticGrid className="fixed inset-0 z-0 h-dvh w-screen" />
			<div className="relative z-10">{children}</div>
		</>
	);
}
