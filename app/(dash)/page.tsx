import ProfileUpdate from "@/components/form/profile-update";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const Page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  const { user } = session;

  return (
    <div className="max-w-3xl mx-auto">
      <ProfileUpdate
        user={{
          image: user.image ?? "",
          name: user.name ?? "",
        }}
      />
    </div>
  );
};

export default Page;
