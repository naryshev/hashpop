import { afterEach, describe, expect, it } from "vitest";
import { addToCart, cartIds, clearCart } from "../cart";

describe("cart unique listings", () => {
  afterEach(() => {
    clearCart();
  });

  it("counts unique listing ids, not quantity", () => {
    addToCart("lst-1");
    addToCart("lst-1");
    addToCart("lst-2");
    expect(cartIds()).toEqual(["lst-1", "lst-2"]);
  });
});
