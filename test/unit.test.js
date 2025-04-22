import { describe, it } from "node:test";
import { equal } from "node:assert/strict";
import { ClickEvent } from "../click.event.js";
import { RateLimiter } from "../rate.limiter.js";

describe("unit tests of event rules", () => {
  describe("👪 session cases", () => {
    // initialize with empty session
    const session = new Set();
    const clickEvent = new ClickEvent(
      session,
      new RateLimiter(0, 0, 0, 0),
      0,
      10
    );
    const currentTime = 5;

    it("should not accept event request if user NOT in session", () => {
      equal(clickEvent.isValid(1, currentTime), false);
    });

    it("should accept event request if user in session", () => {
      session.add(1);
      equal(clickEvent.isValid(1, currentTime), true);
    });
  });

  describe("⏰ event duration cases", () => {
    const eventDuration = 10;
    const clickEvent = new ClickEvent(
      new Set([1]),
      new RateLimiter(0, 0, 0, 0),
      0, // event start time
      eventDuration
    );

    it("should be valid if in time between event start and end", () => {
      const currentTime = 5;
      equal(clickEvent.isValid(1, currentTime), true);
    });

    it("should not be valid if not in time between event start and end", () => {
      const currentTime = eventDuration + 1;
      equal(clickEvent.isValid(1, currentTime), false);
    });
  });

  describe("🚨 request rate cases", () => {
    const rateLimiter = new RateLimiter(
      1, // time unit
      3, // limit window
      2, // tolerance
      100 // idleDuration
    );
    const clickEvent = new ClickEvent(new Set([1]), rateLimiter, 0, 10);
    const currentTime = 5;
    rateLimiter.addEntry(1, currentTime);

    it("should accept event request if not rate limited", () => {
      equal(clickEvent.isRateValid(1, currentTime), true);
    });

    it("should not accept event request if rate limited", () => {
      // add record to exceed the tolerance
      rateLimiter.addRecord(1, 6);
      rateLimiter.addRecord(1, 6);

      equal(clickEvent.isRateValid(1, 6), false);
    });
  });

  describe("😡 participation case", () => {
    it("should not be able to participate again after disqualification", () => {
      const zeroTolerance = new RateLimiter(0, 0, 0, 0);
      const clickEvent = new ClickEvent(new Set([1]), zeroTolerance, 0, 10);

      clickEvent.participate(1, 5);
      clickEvent.increaseCount(1, 5);

      if (!clickEvent.isRateValid(1, 5)) clickEvent.ban(1);

      equal(clickEvent.isBanned(1), true);
      clickEvent.participate(1, 6);
      equal(clickEvent.isBanned(1), true);
    });
  });

  describe("🏆 winner cases", () => {
    const rateLimiter = new RateLimiter(1, 10, 10, 10);
    const clickEvent = new ClickEvent(new Set([1]), rateLimiter, 0, 10);

    it("should return NULL if there is no winner", () => {
      equal(clickEvent.getWinner(), null);

      clickEvent.participate(1, 5);
      clickEvent.ban(1);

      equal(clickEvent.getWinner(), null);
    });

    it("should return sole winner", () => {
      clickEvent.participate(2, 5);
      clickEvent.participate(3, 7);
      clickEvent.increaseCount(2, 6);

      equal(clickEvent.getWinner(), 2);
    });
    it("should return sole winner even if there are same clicks", () => {
      const rateLimiter = new RateLimiter(1, 10, 10, 10);
      const clickEvent = new ClickEvent(new Set([1]), rateLimiter, 0, 10);

      clickEvent.participate(2, 5);
      clickEvent.participate(3, 5);
      clickEvent.increaseCount(2, 6);
      // user3 reached same clicks later
      clickEvent.increaseCount(3, 7);

      equal(clickEvent.getWinner(), 2);
    });
  });
});
