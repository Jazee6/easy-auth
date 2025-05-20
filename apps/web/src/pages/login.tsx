import Footer from "@/components/footer.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { post } from "@/lib/request.ts";
import { AppInfo, LoginResponse, User } from "@/lib/types.ts";
import { getGithubUrl } from "@/lib/utils.ts";
import { loginSchema } from "@easy-auth/share";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { z } from "zod";

const LoginForm = ({ loading }: { loading: boolean }) => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const client_id = searchParams.get("client_id") ?? undefined;
  const state = searchParams.get("state") ?? undefined;
  const redirect_uri = searchParams.get("redirect_uri") ?? undefined;

  const { trigger, isMutating } = useSWRMutation("/login", post<LoginResponse>);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      client_id,
      state,
      redirect_uri,
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    const data = await trigger(values);
    if (data?.redirect) {
      location.href = data.redirect;
      return;
    }

    nav(searchParams.get("redirect") ?? "/");
    toast.success("登陆成功");
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮箱</FormLabel>
                <FormControl>
                  <Input type="email" inputMode="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            loading={isMutating || loading}
          >
            登录
          </Button>
        </form>
      </Form>
      <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
        <span className="bg-background text-muted-foreground relative z-10 px-2">
          或使用其他账号登录
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Link
          to={getGithubUrl({
            client_id,
            state,
            redirect_uri,
          })}
        >
          <Button variant="outline" type="button" className="w-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            <span className="sr-only">使用Github账号登录</span>
          </Button>
        </Link>
      </div>
    </>
  );
};

const Login = () => {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const client_id = searchParams.get("client_id") ?? undefined;

  const { data: app } = useSWR<AppInfo>(
    client_id ? `/app/info/${client_id}` : undefined,
  );
  const other = searchParams.get("other");
  const { data, isLoading } = useSWR<User | null>(
    other ? undefined : "/login/check",
  );
  const { trigger, isMutating } = useSWRMutation(
    "/login/ok",
    post<LoginResponse>,
  );

  const handleNav = async () => {
    if (client_id) {
      const data = await trigger({
        client_id,
        state: searchParams.get("state") ?? undefined,
        redirect_uri: searchParams.get("redirect_uri") ?? undefined,
      });
      if (data?.redirect) {
        location.href = data.redirect;
        return;
      }
    }

    nav("/");
    toast.success("登录成功");
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className={"flex flex-col gap-6"}>
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">登录</h1>
                    {client_id && (
                      <>
                        {app ? (
                          <p className="text-muted-foreground text-balance">
                            登陆到{app.name}
                          </p>
                        ) : (
                          <Skeleton className="w-full h-6" />
                        )}
                      </>
                    )}
                  </div>

                  {data ? (
                    <div className="animate-in fade-in">
                      <div
                        onClick={handleNav}
                        className="w-full rounded-md p-4 flex items-center space-x-2 cursor-pointer bg-secondary hover:shadow-md transition-shadow"
                      >
                        <Avatar>
                          <AvatarImage
                            src={data.avatar ? data.avatar : undefined}
                            alt="avatar"
                          />
                          <AvatarFallback>EA</AvatarFallback>
                        </Avatar>
                        <span>{data.nickname || data.email}</span>
                        {isMutating ? (
                          <Loader2 className="ml-auto animate-spin" />
                        ) : (
                          <span className="ml-auto text-sm">已登陆</span>
                        )}
                      </div>

                      <div className="flex">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setSearchParams((prev) => {
                              prev.set("other", "true");
                              return prev;
                            })
                          }
                          className="mx-auto mt-4 cursor-pointer"
                        >
                          登陆其他账号
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <LoginForm loading={isLoading} />
                  )}

                  <div className="text-center text-sm">
                    还没有账号？{" "}
                    <Link
                      to={"/signup" + location.search}
                      className="underline underline-offset-4"
                    >
                      立即注册
                    </Link>
                  </div>

                  <div className="text-center text-destructive text-sm mt-4">
                    当前仍在测试阶段，您的账号可能随时会被删除！
                  </div>
                </div>
              </div>
              <div className="bg-muted relative hidden md:block">
                {/*<img*/}
                {/*  src="/placeholder.svg"*/}
                {/*  alt="Image"*/}
                {/*  className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"*/}
                {/*/>*/}
                <div className="inset-0 bg-gradient-to-br from-cyan-50 to-lime-50 absolute"></div>
              </div>
            </CardContent>
          </Card>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Login;
