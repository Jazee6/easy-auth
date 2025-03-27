import { User } from "@/lib/types.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { get } from "@/lib/request.ts";
import { toast } from "sonner";
import { getGithubUrl } from "@/lib/utils.ts";
import { useUserProfile } from "@/lib/hooks.ts";

const Link = () => {
  const { data: user, mutate } = useUserProfile();
  const [loading, setLoading] = useState(false);

  const accounts = useMemo(() => {
    const obj: {
      [key: string]: User["accounts"][number];
    } = {};
    user?.accounts?.forEach((account) => {
      obj[account.provider] = account;
    });
    return obj;
  }, [user]);

  const handleLink = async (provider: string) => {
    if (accounts[provider]) {
      setLoading(true);
      toast.promise(get(`/auth/${provider}/unlink`), {
        loading: "正在取消关联",
        success: () => {
          mutate();
          return "取消关联成功";
        },
        error: () => {
          return "取消关联失败";
        },
      });
      setLoading(false);
      return;
    }

    switch (provider) {
      case "github":
        window.location.href = getGithubUrl({
          redirect: "/link",
        });
        break;
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-8 shrink-0"
            >
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            <Button
              variant={accounts?.github ? "secondary" : "default"}
              className="ml-auto"
              onClick={() => handleLink("github")}
              disabled={loading}
            >
              {accounts?.github ? "取消关联" : "关联"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>{accounts?.github?.name || "Github"}</CardContent>
      </Card>
    </div>
  );
};

export default Link;
