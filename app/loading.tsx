import { Spinner } from "@/components/ui/spinner";

const Loading = () => {
  return (
    <main className="h-screen flex items-center justify-center">
      <Spinner className="mr-2" />
      Loading...
    </main>
  );
};

export default Loading;
