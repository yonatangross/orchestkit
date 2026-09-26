import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { HomeShell } from "@/components/home-shell";
import { SiteFooter } from "@/components/site-footer";
import { HomeContainer } from "./home-container";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions} slots={{ container: HomeContainer }}>
      <HomeShell>
        {children}
        <SiteFooter />
      </HomeShell>
    </HomeLayout>
  );
}
