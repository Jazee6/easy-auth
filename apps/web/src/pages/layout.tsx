import { Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { getData, ResponseError } from "@/lib/request.ts";
import { SWRConfig } from "swr";

const Layout = () => {
  const nav = useNavigate();

  const value = {
    onError: (err: Error) => {
      toast.error(err.message);

      if (err instanceof ResponseError) {
        if (err.status === 401) {
          nav("/login");
        }
      }
    },
    fetcher: getData,
  };

  return (
    <SWRConfig value={value}>
      <Outlet />
    </SWRConfig>
  );
};

export default Layout;
