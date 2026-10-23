import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { invalid } from "@/server/errors";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000;

// Owners paste arbitrary URLs and the server fetches them, so refuse anything that points inside a network (SSRF).
const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

// BlockList also matches IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) against the IPv4 rules.
function isPrivateAddress(address: string): boolean {
  return privateRanges.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/** Throws unless the URL is https and every address it resolves to is public. */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw invalid("Calendar links must start with https://");
  if (url.username || url.password) throw invalid("Calendar links cannot contain credentials");
  // An IPv6 address keeps its brackets in URL.hostname ("[::1]"); the resolver needs it without them.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const addresses = await lookup(host, { all: true }).catch(() => {
    throw invalid("That calendar link's website could not be found");
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw invalid("That calendar link points to a private address");
  }
  return url;
}

/** Fetches a public calendar feed with a timeout, a size cap and no redirects. */
export async function fetchCalendarText(rawUrl: string): Promise<string> {
  const url = await assertPublicHttpsUrl(rawUrl);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "text/calendar" },
  });
  if (!response.ok) throw invalid(`The calendar link answered with status ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw invalid("That calendar is too large");
  if (!text.includes("BEGIN:VCALENDAR")) throw invalid("That link is not an iCal calendar");
  return text;
}
