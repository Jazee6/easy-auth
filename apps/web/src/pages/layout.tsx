import { get, ResponseError } from "@/lib/request.ts";
import { Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { SWRConfig } from "swr";

const Layout = () => {
  const nav = useNavigate();

  const value = {
    onError: (err: Error) => {
      if (err instanceof ResponseError) {
        if (err.status === 401) {
          toast.error(err.message);
          nav("/login");
          return;
        }
      }
      toast.error(err.message);
    },
    fetcher: get,
  };

  return (
    <SWRConfig value={value}>
      <Outlet />
    </SWRConfig>
  );
};

export default Layout;
