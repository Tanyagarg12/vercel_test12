// Server route behind the Demo Controls panel.
//
// The panel is a client component and cannot read API_BASE_URL (server-only),
// so it posts here and this route calls the platform. Only the two actions the
// UI exposes are accepted — an unknown action is rejected rather than forwarded.

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  ApiUnavailableError,
  PLATFORM_CACHE_TAG,
  postDemoInject,
  postDemoReset,
} from "@/lib/api/client";

interface Body {
  action?: unknown;
  dataset?: unknown;
  assetId?: unknown;
  scenario?: unknown;
  severity?: unknown;
  durationDays?: unknown;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    if (body.action === "reset") {
      const dataset = typeof body.dataset === "string" && body.dataset ? body.dataset : null;
      const result = await postDemoReset(dataset);
      // The fleet just changed. `expire: 0` drops cached reads immediately so
      // the operator sees their own write, rather than stale-while-revalidate.
      revalidateTag(PLATFORM_CACHE_TAG, { expire: 0 });
      return NextResponse.json({ result });
    }

    if (body.action === "inject") {
      if (typeof body.assetId !== "string" || !body.assetId) {
        return NextResponse.json({ error: "`assetId` is required." }, { status: 400 });
      }
      if (typeof body.scenario !== "string" || !body.scenario) {
        return NextResponse.json({ error: "`scenario` is required." }, { status: 400 });
      }
      const severity = typeof body.severity === "string" ? body.severity : "HIGH";
      const durationDays = Number(body.durationDays);

      const result = await postDemoInject({
        asset_id: body.assetId,
        scenario: body.scenario,
        severity,
        duration_days: Number.isFinite(durationDays) ? durationDays : 5,
      });
      revalidateTag(PLATFORM_CACHE_TAG, { expire: 0 });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof ApiUnavailableError ? error.message : "Unexpected error contacting the API.";
    // 502: the request was well-formed, the upstream service is the problem.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
