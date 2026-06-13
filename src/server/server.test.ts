import { test, expect, describe } from "bun:test";
import { app } from "./index";

describe("ElysiaJS Server Routes Test Suite", () => {
  test("GET / baseline checks status", async () => {
    const res = await app.handle(new Request("http://localhost:3000/"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("running");
  });

  test("GET /api/auth/status baseline parameters", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/auth/status"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("authenticated");
    expect(data).toHaveProperty("mode");
  });

  test("GET /api/market/watchlist returns watchlist", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/market/watchlist"));
    expect(res.status).toBe(200);
    const watchlist = await res.json();
    expect(watchlist).toBeArray();
    expect(watchlist.length).toBeGreaterThan(0);
    expect(watchlist[0].trading_symbol).toBe("SBIN");
  });

  test("GET /api/agents lists all agent details", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/agents"));
    expect(res.status).toBe(200);
    const agents = await res.json();
    expect(agents).toBeArray();
    expect(agents[0]).toHaveProperty("role");
    expect(agents[0]).toHaveProperty("name");
    expect(agents[0]).toHaveProperty("greeting");
  });

  test("GET /api/chat/history/fund_manager yields default greeting", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/chat/history/fund_manager"));
    expect(res.status).toBe(200);
    const history = await res.json();
    expect(history).toBeArray();
    expect(history).toHaveLength(1);
    expect(history[0].sender).toBe("fund_manager");
    expect(history[0].content).toContain("Hello, I am the Fund Manager");
  });

  test("POST /api/chat/fund_manager invokes agent mock loop", async () => {
    const body = { message: "What are your risk rules?" };
    const res = await app.handle(
      new Request("http://localhost:3000/api/chat/fund_manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("response");
    expect(data.response.sender).toBe("fund_manager");
    expect(data.response.content).toBeTypeOf("string");
  });
});
