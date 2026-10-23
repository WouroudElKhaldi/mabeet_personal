/** A private receipt: never cached by shared caches, shown inline, and never sniffed into something runnable. */
export function receiptResponse(receipt: {
  receiptMime: string;
  receiptBytes: Uint8Array<ArrayBuffer>;
}): Response {
  return new Response(receipt.receiptBytes, {
    headers: {
      "content-type": receipt.receiptMime,
      "cache-control": "private, no-store",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
