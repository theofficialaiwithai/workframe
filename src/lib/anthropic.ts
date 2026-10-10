import Anthropic from "@anthropic-ai/sdk";

/** The model used for extraction and digest writing (PRD Section 8). */
export const MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/**
 * Lazily created so a missing ANTHROPIC_API_KEY fails the one call that needs
 * it (and is logged), not every page that happens to import this module.
 */
export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }
  return client;
}
