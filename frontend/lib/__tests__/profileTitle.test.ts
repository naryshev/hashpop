import { describe, expect, it } from "vitest";
import { profileCustomName, profileHeaderTitle } from "../profileTitle";

const EVM = "0xabc0000000000000000000000000000000000001";

describe("profileHeaderTitle", () => {
  it("uses the .h name with the display face", () => {
    expect(
      profileHeaderTitle({
        hashpackName: "wunno.h",
        accountId: "0.0.9690555",
        address: EVM,
      }),
    ).toEqual({ text: "wunno.h", kind: "name" });
  });

  it("falls back to the Hedera account id", () => {
    expect(
      profileHeaderTitle({ hashpackName: "  ", accountId: "0.0.9690555", address: EVM }),
    ).toEqual({ text: "0.0.9690555", kind: "address" });
  });

  it("uses a route account id when the wallet id is missing", () => {
    expect(profileHeaderTitle({ address: "0.0.1234" })).toEqual({
      text: "0.0.1234",
      kind: "address",
    });
  });

  it("truncates an EVM address when that is all there is", () => {
    expect(profileHeaderTitle({ address: EVM })).toEqual({
      text: "0xabc0…0001",
      kind: "address",
    });
  });
});

describe("profileCustomName", () => {
  it("keeps a custom name that differs from the .h name", () => {
    expect(profileCustomName({ displayName: "Admin", hashpackName: "wunno.h" })).toBe("Admin");
  });

  it("omits an empty name and a name that repeats the .h name", () => {
    expect(profileCustomName({ displayName: "  ", hashpackName: "wunno.h" })).toBeNull();
    expect(profileCustomName({ displayName: "Wunno.h", hashpackName: "wunno.h" })).toBeNull();
  });
});
