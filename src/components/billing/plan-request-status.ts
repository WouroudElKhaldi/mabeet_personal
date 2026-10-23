/** The colour of a plan request's status, the same for the host and the admin. */
export const STATUS_TONE: Record<"PENDING" | "APPROVED" | "REJECTED" | "CANCELLED", string> = {
  PENDING: "bg-glow/30 text-ink",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-danger/10 text-danger",
  CANCELLED: "bg-surface-2 text-muted",
};
