import { post, ResponseError } from "@/lib/request.ts";
import { LoginResponse } from "@/lib/types.ts";
import { Code } from "@easy-auth/share";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

const OAuth = () => {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { provider } = useParams();

  useEffect(() => {
    const state = sessionStorage.getItem("state");
    if (state !== searchParams.get("state")) {
      toast.error("参数错误");
      return;
    }

    const arg = {
      code: searchParams.get("code"),
      state: searchParams.get("state") ?? undefined,
      client_id: searchParams.get("client_id") ?? undefined,
      redirect_uri: searchParams.get("redirect_uri") ?? undefined,
    };

    post<LoginResponse>("/auth/" + provider, {
      arg,
    })
      .then((data) => {
        toast.success("登陆成功");

        if (data?.redirect) {
          location.href = data.redirect;
          return;
        }
        nav(searchParams.get("redirect") || "/", {
          replace: true,
        });
      })
      .catch((e: Error) => {
        if (e instanceof ResponseError) {
          if (e.code === Code.AccountAlreadyLinked) {
            toast.warning(
              "此账号已关联其他用户，如果这是你的账号，请登陆后关联",
              {
                duration: Infinity,
                action: {
                  label: "去登陆",
                  onClick: () => {
                    nav("/login", {
                      replace: true,
                    });
                  },
                },
              },
            );
            return;
          }
          toast.error(e.message);
        }
      });
  }, [nav, provider, searchParams]);

  return (
    <div className="h-screen flex items-center justify-center">
      <span>{provider}登陆中...</span>
      <Loader2 className="animate-spin ml-2" />
    </div>
  );
};

export default OAuth;
