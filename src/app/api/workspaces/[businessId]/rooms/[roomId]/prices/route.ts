import { toDateRange } from "@/lib/dates";
import { json, parseBody, tenantRoute } from "@/server/http/route";
import { listSpecialPrices, setSpecialPrice } from "@/server/services/room-service";
import { roomParams, specialPriceInput } from "@/server/validation/schemas";

/** Upcoming special prices, as runs of nights at the same price. */
export const GET = tenantRoute(roomParams, async ({ ctx, params: { roomId } }) => {
  return json(await listSpecialPrices(ctx, roomId));
});

/** Sets (or, with rateCents null, clears) the price of every night in the range. */
export const PUT = tenantRoute(roomParams, async ({ request, ctx, params: { roomId } }) => {
  const input = await parseBody(request, specialPriceInput);
  await setSpecialPrice(ctx, roomId, toDateRange(input), input.rateCents);
  return json({ ok: true });
});
