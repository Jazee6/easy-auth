import ProfileUpdate from "@/app/(dash)/(admin)/users/profile-update";
import { Metadata } from "next";
import { checkSession } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Profile - Easy Auth",
  description: "Update your profile information on EasyAuth.",
};

const Page = async () => {
  const session = await checkSession();
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
