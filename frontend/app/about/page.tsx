import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Lock, MapPin, MessageCircle, Shield, type LucideIcon } from "lucide-react";
import { ABOUT_PAGE, aboutFaqPageJsonLd, publishedAboutFaqs } from "../../lib/content/about";
import { serializeJsonLd } from "../../lib/seo/jsonld";
import { staticPageMetadata } from "../../lib/seo/metadata";

export const metadata: Metadata = staticPageMetadata({
  title: ABOUT_PAGE.title,
  description: ABOUT_PAGE.description,
  path: "/about",
});

const PILLAR_ICONS: Record<(typeof ABOUT_PAGE.pillars)[number]["icon"], LucideIcon> = {
  shield: Shield,
  chat: MessageCircle,
  lock: Lock,
  pin: MapPin,
};

export default function AboutPage() {
  const faqs = publishedAboutFaqs();
  return (
    <article className="mx-auto w-full max-w-[680px] px-4 pb-8 pt-2 md:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutFaqPageJsonLd()) }}
      />

      <header className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-40 w-[min(100%,520px)] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(520px 180px at 50% 30%, rgba(0, 255, 163, 0.15), transparent 58%)",
          }}
        />
        <h1 className="relative font-display text-[28px] font-semibold leading-[34px] tracking-normal text-white md:text-[34px] md:leading-[41px]">
          {ABOUT_PAGE.h1}
        </h1>
        <p className="relative mt-3 font-sans text-[12px] leading-4 text-white/50">
          {ABOUT_PAGE.byline}
          <span aria-hidden> · </span>
          {ABOUT_PAGE.updated}
        </p>
        <p className="relative mt-4 font-sans text-[17px] font-normal leading-[26px] text-white/70">
          {ABOUT_PAGE.lede}
        </p>
      </header>

      <section className="mt-12">
        <h2 className="font-sans text-[22px] font-semibold leading-7 tracking-normal text-white">
          {ABOUT_PAGE.whyHeading}
        </h2>
        <div className="mt-4 space-y-4 font-sans text-[16px] leading-[26px] text-white/85">
          {ABOUT_PAGE.why.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-sans text-[22px] font-semibold leading-7 tracking-normal text-white">
          {ABOUT_PAGE.pillarsHeading}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ABOUT_PAGE.pillars.map((pillar) => {
            const Icon = PILLAR_ICONS[pillar.icon];
            return (
              <li key={pillar.id} className="glass-card p-4">
                <Icon className="text-[#00ffa3]" size={22} strokeWidth={1.75} aria-hidden />
                <p className="mt-3 font-sans text-[15px] font-normal leading-[22px] text-white/80">
                  <strong className="font-semibold text-white">{pillar.lead}</strong> {pillar.body}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-sans text-[22px] font-semibold leading-7 tracking-normal text-white">
          {ABOUT_PAGE.faqHeading}
        </h2>
        <div className="glass-card mt-4 divide-y divide-white/10">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0} className="group px-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="font-sans text-[17px] font-semibold leading-6 text-white">
                  {faq.question}
                </span>
                <ChevronDown
                  aria-hidden
                  size={18}
                  className="shrink-0 text-[#00ffa3] transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 font-sans text-[15px] leading-[22px] text-white/75">
                {faq.spans.map((span, spanIndex) =>
                  span.type === "link" ? (
                    <Link key={spanIndex} href={span.href} className="text-chrome hover:text-white">
                      {span.text}
                    </Link>
                  ) : (
                    <span key={spanIndex}>{span.text}</span>
                  ),
                )}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-12 font-sans text-[12px] leading-5 text-silver">{ABOUT_PAGE.finePrint}</p>
      <p className="mt-6">
        <Link
          href={ABOUT_PAGE.cta.href}
          className="btn-mint inline-flex h-11 items-center rounded-full px-6 text-[15px]"
        >
          {ABOUT_PAGE.cta.label}
        </Link>
      </p>
    </article>
  );
}
