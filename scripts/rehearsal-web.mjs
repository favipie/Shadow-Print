// Local HTTPS harness for the production Next build. Never binds a public interface.
import https from "node:https";
import fs from "node:fs";
import next from "next";
const port = Number(process.env.REHEARSAL_WEB_PORT);
const app = next({ dev: false, hostname: "127.0.0.1", port });
await app.prepare();
const handler = app.getRequestHandler();
https
  .createServer(
    {
      cert: fs.readFileSync(process.env.REHEARSAL_CERT),
      key: fs.readFileSync(process.env.REHEARSAL_KEY),
    },
    (req, res) => {
      // The TLS terminator sets this itself; never preserve a client assertion.
      req.headers["x-forwarded-proto"] = req.socket.encrypted
        ? "https"
        : "http";
      return handler(req, res);
    },
  )
  .listen(port, "127.0.0.1");
