import { Skeleton } from "@/components/ui/skeleton";

const Loading = () => {
  return (
    <main className="space-y-4 w-full max-w-3xl mx-auto">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </main>
  );
};

export default Loading;
