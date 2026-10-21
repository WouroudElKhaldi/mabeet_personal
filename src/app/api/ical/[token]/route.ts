import { z } from "zod";
import { notFound } from "@/server/errors";
import { parseParams, route } from "@/server/http/route";
import { buildRoomExport } from "@/server/services/calendar-service";

// Platforms often insist the URL ends in .ics, so accept it with or without the extension.
const params = z.object({
  token: z
    .string()
    .max(80)
    .transform((value) => value.replace(/\.ics$/, ""))
    .pipe(z.string().min(20)),
});

export const GET = route(async (_request, context) => {
  const { token } = await parseParams(context, params);
  const ics = await buildRoomExport(token);
  if (!ics) throw notFound("Calendar");
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
});
