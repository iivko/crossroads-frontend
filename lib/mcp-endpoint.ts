export function mcpEndpoint(value: string, allowLanHttp: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete backend URL ending in /api/v1.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/api/v1"
  )
    throw new Error(
      "Use an HTTP(S) /api/v1 URL without credentials, query or fragment.",
    );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const octets = url.hostname.split(".").map(Number);
  const privateIpv4 =
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) &&
    octets.every((value) => value >= 0 && value <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
      (octets[0] === 192 && octets[1] === 168));
  const lanHttp = url.protocol === "http:" && !loopback;
  if (lanHttp && !privateIpv4)
    throw new Error(
      "Use HTTPS, or a private LAN IPv4 address for a trusted local demo.",
    );
  if (lanHttp && !allowLanHttp)
    throw new Error(
      "Enable trusted LAN HTTP below to use this local demo address.",
    );
  return { url: `${url.origin}/api/v1`, lanHttp };
}
