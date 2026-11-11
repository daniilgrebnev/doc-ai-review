import { NextResponse } from "next/server";
import { getProvidersForRequest } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(getProvidersForRequest(request.headers));
}
