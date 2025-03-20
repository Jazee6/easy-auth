import { version } from "../../package.json";

const Footer = () => {
  return (
    <footer className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
      {version} | Star on{" "}
      <a href="https://github.com/Jazee6/easy-auth" target="_blank">
        Github
      </a>
    </footer>
  );
};

export default Footer;
