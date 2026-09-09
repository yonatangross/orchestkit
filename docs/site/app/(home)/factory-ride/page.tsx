import type { Metadata } from "next";
import { FactoryRideStory } from "@/components/world/factory-ride-story";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Factory Ride",
  description: `A scroll-driven walkthrough of how ${SITE.name} skills, agents, and hooks ship a change.`,
  alternates: { canonical: `${SITE.domain}/factory-ride` },
};

export default function FactoryRidePage() {
  return (
    <main>
      <FactoryRideStory />
    </main>
  );
}
