import { requireAdmin } from "@/lib/auth";
import { listCardProfiles } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const body = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards: listCardProfiles()
    },
    null,
    2
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="acai-card-profiles-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
