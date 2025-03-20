import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Link, useNavigate, useSearchParams } from "react-router";
import useSWRMutation from "swr/mutation";
import { post } from "@/lib/request.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCftForm } from "@/components/cft.tsx";
import { toast } from "sonner";
import { z } from "zod";
import { signupSchema } from "@easy-auth/share";

const Signup = () => {
  const { trigger, isMutating } = useSWRMutation("/signup", post);
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      cft: "",
      // appId: params.appId
    },
  });
  const { holder, reset, isLoading } = useCftForm(form);

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    reset();
    const { success } = await trigger(values);
    if (success) {
      toast.success("注册成功");
      nav(searchParams.get("redirect") || "/", {
        replace: true,
      });
    }
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/*<a href="#" className="flex items-center gap-2 self-center font-medium">*/}
        {/*  <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">*/}
        {/*    <GalleryVerticalEnd className="size-4" />*/}
        {/*  </div>*/}
        {/*  Acme Inc.*/}
        {/*</a>*/}
        <div className={"flex flex-col gap-6"}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">注册</CardTitle>
              {/*<CardDescription>*/}
              {/*  Login with your Apple or Google account*/}
              {/*</CardDescription>*/}
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
                  <Link to="/login" className="underline underline-offset-4">
                    登录
                  </Link>
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
