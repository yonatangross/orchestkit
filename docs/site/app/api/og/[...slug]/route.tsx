import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { source } from "@/lib/source";
import { SITE } from "@/lib/constants";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ slug: string[] }> },
) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  const title = page?.data.title ?? "Documentation";
  const description = page?.data.description ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0A0A",
          color: "#FAFAFA",
          fontFamily: "system-ui, sans-serif",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "18px",
              color: "#6EE7B7",
              fontWeight: 600,
              marginBottom: "24px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            {SITE.name}
          </span>
          <span
            style={{
              fontSize: "56px",
              fontWeight: 800,
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            {title}
          </span>
          {description && (
            <span
              style={{
                fontSize: "24px",
                color: "#A1A1AA",
                marginTop: "20px",
                maxWidth: "800px",
                lineHeight: 1.4,
              }}
            >
              {description.length > 120
                ? `${description.slice(0, 120)}...`
                : description}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#6EE7B7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: 800,
              color: "#0A0A0A",
            }}
          >
            O
          </div>
          <span style={{ fontSize: "20px", color: "#71717A" }}>
            orchestkit.dev
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
