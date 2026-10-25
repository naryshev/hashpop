import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchPublicListing, notFoundSpy, clientSpy } = vi.hoisted(() => ({
  fetchPublicListing: vi.fn(),
  notFoundSpy: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  clientSpy: vi.fn((props: { initialListing: unknown; initialOutcome: string }) =>
    createElement("div", {
      "data-outcome": props.initialOutcome,
      "data-has-listing": props.initialListing ? "yes" : "no",
    }),
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundSpy(),
}));

vi.mock("./listing-page-client", () => ({
  default: clientSpy,
}));

vi.mock("../../../lib/seo/fetchListing", () => ({
  fetchPublicListing: (...args: unknown[]) => fetchPublicListing(...args),
}));

import ListingPage, { generateMetadata } from "./page";

function findClient(node: ReactNode): ReactElement | null {
  if (!isValidElement(node)) return null;
  if (node.type === clientSpy) return node;
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findClient(child);
      if (found) return found;
    }
    return null;
  }
  return children ? findClient(children) : null;
}

const found = {
  status: "ok" as const,
  listing: {
    id: "0x6c73742d31000000000000000000000000000000000000000000000000000000",
    title: "Vintage Camera",
    description: "Rangefinder",
    price: "84",
    status: "LISTED",
  },
};

describe("listing page HTTP outcome", () => {
  beforeEach(() => {
    fetchPublicListing.mockReset();
    notFoundSpy.mockClear();
    clientSpy.mockClear();
  });

  it("calls notFound when the backend says the listing does not exist", async () => {
    fetchPublicListing.mockResolvedValue({ status: "not_found" });
    // generateMetadata must not throw. A second notFound() there drops the
    // friendly 404 markup and leaves only the error digest.
    const meta = await generateMetadata({ params: { id: "missing" } });
    expect(meta.robots).toMatchObject({ index: false });
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(
      meta.openGraph && "url" in meta.openGraph ? meta.openGraph.url : undefined,
    ).toBeUndefined();
    await expect(ListingPage({ params: { id: "missing" } })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(clientSpy).not.toHaveBeenCalled();
  });

  it("does not 404 a transient failure and withholds a self-canonical", async () => {
    fetchPublicListing.mockResolvedValue({ status: "unavailable" });
    const meta = await generateMetadata({ params: { id: "lst-1" } });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(
      meta.openGraph && "url" in meta.openGraph ? meta.openGraph.url : undefined,
    ).toBeUndefined();
    const page = await ListingPage({ params: { id: "lst-1" } });
    expect(findClient(page)?.props).toMatchObject({
      initialListing: null,
      initialOutcome: "unavailable",
    });
  });

  it("keeps a real listing indexable with its canonical", async () => {
    fetchPublicListing.mockResolvedValue(found);
    const meta = await generateMetadata({ params: { id: "lst-1" } });
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/listing/lst-1");
    expect(meta.robots).toBeUndefined();
    const page = await ListingPage({ params: { id: "lst-1" } });
    expect(findClient(page)?.props).toMatchObject({
      initialOutcome: "ready",
      initialListing: found.listing,
    });
  });
});
