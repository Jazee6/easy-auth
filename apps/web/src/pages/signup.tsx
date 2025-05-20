import { useCftForm } from "@/components/cft.tsx";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { post } from "@/lib/request.ts";
import { AppInfo, LoginResponse } from "@/lib/types.ts";
import { signupSchema } from "@easy_auth/share";
import { zodResolver } from "@hookform/resolvers/zod";
import { GalleryVerticalEnd } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { z } from "zod";

const Signup = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const client_id = searchParams.get("client_id") ?? undefined;

  const { data: app } = useSWR<AppInfo>(
    client_id ? `/app/info/${client_id}` : undefined,
  );
  const { trigger, isMutating } = useSWRMutation(
    "/signup",
    post<LoginResponse>,
  );

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      cft: "",
      client_id,
      state: searchParams.get("state") ?? undefined,
      redirect_uri: searchParams.get("redirect_uri") ?? undefined,
    },
  });
  const { holder, reset, isLoading } = useCftForm(form);

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    reset();
    const data = await trigger(values);
    if (data?.redirect) {
      location.href = data.redirect;
      return;
    }

    nav(searchParams.get("redirect") ?? "/");
    toast.success("注册成功");
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          href="https://github.com/Jazee6/easy-auth"
          target="_blank"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Easy Auth
        </a>
        <div className={"flex flex-col gap-6"}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">注册</CardTitle>
              <CardDescription>
                {app && "注册成功后，您将会跳转到" + app.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            {...field}
                          />
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
                          <Input
                            type="password"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {holder}
                  <Button
                    className="w-full"
                    type="submit"
                    loading={isMutating || isLoading}
                  >
                    注册
                  </Button>
                </form>

                <div className="text-center text-sm mt-4">
                  已有账号？{" "}
                  <Link
                    to={"/login" + location.search}
                    className="underline underline-offset-4"
                  >
                    登录
                  </Link>
                </div>

                <div className="text-center text-destructive text-sm mt-4">
                  当前仍在测试阶段，您的账号可能随时会被删除！
                </div>
              </Form>
            </CardContent>
          </Card>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Signup;
