import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { detectEventType, getPlatformDefinition } from "./aggregatorAdapters";
import { hmacHex, safeEqual, sha256Hex, stripSignaturePrefix } from "./aggregatorSignature";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function headerValue(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

/**
 * POST /aggregator/webhook/<webhookKey>
 *
 * Signed webhook receiver for third-party aggregators. The raw body is
 * verified against the integration's HMAC secret before anything is written,
 * then the payload is handed to an idempotent mutation so retries and
 * duplicate deliveries can never create a second order.
 */
export const aggregatorWebhookHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const webhookKey = segments[segments.length - 1] ?? "";
  const rawBody = await request.text();

  if (!webhookKey) {
    return jsonResponse({ ok: false, error: "Missing integration key" }, 404);
  }

  const integration = await ctx.runQuery(
    internal.aggregatorIngest.findByWebhookKey,
    { webhookKey },
  );
  if (!integration) {
    return jsonResponse({ ok: false, error: "Unknown integration" }, 404);
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    // Handled below: unparsable bodies are rejected with a log entry.
  }

  const eventType = detectEventType(integration.platform, payload);
  const bodyEventId =
    typeof payload.event_id === "string"
      ? payload.event_id
      : typeof payload.eventId === "string"
        ? payload.eventId
        : undefined;
  const payloadHash = await sha256Hex(rawBody);
  const eventId =
    headerValue(request.headers, ["x-event-id", "x-webhook-id", "x-delivery-id"]) ??
    bodyEventId ??
    `${eventType}:${payloadHash.slice(0, 24)}`;

  const definition = getPlatformDefinition(integration.platform);
  const provided = headerValue(request.headers, [
    definition.signatureHeader,
    "x-aggregator-signature",
    "x-webhook-signature",
  ]);
  const expected = await hmacHex(integration.webhookSecret, rawBody);

  if (!provided || !safeEqual(stripSignaturePrefix(provided), expected)) {
    await ctx.runMutation(internal.aggregatorIngest.logRejectedEvent, {
      integrationId: integration._id,
      restaurantId: integration.restaurantId,
      webhookKey,
      platform: integration.platform,
      eventId,
      eventType,
      payloadJson: rawBody,
      reason: "Invalid webhook signature",
    });
    return jsonResponse({ ok: false, error: "Invalid signature" }, 401);
  }

  if (!integration.isEnabled) {
    await ctx.runMutation(internal.aggregatorIngest.logRejectedEvent, {
      integrationId: integration._id,
      restaurantId: integration.restaurantId,
      webhookKey,
      platform: integration.platform,
      eventId,
      eventType,
      payloadJson: rawBody,
      reason: "Integration is disabled",
    });
    return jsonResponse({ ok: false, error: "Integration is disabled" }, 403);
  }

  if (Object.keys(payload).length === 0) {
    await ctx.runMutation(internal.aggregatorIngest.logRejectedEvent, {
      integrationId: integration._id,
      restaurantId: integration.restaurantId,
      webhookKey,
      platform: integration.platform,
      eventId,
      eventType,
      payloadJson: rawBody,
      reason: "Payload is not valid JSON",
    });
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const result = await ctx.runMutation(internal.aggregatorIngest.ingestVerified, {
    integrationId: integration._id,
    eventId,
    eventType,
    payloadJson: rawBody,
  });

  // 422 asks the aggregator to retry — useful while a menu mapping is missing,
  // because a retry is reprocessed once the mapping exists.
  const status =
    result.status === "rejected" || result.status === "unmapped" ? 422 : 200;

  return jsonResponse(
    {
      ok: result.status === "processed" || result.status === "duplicate",
      status: result.status,
      eventId,
      orderId: result.orderId,
      reason: result.reason,
      unmapped: result.unmapped,
    },
    status,
  );
});
