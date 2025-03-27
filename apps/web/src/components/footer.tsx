import { version } from "../../package.json";
import { cn } from "@/lib/utils.ts";

const Footer = ({ classname }: { classname?: string }) => {
  return (
    <footer
      className={cn(
        classname,
        "text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4",
      )}
    >
      {version} | Star on{" "}
      <a href="https://github.com/Jazee6/easy-auth" target="_blank">
        Github
      </a>
    </footer>
  );
};

export default Footer;
