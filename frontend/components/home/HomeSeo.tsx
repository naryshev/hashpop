import {
  HOME_CTA,
  HOME_LEDE,
  HOME_SECTION_LABEL,
  HOME_SECTIONS,
  type HomeRun,
} from "../../content/home";
import { material } from "../../lib/materials";
import { HOMEPAGE_SEO } from "../../lib/seo/homepage";

/**
 * Server-rendered homepage copy. No client JS: the mobile "More" control is
 * a native <details> element, and the full lede stays in the DOM.
 */

function HomeRunText({ run }: { run: HomeRun }) {
  if (run.kind === "link") {
    return (
      <a href={run.href} className="text-chrome underline-offset-2 hover:underline">
        {run.text}
      </a>
    );
  }
  if (run.kind === "strong") {
    return <strong className="font-semibold text-white">{run.text}</strong>;
  }
  return run.text;
}

export function HomeIntro() {
  return (
    <div data-testid="home-intro" className="home-intro mb-3 md:mb-4">
      <h1 className="font-display text-[22px] font-semibold leading-[28px] tracking-normal text-white md:text-[34px] md:leading-[41px]">
        {HOMEPAGE_SEO.h1}
      </h1>
      <p className="lede home-lede mt-1 font-sans text-[15px] font-normal leading-5 text-white/70">
        {HOME_LEDE}
      </p>
      <details className="md:hidden">
        <summary className="mt-1 cursor-pointer list-none font-sans text-[15px] font-medium leading-5 text-chrome [&::-webkit-details-marker]:hidden">
          <span className="home-more-label">More</span>
          <span className="home-less-label">Less</span>
        </summary>
      </details>
    </div>
  );
}

export function HomeAbout() {
  return (
    <section data-testid="home-about" aria-label={HOME_SECTION_LABEL} className="mt-8 md:mt-12">
      <p className="mb-3 font-display text-[15px] font-semibold leading-5 tracking-normal text-white">
        {HOME_SECTION_LABEL}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {HOME_SECTIONS.map((section) => (
          <article key={section.id} className={`${material.regular} rounded-glass-lg p-4 md:p-5`}>
            <h2 className="font-display text-[20px] font-semibold leading-[26px] tracking-normal text-white">
              {section.title}
            </h2>
            {section.paragraphs?.map((paragraph, index) => (
              <p
                key={index}
                className="mt-2 font-sans text-[15px] font-normal leading-[22px] text-white/70"
              >
                {paragraph.map((run, runIndex) => (
                  <HomeRunText key={runIndex} run={run} />
                ))}
              </p>
            ))}
            {section.steps ? (
              <ol className="mt-3 list-none space-y-3 p-0">
                {section.steps.map((step, index) => (
                  <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                    <span className="font-mono text-[15px] font-medium leading-[22px] text-chrome">
                      {index + 1}
                    </span>
                    <p className="font-sans text-[15px] font-normal leading-[22px] text-white/70">
                      {step.map((run, runIndex) => (
                        <HomeRunText key={runIndex} run={run} />
                      ))}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-5">
        <a
          href={HOME_CTA.href}
          className="cta btn-mint inline-flex h-11 items-center rounded-full px-5 text-[15px] font-semibold"
        >
          {HOME_CTA.label}
        </a>
      </p>
    </section>
  );
}
