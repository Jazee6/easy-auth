import { Card, CardContent } from "@/components/ui/card";
import LoginForm from "@/components/form/login-form";
import Link from "next/link";
import Footer from "@/components/footer";

const Page = () => {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">Login</h1>
                  </div>
                  <LoginForm />

                  <div className="text-center text-sm">
                    Don't have an account?{" "}
                    <Link
                      href="/signup"
                      className="underline underline-offset-4"
                    >
                      Sign up
                    </Link>
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

export default Page;
