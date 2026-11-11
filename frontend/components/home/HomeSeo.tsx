import {
  HOME_LEDE,
  HOME_SECTION_LABEL,
  HOME_SECTIONS,
  type HomeRun,
} from "../../content/home";
import { material } from "../../lib/materials";
import { HOMEPAGE_SEO } from "../../lib/seo/homepage";

/**
 * Server-rendered Hashpop intro copy. No client JS.
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

/**
 * Homepage H1. The home page shows only the marketplace (filters + grid), so
 * the heading is visually hidden but stays in the server HTML for SEO and
 * screen readers. The visible intro and About cards live on /about.
 */
export function HomeMarketplaceHeading() {
  return (
    <h1 data-testid="home-h1" className="sr-only">
      {HOMEPAGE_SEO.h1}
    </h1>
  );
}

/**
 * The "About Hashpop" block (lede plus the three cards). Rendered on /about,
 * no longer on the home page. Single-column to fit the /about reading width.
 */
export function HomeAbout() {
  return (
    <section data-testid="home-about" className="mt-12">
      <h2 className="font-sans text-[22px] font-semibold leading-7 tracking-normal text-white">
        {HOME_SECTION_LABEL}
      </h2>
      <p className="mt-4 font-sans text-[16px] font-normal leading-[26px] text-white/85">
        {HOME_LEDE}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {HOME_SECTIONS.map((section) => (
          <article key={section.id} className={`${material.regular} rounded-glass-lg p-4 md:p-5`}>
            <h3 className="font-display text-[20px] font-semibold leading-[26px] tracking-normal text-white">
              {section.title}
            </h3>
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
    </section>
  );
}
