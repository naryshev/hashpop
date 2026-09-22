import { describe, expect, it } from "vitest";
import { HASHPOP_WALLET_ICON, buildHashpackDappMetadata } from "../hashpackDappMetadata";
import {
  HASHPACK_NICKNAME_REQUIRED_MESSAGE,
  classifyDesktopConnectTimeout,
  isHashPackExtensionAnnounce,
} from "../hashpackSessionAlias";

describe("buildHashpackDappMetadata", () => {
  it("uses a data-uri icon HashPack's extension CSP can load", () => {
    const metadata = buildHashpackDappMetadata("https://hashpop.io");
    expect(metadata.name).toBe("Hashpop");
    expect(metadata.url).toBe("https://hashpop.io");
    expect(metadata.icons).toEqual([HASHPOP_WALLET_ICON]);
    expect(metadata.icons[0].startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(metadata.icons[0].includes("hashpop.io")).toBe(false);
    const svg = Buffer.from(metadata.icons[0].split(",")[1] ?? "", "base64").toString("utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.includes("</svg>")).toBe(true);
  });
});

describe("classifyDesktopConnectTimeout", () => {
  it("treats a silent desktop timeout as not installed", () => {
    expect(classifyDesktopConnectTimeout(false)).toBe("not-detected");
  });

  it("treats an extension that answered as an approval failure", () => {
    expect(classifyDesktopConnectTimeout(true)).toBe("nickname-required");
  });
});

describe("isHashPackExtensionAnnounce", () => {
  it("recognizes HashConnect and Hedera extension replies", () => {
    expect(isHashPackExtensionAnnounce({ type: "hashconnect-query-extension-response" })).toBe(
      true,
    );
    expect(isHashPackExtensionAnnounce({ type: "hedera-extension-response", metadata: {} })).toBe(
      true,
    );
  });

  it("ignores unrelated messages", () => {
    expect(isHashPackExtensionAnnounce(null)).toBe(false);
    expect(isHashPackExtensionAnnounce({ type: "hashconnect-connect-extension" })).toBe(false);
    expect(isHashPackExtensionAnnounce("hashconnect-query-extension-response")).toBe(false);
  });
});

describe("HASHPACK_NICKNAME_REQUIRED_MESSAGE", () => {
  it("tells the user to set a wallet nickname and retry", () => {
    expect(HASHPACK_NICKNAME_REQUIRED_MESSAGE.toLowerCase()).toContain("nickname");
    expect(HASHPACK_NICKNAME_REQUIRED_MESSAGE.toLowerCase()).not.toContain("wc:");
  });
});
