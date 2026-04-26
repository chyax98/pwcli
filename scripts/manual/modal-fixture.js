import http from "node:http";

const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`
    <!doctype html>
    <html>
      <body>
        <button id="open-alert" onclick="alert('pwcli-modal')">Open alert</button>
      </body>
    </html>
  `);
});

server.listen(4124, "127.0.0.1", () => {
  console.log("http://127.0.0.1:4124");
});
