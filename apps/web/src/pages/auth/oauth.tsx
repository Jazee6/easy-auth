import { useNavigate, useParams, useSearchParams } from "react-router";
import useSWRMutation from "swr/mutation";
import { post, ResponseError } from "@/lib/request.ts";
import { useEffect } from "react";
import { toast } from "sonner";
import { Code, oauth2Schema } from "@easy-auth/share";
import { Loader2 } from "lucide-react";

const OAuth = () => {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { provider, appId } = useParams();
  const { trigger, isMutating } = useSWRMutation("/auth/" + provider, post);

  useEffect(() => {
    const state = sessionStorage.getItem("state");
    if (state !== searchParams.get("state")) {
      toast.error("参数错误");
      return;
    }

    const data = {
      code: searchParams.get("code"),
      appId,
    };

    const { success, data: valid } = oauth2Schema.safeParse(data);

    if (!success) {
      toast.error("参数错误");
      return;
    }

    trigger(valid)
      .then(({ code }) => {
        if (code === Code.Success) {
          toast.success("登陆成功");
        }

        if (code === Code.AccountLinked) {
          toast.success("账号已关联");
        }

        nav(searchParams.get("redirect") || "/", {
          replace: true,
        });
      })
      .catch((e: Error) => {
        if (e instanceof ResponseError) {
          if (e.data.code === Code.AccountAlreadyLinked) {
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
          }
        }
      });
  }, [appId, nav, searchParams, trigger]);

  return (
    <div className="h-screen flex items-center justify-center">
      {isMutating && (
        <>
          <span>{provider}登陆中...</span>
          <Loader2 className="animate-spin ml-2" />
        </>
      )}
    </div>
  );
};

export default OAuth;
