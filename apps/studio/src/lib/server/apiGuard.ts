import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isIngestAuthEnabled(): boolean {
  return Boolean(process.env.AGENT_BREACH_INGEST_KEY?.trim());
}

/**
 * Optional shared-secret auth for mutating routes. When AGENT_BREACH_INGEST_KEY
 * is unset (local dev), requests pass through so the studio works out of the box.
 */
export function requireIngestKey(request: Request): NextResponse | null {
  const expected = process.env.AGENT_BREACH_INGEST_KEY?.trim();

  if (!expected) {
    return null;
  }

  const provided =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!safeEquals(provided, expected)) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  return null;
}

/**
 * Fixed-window in-memory rate limit keyed by caller IP and route bucket.
 * Per-instance only; production deployments should add an edge/WAF layer.
 */
export function rateLimit(request: Request, bucket: string, limit: number): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }

  return null;
}

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
