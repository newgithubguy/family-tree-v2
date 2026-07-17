import http from "node:http";
import { parse } from "node:url";
import { EventEmitter } from "node:events";
import next from "next";
import { WebSocketServer } from "ws";

const dev = process.argv.includes("--dev");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const wsPort = Number(process.env.WS_PORT || 3001);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getBus() {
  if (!globalThis.__familyTreeRealtimeBus) {
    globalThis.__familyTreeRealtimeBus = new EventEmitter();
  }
  return globalThis.__familyTreeRealtimeBus;
}

await app.prepare();
const nextUpgradeHandler = app.getUpgradeHandler();

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || "", true);
  handle(req, res, parsedUrl);
});

server.on("upgrade", (request, socket, head) => {
  nextUpgradeHandler(request, socket, head);
});

const wsHttpServer = http.createServer();
const wss = new WebSocketServer({ server: wsHttpServer, path: "/ws" });

wss.on("connection", (socket, request) => {
  const parsedUrl = parse(request.url || "", true);
  const treeId = typeof parsedUrl.query.treeId === "string" ? parsedUrl.query.treeId : "tree-main";

  const listener = (event) => {
    if (event.treeId !== treeId) {
      return;
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  };

  getBus().on("tree-event", listener);
  socket.on("close", () => getBus().off("tree-event", listener));
});

server.listen(port, hostname, () => {
  const mode = dev ? "development" : "production";
  console.log(`Family Tree server (${mode}) listening on http://localhost:${port}`);
});

wsHttpServer.listen(wsPort, hostname, () => {
  console.log(`Family Tree realtime websocket listening on ws://localhost:${wsPort}/ws`);
});
