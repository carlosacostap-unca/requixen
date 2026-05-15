import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/requixen/server/env";

export async function GET() {
  return NextResponse.json(integrationStatus());
}
