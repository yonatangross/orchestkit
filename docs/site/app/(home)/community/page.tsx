import type { Metadata } from "next";
import { CommunityDoors } from "@/components/community-doors";
import { CommunityRoomPreview } from "@/components/community-room-preview";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Community",
	description: `Join the ${SITE.name} WhatsApp community, GitHub Discussions, and issue tracker. The WhatsApp thread is the live room; GitHub stays searchable.`,
	alternates: { canonical: `${SITE.domain}/community` },
};

export default function CommunityPage() {
	return (
		<ContentPage
			title={`The ${SITE.name} community`}
			path="/community"
			lead="WhatsApp is the live room. GitHub Discussions stay searchable. Issues are for bugs. There is no Discord and no paid support plan."
			hero={
				<>
					<CommunityDoors />
					<CommunityRoomPreview />
				</>
			}
		/>
	);
}
