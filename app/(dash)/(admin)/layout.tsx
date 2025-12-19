import { checkAdmin } from "@/lib/actions";

const Index = async ({ children }: LayoutProps<"/">) => {
  await checkAdmin();

  return children;
};

export default Index;
