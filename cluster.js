import cluster from "node:cluster";
import { WORKER_COUNT } from "./constants.js";
import { makeEventHandler } from "./event.handler.js";
import { eventTcpServer } from "./server/tcp.js";

export const runInCluster = async (session, clickEvent, port) => {
  if (cluster.isPrimary) {
    const workers = [];

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = cluster.fork();
      workers.push(worker);
    }

    return workers.map((w) =>
      w.on("message", (msg) => {
        switch (msg.type) {
          case "fetchEvents":
            clickEvent.mergeEvents(new Map(msg.events));
            break;
          case "fetchRateRecords":
            clickEvent.mergeRateRecords(msg.records);
            break;
          case "pass":
            const targetWorker = workers[msg.targetWorkerId];
            targetWorker.send(msg);
            break;
          default:
            console.warn("unknown message", msg);
        }
      })
    );
  } else {
    const eventHandler = makeEventHandler(clickEvent);
    const server = eventTcpServer(eventHandler);

    cluster.worker.on("disconnect", () => server.close());
    cluster.worker.on("message", (msg) => {
      switch (msg.type) {
        case "sessionUpdate":
          session.add(msg.userId);
          break;
        case "fetchEvents":
          process.send({
            type: "fetchEvents",
            events: Array.from(clickEvent.clickEvent),
          });
          break;
        case "fetchRateRecords":
          process.send({
            type: "fetchRateRecords",
            records: clickEvent.rateLimiter.records,
          });
          break;
        case "pass":
          eventHandler(msg.socket, msg.userId, msg.currentTime);
          break;
        default:
          console.warn("unknown message", msg);
      }
    });

    server.listen(port);
  }
};
