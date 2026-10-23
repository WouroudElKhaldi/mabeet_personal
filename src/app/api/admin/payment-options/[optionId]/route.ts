import { z } from "zod";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { editPaymentOption, removePaymentOption } from "@/server/services/plan-request-service";
import { paymentOptionUpdate } from "@/server/validation/schemas";

const params = z.object({ optionId: z.string().min(1).max(64) });

export const PATCH = route(async (request, context) => {
  const user = await requireUser(request);
  const { optionId } = await parseParams(context, params);
  await editPaymentOption(user, optionId, await parseBody(request, paymentOptionUpdate));
  return json({ ok: true });
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request);
  const { optionId } = await parseParams(context, params);
  await removePaymentOption(user, optionId);
  return json({ ok: true });
});
