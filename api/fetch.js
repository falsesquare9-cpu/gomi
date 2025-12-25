const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

const isPrivateIp = (hostname) => {
  if (!hostname) return true;
  if (BLOCKED_HOSTS.includes(hostname)) return true;
  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("169.254.")) return true;
  if (hostname.startsWith("172.")) {
    const parts = hostname.split(".");
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
};

export default async function handler(req, res) {
  try {
    const target = req.query.url;
    const method = (req.query.method || "GET").toUpperCase();
    if (!target) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const parsed = new URL(target);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res.status(400).json({ error: "invalid protocol" });
      return;
    }
    if (isPrivateIp(parsed.hostname)) {
      res.status(400).json({ error: "blocked host" });
      return;
    }
    if (!["GET", "HEAD"].includes(method)) {
      res.status(405).json({ error: "method not allowed" });
      return;
    }

    const upstream = await fetch(parsed.toString(), { method });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(upstream.status);

    const passthroughHeaders = [
      "content-type",
      "content-length",
      "last-modified",
      "etag",
      "cache-control",
    ];
    passthroughHeaders.forEach((header) => {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    if (method === "HEAD") {
      res.end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "proxy failure" });
  }
}
