import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/is-demo-mode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({ demo: isDemoMode(request.headers) });
}
