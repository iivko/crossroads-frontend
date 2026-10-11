import { expect, test } from "@playwright/test";
import { mcpEndpoint } from "../lib/mcp-endpoint";

test("loopback and HTTPS configuration never enable LAN HTTP", () => {
  for (const url of [
    "http://127.0.0.1:8100/api/v1",
    "http://localhost:8100/api/v1",
    "http://[::1]:8100/api/v1",
    "https://market.example/api/v1",
  ])
    expect(mcpEndpoint(url, true)).toEqual({ url, lanHttp: false });
});

test("private IPv4 HTTP requires explicit opt-in", () => {
  for (const host of [
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.68.109",
  ]) {
    const url = `http://${host}:8100/api/v1`;
    expect(() => mcpEndpoint(url, false)).toThrow(/Enable trusted LAN HTTP/);
    expect(mcpEndpoint(url, true)).toEqual({ url, lanHttp: true });
  }
});

test("LAN opt-in does not enable public HTTP, DNS or malformed API roots", () => {
  for (const url of [
    "http://market.example/api/v1",
    "http://192.168.68.109.example/api/v1",
    "http://8.8.8.8/api/v1",
    "http://172.15.255.254/api/v1",
    "http://172.32.0.1/api/v1",
    "http://192.169.0.1/api/v1",
    "http://169.254.1.1/api/v1",
    "https://user:secret@market.example/api/v1",
    "https://market.example/api/v1?token=secret",
    "https://market.example/api/v1#fragment",
    "https://market.example/",
    "file:///api/v1",
  ])
    expect(() => mcpEndpoint(url, true)).toThrow();
});
