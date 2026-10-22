import { LoadingStatus } from "@/components/ui/loading-status";
import { ListingPageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingStatus />
      <ListingPageSkeleton />
    </>
  );
}
