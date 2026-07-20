import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/is-demo-mode";

export async function GET() {
  return NextResponse.json({ demo: isDemoMode() });
}
