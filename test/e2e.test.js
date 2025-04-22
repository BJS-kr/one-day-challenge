import { describe, it, before, after } from "node:test";
import { equal, ok } from "node:assert/strict";
import { ClickEvent } from "../click.event.js";
import { RateLimiter } from "../rate.limiter.js";
import { MICRO, PORT_HTTP, PORT_TCP } from "../constants.js";
import { eventHttpServer } from "../server/http.js";
import path from "node:path";
import cluster from "node:cluster";
import { intToBuf, toMicro, wait } from "../util.js";
import net from "node:net";
import { runInCluster } from "../cluster.js";

const session = new Set();
const httpHost = `http://localhost:${PORT_HTTP}`;
const rateLimiter = new RateLimiter(
  MICRO, // event spec: time unit microsecond
  1, // event spec: limit window 1
  4, // event spec: tolerance 4
  10 // event spec: idle duration 10
);
const clickEvent = new ClickEvent(
  session,
  rateLimiter,
  toMicro(process.hrtime()), // event start
  60 * MICRO // event duration
);

if (cluster.isPrimary)
  describe("😎 E2E", async () => {
    let uid1 = null;
    let uid2 = null;
    let uid3 = null;
    let workers = [];

    const httpServer = eventHttpServer(session);

    before(async () => {
      httpServer.listen(PORT_HTTP);
      workers = await runInCluster(null, clickEvent, null);
      await wait(1000);
    });

    it("should sign up", async () => {
      const signup = path.join(httpHost, "signup");
      const res = await fetch(signup, {
        method: "POST",
        body: JSON.stringify({ email: "t@test.co", address: "addr1" }),
      });

      const res2 = await fetch(signup, {
        method: "POST",
        body: JSON.stringify({ email: "t2@test.co", address: "addr2" }),
      });

      const res3 = await fetch(signup, {
        method: "POST",
        body: JSON.stringify({ email: "t3@test.co", address: "addr3" }),
      });

      equal(res.status, 201);
      equal(res2.status, 201);
      equal(res3.status, 201);
    });

    it("should sign in", async () => {
      const signin = path.join(httpHost, "signin");
      const responses = await Promise.all([
        fetch(path.join(signin, "t@test.co")),
        fetch(path.join(signin, "t2@test.co")),
        fetch(path.join(signin, "t3@test.co")),
      ]);

      responses.forEach((r) => equal(r.status, 200));

      [uid1, uid2, uid3] = await Promise.all(
        responses.map((r) => r.text().then(Number))
      );
    });

    it("should send event request", { timeout: 70 * 1000 }, async () => {
      // wait for workers to launch
      const buf1 = intToBuf(uid1);
      const buf2 = intToBuf(uid2);
      const buf3 = intToBuf(uid3);
      const sock = net.connect({ host: "::", port: PORT_TCP });
      const sock2 = net.connect({ host: "::", port: PORT_TCP });
      const sock3 = net.connect({ host: "::", port: PORT_TCP });
      sock.on("error", console.error);
      sock2.on("error", console.error);
      sock3.on("error", console.error);

      for (let i = 0; i < 170; i++) {
        sock.write(buf1);

        if (i < 120) sock2.write(buf2);
        if (i < 80) sock3.write(buf3);

        await wait(300);
      }

      ok(true);
    });

    it("should be able to fetch winner information to print out", async () => {
      workers.forEach((w) => w.send({ type: "fetchEvents" }));
      workers.forEach((w) => w.send({ type: "fetchRateRecords" }));
      // maybe queueMicrotask more suitable
      // but immediate micro-tasking likely throw error because asynchronous activity did not cleaned up yet before test ends
      // instead of add more codes to wait resources, just waiting in microtask queue would be easy
      await wait(1000);
      // example output: Map(3) { 1 => 115, 2 => 60, 3 => 80 }
      // result would vary by computational power or network
      console.log(clickEvent.clickEvent);
      const winner = clickEvent.getWinner();
      equal(winner, 1);

      const user = await fetch(
        path.join(httpHost, "user", String(winner))
      ).then((r) => r.json());

      console.log(user.email, user.address, clickEvent.clickEvent.get(winner));

      equal(user.id, winner);
      equal(user.email, "t@test.co");
      equal(user.address, "addr1");
    });

    after(async () => {
      httpServer.close();
      workers && workers.forEach((w) => w.disconnect());
    });
  });
else {
  runInCluster(session, clickEvent, PORT_TCP);
}
