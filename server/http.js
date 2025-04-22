import http from "node:http";
import { db, init } from "../db/db.js";
import cluster from "node:cluster";

const textType = { "Content-Type": "text/plain" };

export const eventHttpServer = () =>
  http
    .createServer((req, res) => {
      const segments = req.url.split("/");

      if (req.method === "POST" && segments[1] === "signup") {
        let body = "";

        req
          .on("data", (chunk) => {
            body += chunk;
          })
          .on("end", () => {
            const { email, address } = JSON.parse(body);

            if (!email) {
              res.writeHead(400, textType);
              return res.end("provide email");
            }

            db.prepare("INSERT INTO users (email, address) VALUES (?, ?)").run(
              email,
              address
            );

            res.writeHead(201, textType);
            res.end("OK");
          });
      } else if (req.method === "GET" && segments[1] === "signin") {
        const email = segments[2];

        if (!email) {
          res.writeHead(400, textType);
          return res.end("provide email");
        }

        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(email);

        if (!user) {
          res.writeHead(400, textType);
          return res.end("user not found");
        }

        Object.values(cluster.workers).forEach((w) =>
          w.send({ type: "sessionUpdate", userId: user.id })
        );

        res.writeHead(200, textType);
        res.end(String(user.id));
      } else if (req.method === "GET" && segments[1] === "user") {
        const userId = segments[2];

        if (!userId) {
          res.writeHead(400, textType);
          return res.end("provide userId");
        }

        const user = db
          .prepare("SELECT * FROM users WHERE id = ?")
          .get(Number(userId));

        if (!user) {
          res.writeHead(400, textType);
          return res.end("user not found");
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(user));
      } else {
        res.writeHead(404, textType);
        res.end("not found");
      }
    })
    .on("listening", () => {
      init();
    });
