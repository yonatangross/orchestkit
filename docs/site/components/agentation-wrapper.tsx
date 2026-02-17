"use client";

import { Agentation } from "agentation";

export function AgentationWrapper() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation endpoint="http://localhost:4747" webhookUrl="http://localhost:4747" />;
}
