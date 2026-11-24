import { randomUUID } from "node:crypto";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const context = auth.context;
  const encoder = new TextEncoder();
  let closeStream = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closeStream();
        }
      };
      const ping = setInterval(() => send("ping", { time: Date.now() }), 25000);
      const tripChannel = context.serviceClient
        .channel(`ftm-assignment-events-${randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload) => {
          const trip = payload.new as Record<string, unknown> | undefined;
          if (!trip) return;
          if (context.user.role === "driver" && String(trip.driver_id || "") !== context.user.id) return;
          send("assignment", { type: "assignment", trip });
          const oldTrip = payload.old as Record<string, unknown> | undefined;
          const previousStatus = String(oldTrip?.status || "").toLowerCase().replace(/[_-]+/g, " ");
          const currentStatus = String(trip.status || "").toLowerCase().replace(/[_-]+/g, " ");
          const acceptedTransition = /assigned|pending|dispatch/.test(previousStatus)
            && /scheduled|accepted|in transit|active/.test(currentStatus);
          const acceptedUpdateWithoutOldStatus = payload.eventType === "UPDATE"
            && !previousStatus
            && /scheduled|accepted/.test(currentStatus)
            && Boolean(trip.driver_id && trip.vehicle_id);
          if (acceptedTransition || acceptedUpdateWithoutOldStatus) {
            send("accepted", { trip_id: trip.id });
          }
        });
      const trackingChannels = ["mobile_device_tracking", "driver_tracking", "vehicle_gps_tracking"].map((table) =>
        context.serviceClient
          .channel(`ftm-mission-tracking-${table}-${randomUUID()}`)
          .on("postgres_changes", { event: "*", schema: "public", table }, () => send("tracking", { updated: true }))
      );
      const channels = [tripChannel, ...trackingChannels];

      let closed = false;
      closeStream = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        channels.forEach((channel) => void context.serviceClient.removeChannel(channel));
        try { controller.close(); } catch { /* Stream may already be closed by the runtime. */ }
      };
      request.signal.addEventListener("abort", closeStream, { once: true });
      channels.forEach((channel) => void channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          send("error", { message: "Live updates are temporarily unavailable." });
          send("tracking_error", { message: "Live location updates are temporarily unavailable." });
        }
      }));
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
