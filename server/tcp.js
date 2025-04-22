import net from "node:net";
import { toMicro } from "../util.js";
import { WORKER_COUNT } from "../constants.js";
import cluster from "node:cluster";

export const eventTcpServer = (eventHandler) => {
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (data) => {
      buf = Buffer.concat([buf, data]);

      if (Buffer.byteLength(buf) < 4) return;

      const userId = data.readUInt32BE();
      const currentTime = toMicro(process.hrtime());

      buf = buf.subarray(4);
      const targetWorkerId = userId % WORKER_COUNT;

      if (targetWorkerId !== cluster.worker.id) {
        return process.send({
          type: "pass",
          targetWorkerId,
          socket,
          userId,
          currentTime,
        });
      }

      eventHandler(socket, userId, currentTime);
    });
  });

  server.on("listening", () => {
    console.log("tcp server running in worker", server.address());
  });

  return server;
};
