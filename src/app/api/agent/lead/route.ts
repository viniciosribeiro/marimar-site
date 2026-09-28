import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { receberLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  return receberLead(request);
}
