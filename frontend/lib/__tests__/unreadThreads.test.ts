import { afterEach, describe, expect, it } from "vitest";
import {
  countUnreadThreads,
  markThreadRead,
  readLastReadMap,
  threadKey,
  THREADS_READ_KEY,
} from "../unreadThreads";

const me = "0xabc";
const other = "0xdef";

function thread(
  otherAddress: string,
  from: string,
  createdAt: string,
  listingId: string | null = "lst-1",
) {
  return {
    otherAddress,
    listingId,
    lastMessage: { fromAddress: from, createdAt },
  };
}

describe("countUnreadThreads", () => {
  it("counts distinct threads with an inbound last message, not message volume", () => {
    const conversations = [
      thread(other, other, "2026-09-01T12:00:00.000Z", "lst-1"),
      thread("0xaaa", "0xaaa", "2026-09-01T13:00:00.000Z", "lst-2"),
      thread("0xbbb", me, "2026-09-01T14:00:00.000Z", "lst-3"),
    ];
    expect(countUnreadThreads(conversations, me)).toBe(2);
  });

  it("does not count a thread once it has been read after the last inbound", () => {
    const conversations = [thread(other, other, "2026-09-01T12:00:00.000Z")];
    const lastRead = {
      [threadKey(other, "lst-1")]: new Date("2026-09-01T12:00:01.000Z").getTime(),
    };
    expect(countUnreadThreads(conversations, me, lastRead)).toBe(0);
  });

  it("still counts a thread if a newer inbound arrived after last-read", () => {
    const conversations = [thread(other, other, "2026-09-01T13:00:00.000Z")];
    const lastRead = {
      [threadKey(other, "lst-1")]: new Date("2026-09-01T12:00:00.000Z").getTime(),
    };
    expect(countUnreadThreads(conversations, me, lastRead)).toBe(1);
  });
});

describe("markThreadRead", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("persists last-read per thread key", () => {
    markThreadRead(other, "lst-1");
    const map = readLastReadMap();
    expect(map[threadKey(other, "lst-1")]).toBeGreaterThan(0);
    expect(window.localStorage.getItem(THREADS_READ_KEY)).toBeTruthy();
  });
});
