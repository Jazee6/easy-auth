import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
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
import { useUserProfile } from "@/lib/hooks.ts";
import { patch, put } from "@/lib/request.ts";
import { User } from "@/lib/types.ts";
import { resetPasswordSchema, userProfileSchema } from "@easy_auth/share";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWRMutation from "swr/mutation";
import { z } from "zod";

const ResetPasswordForm = () => {
  const { trigger, isMutating } = useSWRMutation("/password", put);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    values: {
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    await trigger(values);
    toast.success("更新成功");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">重设密码</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重设密码</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={isMutating}>
                确认
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const ProfileForm = ({ user }: { user: User }) => {
  const { trigger, isMutating } = useSWRMutation("/profile", patch);

  const form = useForm<z.infer<typeof userProfileSchema>>({
    resolver: zodResolver(userProfileSchema),
    values: {
      avatar: user.avatar ?? "",
      nickname: user.nickname ?? "",
    },
  });

  const onSubmit = async (values: z.infer<typeof userProfileSchema>) => {
    if (Object.values(values).every((item) => !item)) {
      return;
    }
    await trigger(values);
    toast.success("更新成功");
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 max-w-80"
        >
          <FormField
            control={form.control}
            name="avatar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>头像链接</FormLabel>
                <FormControl>
                  <Input type="url" inputMode="url" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>昵称</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" loading={isMutating}>
            更新
          </Button>
        </form>
      </Form>
      <ResetPasswordForm />
    </div>
  );
};

const Profile = () => {
  const { data: user } = useUserProfile();

  return user ? (
    <ProfileForm user={user} />
  ) : (
    <Skeleton className="w-full h-full" />
  );
};

export default Profile;
