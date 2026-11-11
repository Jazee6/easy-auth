import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  FingerprintIcon,
  IdCardIcon,
  KeyRoundIcon,
  Link2Icon,
  MonitorSmartphoneIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import { GithubIcon } from "@/components/github-icon";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  OFFICIAL_SITE_URL,
  REPOSITORY_URL,
  landingContent,
  landingHtmlLang,
  landingPaths,
  type FeatureIcon,
  type LandingLocale,
} from "@/lib/landing-content";
import { cn } from "@/lib/utils";

const featureIcons: Record<FeatureIcon, typeof KeyRoundIcon> = {
  key: KeyRoundIcon,
  server: ServerIcon,
  shield: ShieldCheckIcon,
  link: Link2Icon,
  monitor: MonitorSmartphoneIcon,
  users: UsersIcon,
};

// Wide cards alternate sides to form a zig-zag bento grid.
const wideFeatures = new Set([0, 3, 4]);

const discoveryDocument = `{
  "issuer": "${OFFICIAL_SITE_URL}",
  "authorization_endpoint": ".../oauth2/authorize",
  "token_endpoint": ".../oauth2/token",
  "code_challenge_methods_supported": ["S256"],
  "response_types_supported": ["code"]
}`;

const reveal =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 motion-reduce:animate-none";

interface LandingPageProps {
  locale: LandingLocale;
  hasSession: boolean;
}

export function LandingPage({ locale, hasSession }: LandingPageProps) {
  const t = landingContent[locale];
  const otherLocale: LandingLocale = locale === "en" ? "zh" : "en";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            to={landingPaths[locale]}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <IdCardIcon className="size-5" aria-hidden="true" />
            Easy Auth
          </Link>
          <nav
            aria-label={t.nav.primaryLabel}
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          >
            <a href="#features" className="hover:text-foreground">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              {t.nav.howItWorks}
            </a>
            <a href="#faq" className="hover:text-foreground">
              {t.nav.faq}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to={landingPaths[otherLocale]}
              hrefLang={landingHtmlLang[otherLocale]}
              aria-label={t.nav.languageLabel}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t.nav.language}
            </Link>
            <a
              href={REPOSITORY_URL}
              aria-label={t.nav.github}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "max-sm:hidden")}
            >
              <GithubIcon />
            </a>
            <ThemeSwitcher />
            <Link
              to={hasSession ? "/profile" : "/login"}
              className={cn(buttonVariants({ size: "sm" }), "ml-1")}
            >
              {hasSession ? t.nav.account : t.nav.signIn}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)] bg-size-[3.5rem_3.5rem]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 md:py-28 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col items-start gap-6">
              <Badge variant="outline" className={reveal}>
                <span className="size-1.5 rounded-full bg-primary" />
                {t.hero.eyebrow}
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
                {t.hero.title}
                <span className="text-muted-foreground">{t.hero.titleAccent}</span>
              </h1>
              <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
                {t.hero.description}
              </p>
              <div className={cn("flex flex-wrap gap-3", reveal, "delay-300")}>
                <Link
                  to={hasSession ? "/profile" : "/signup"}
                  className={buttonVariants({ size: "lg" })}
                >
                  {hasSession ? t.hero.primarySignedIn : t.hero.primary}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
                <a
                  href={REPOSITORY_URL}
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                >
                  <GithubIcon data-icon="inline-start" />
                  {t.hero.secondary}
                </a>
              </div>
            </div>

            <HeroVisual locale={locale} />
          </div>
        </section>

        <section aria-labelledby="standards-heading" className="border-b">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 md:flex-row md:justify-between">
            <h2
              id="standards-heading"
              className="text-xs font-medium tracking-widest text-muted-foreground uppercase"
            >
              {t.standards.label}
            </h2>
            <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-sm">
              {t.standards.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-14">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-24">
            <SectionHeading
              id="features-heading"
              title={t.features.title}
              description={t.features.description}
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {t.features.items.map((feature, index) => {
                const Icon = featureIcons[feature.icon];
                return (
                  <Card
                    key={feature.title}
                    className={cn(
                      "transition-shadow hover:shadow-md",
                      wideFeatures.has(index) && "lg:col-span-2",
                    )}
                  >
                    <CardHeader className="gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <CardTitle>
                        <h3>{feature.title}</h3>
                      </CardTitle>
                      <CardDescription className="max-w-prose leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    {feature.tags && (
                      <CardFooter className="mt-auto flex-wrap gap-2">
                        {feature.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </CardFooter>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-label={t.statsLabel} className="border-y bg-muted/40">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
            {t.stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse gap-1 border-border px-6 py-10 not-last:border-r max-lg:nth-2:border-r-0 max-lg:nth-[-n+2]:border-b"
              >
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="text-4xl font-semibold tracking-tighter">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how-it-works" aria-labelledby="steps-heading" className="scroll-mt-14">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-24">
            <SectionHeading
              id="steps-heading"
              title={t.steps.title}
              description={t.steps.description}
            />
            <ol className="grid gap-4 lg:grid-cols-3">
              {t.steps.items.map((step, index) => (
                <li key={step.title} className="flex">
                  <Card className="flex-1">
                    <CardHeader className="gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground">
                        {index + 1}
                      </span>
                      <CardTitle>
                        <h3>{step.title}</h3>
                      </CardTitle>
                      <CardDescription className="leading-relaxed">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <pre className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-xs leading-relaxed">
                        <code>{step.code}</code>
                      </pre>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-14 border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_2fr]">
            <h2 id="faq-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl">
              {t.faq.title}
            </h2>
            <Accordion>
              {t.faq.items.map((item) => (
                <AccordionItem key={item.question}>
                  <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
                  {/* hidden="until-found" keeps answers in the HTML for crawlers and find-in-page. */}
                  <AccordionContent hiddenUntilFound>
                    <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="px-6 pb-24">
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-primary px-6 py-20 text-center text-primary-foreground">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_75%)] bg-size-[1.25rem_1.25rem] opacity-15"
            />
            <h2
              id="cta-heading"
              className="relative text-3xl font-semibold tracking-tighter sm:text-5xl"
            >
              {t.cta.title}
            </h2>
            <p className="relative max-w-lg text-primary-foreground/70">{t.cta.description}</p>
            <div className="relative flex flex-wrap justify-center gap-3">
              <Link
                to={hasSession ? "/profile" : "/signup"}
                className={buttonVariants({ size: "lg", variant: "secondary" })}
              >
                {hasSession ? t.hero.primarySignedIn : t.cta.primary}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <a
                href={REPOSITORY_URL}
                className={buttonVariants({ size: "lg", variant: "inverse" })}
              >
                <GithubIcon data-icon="inline-start" />
                {t.cta.secondary}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <IdCardIcon className="size-4" aria-hidden="true" />
              Easy Auth
            </span>
            <p className="text-sm text-muted-foreground">{t.footer.tagline}</p>
          </div>
          <nav
            aria-label={t.footer.label}
            className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground"
          >
            <Link to="/privacy" className="hover:text-foreground">
              {t.footer.privacy}
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              {t.footer.terms}
            </Link>
            <a href={REPOSITORY_URL} className="hover:text-foreground">
              {t.footer.source}
            </a>
            <Separator orientation="vertical" className="h-4" />
            <Link
              to={landingPaths[otherLocale]}
              hrefLang={landingHtmlLang[otherLocale]}
              className="hover:text-foreground"
            >
              {t.nav.language}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h2 id={id} className="text-3xl font-semibold tracking-tighter text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="text-lg text-pretty text-muted-foreground">{description}</p>
    </div>
  );
}

/** Decorative product preview: a consent screen with the OIDC discovery document behind it. */
function HeroVisual({ locale }: { locale: LandingLocale }) {
  const t = landingContent[locale].consent;

  return (
    <div
      aria-hidden="true"
      inert
      className="relative mx-auto w-full max-w-lg sm:pt-16 sm:pr-16 sm:pb-12"
    >
      <Card
        className={cn(
          "absolute top-0 right-0 hidden w-96 rotate-2 bg-muted/60 backdrop-blur sm:flex",
          reveal,
          "delay-500",
        )}
        size="sm"
      >
        <CardContent>
          <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            <code>{discoveryDocument}</code>
          </pre>
        </CardContent>
      </Card>

      <Card className={cn("relative max-w-sm shadow-2xl", reveal, "delay-300")}>
        <CardHeader className="items-center gap-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <span className="h-px w-8 border-t border-dashed border-muted-foreground" />
            <Avatar size="lg">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <IdCardIcon className="size-5" />
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-lg">
            {t.app} <span className="font-normal text-muted-foreground">{t.request}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3 rounded-lg border p-4">
            {t.scopes.map((scope) => (
              <li key={scope} className="flex items-center gap-3">
                <CheckIcon className="size-4 text-muted-foreground" />
                {scope}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="gap-3">
          <span className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>{t.deny}</span>
          <span className={cn(buttonVariants(), "flex-1")}>{t.allow}</span>
        </CardFooter>
      </Card>

      <div
        className={cn(
          "absolute right-0 bottom-0 hidden items-center sm:flex gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-lg ring-1 ring-foreground/10",
          reveal,
          "delay-700",
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <FingerprintIcon className="size-4" />
        </span>
        <span className="flex flex-col">
          <span className="font-medium">Passkey</span>
          <span className="font-mono text-xs text-muted-foreground">WebAuthn · RP verified</span>
        </span>
      </div>
    </div>
  );
}
