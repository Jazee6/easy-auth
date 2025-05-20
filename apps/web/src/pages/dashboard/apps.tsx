import CopyButton from "@/components/copy-button.tsx";
import { DataTable } from "@/components/data-table.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet.tsx";
import { deleteReq, post } from "@/lib/request.ts";
import { deleteAppSchema, newAppSchema } from "@easy_auth/share";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { z } from "zod";

const mutateContext = createContext(() => {});

interface NewAppRes {
  id: string;
  secret: string;
}

const NewAppForm = () => {
  const { trigger, isMutating } = useSWRMutation("/app", post<NewAppRes>);
  const [open, setOpen] = useState(false);
  const [newApp, setNewApp] = useState<NewAppRes>();
  const mutate = useContext(mutateContext);

  const form = useForm<z.infer<typeof newAppSchema>>({
    resolver: zodResolver(newAppSchema),
    values: {
      name: "",
      redirect_uri: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof newAppSchema>) => {
    const data = await trigger(values);
    setNewApp(data);
    mutate();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        setTimeout(() => {
          setNewApp(undefined);
          form.reset();
        }, 200);
      }}
    >
      <SheetTrigger asChild>
        <Button>新增 +</Button>
      </SheetTrigger>
      <SheetContent>
        {newApp ? (
          <>
            <SheetHeader>
              <SheetTitle>应用信息</SheetTitle>
              <SheetDescription>
                请保存应用Secret，后续将不再显示
              </SheetDescription>

              <div className="w-full space-y-4 mt-8">
                <Label>App ID</Label>
                <div className="flex items-center">
                  <span className="font-mono text-nowrap">{newApp.id}</span>
                  <CopyButton text={newApp.id} />
                </div>

                <Label>App Secret</Label>
                <div className="flex items-center">
                  <span className="font-mono text-nowrap">{newApp.secret}</span>
                  <CopyButton text={newApp.secret} />
                </div>
              </div>
            </SheetHeader>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>新增应用</SheetTitle>
              <SheetDescription></SheetDescription>
            </SheetHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="p-4 space-y-8"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名称</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="redirect_uri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>回调地址</FormLabel>
                      <FormControl>
                        <Input inputMode="url" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" loading={isMutating}>
                  确认
                </Button>
              </form>
            </Form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

interface Apps {
  id: string;
  name: string;
  redirectUri: string;
  createdAt: string;
}

const Actions = ({ client_id }: z.infer<typeof deleteAppSchema>) => {
  const { trigger, isMutating } = useSWRMutation("/app", deleteReq);
  const [open, setOpen] = useState(false);
  const mutate = useContext(mutateContext);

  const handleDelete = async () => {
    await trigger({ client_id });
    toast.success("删除成功");
    setOpen(false);
    mutate();
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button className="text-destructive" variant="link">
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除?</AlertDialogTitle>
            <AlertDialogDescription></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={isMutating} onClick={handleDelete}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const columns: ColumnDef<Apps>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "id",
    header: "App ID",
  },
  {
    accessorKey: "redirectUri",
    header: "RedirectUri",
  },
  {
    accessorKey: "createdAt",
    header: "CreatedAt",
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      return date.toLocaleString();
    },
  },
  {
    id: "actions",
    header: () => <span className="ml-4">Actions</span>,
    cell: ({ row }) => {
      return <Actions client_id={row.original.id} />;
    },
  },
];

const Apps = () => {
  const [offset, setOffset] = useState(0);
  const { data, isValidating, mutate } = useSWR<Apps[]>(
    "/app?offset=" + offset,
  );

  return (
    <mutateContext.Provider value={mutate}>
      <div className="flex items-center">
        <NewAppForm />

        {isValidating && <Loader2 className="animate-spin ml-2" />}
      </div>

      <DataTable className="mt-4" columns={columns} data={data ?? []} />

      <div className="mt-4 flex">
        <div className="ml-auto space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffset((o) => o - 10)}
            disabled={offset === 0}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffset((o) => o + 10)}
            disabled={!data?.length}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </mutateContext.Provider>
  );
};

export default Apps;
