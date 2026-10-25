import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQS } from "../../../lib/help/faqs";
import { faqPageJsonLd } from "../../../lib/seo/jsonld";
import HelpCenter from "../help-center";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

describe("help center answers", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("puts every answer in the document before any click", () => {
    act(() => {
      root.render(createElement(HelpCenter, { faqs: FAQS }));
    });
    const answers = FAQS.flatMap((group) => group.items.map((item) => item.a));
    for (const answer of answers) {
      expect(container.textContent).toContain(answer);
    }
    const openDetails = container.querySelectorAll("details[open]");
    expect(openDetails.length).toBe(0);
    expect(container.querySelectorAll("details").length).toBe(answers.length);
    const faq = faqPageJsonLd(FAQS);
    expect(faq.mainEntity.map((item) => item.acceptedAnswer.text)).toEqual(answers);
  });
});
