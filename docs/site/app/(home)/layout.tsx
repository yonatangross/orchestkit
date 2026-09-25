import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { HomeShell } from "@/components/home-shell";
import { SiteFooter } from "@/components/site-footer";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions}>
      <HomeShell>
        {children}
        <SiteFooter />
      </HomeShell>
    </HomeLayout>
  );
}
