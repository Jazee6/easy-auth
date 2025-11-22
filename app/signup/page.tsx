import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import SignupForm from "@/app/signup/signup-form";
import { LogIn } from "lucide-react";
import Link from "next/link";
import Footer from "@/components/footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - Easy Auth",
  description: "Create an account on Easy Auth",
};

const Page = () => {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          href="https://github.com/Jazee6/easy-auth"
          target="_blank"
          className="flex items-center gap-2 self-center font-medium"
          rel="noopener"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <LogIn className="size-4" />
          </div>
          Easy Auth
        </a>
        <div className={"flex flex-col gap-6"}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Sign up</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <SignupForm />

              <div className="text-center text-sm mt-4">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Login
                </Link>
              </div>
            </CardContent>
          </Card>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Page;
