import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";

let app: Awaited<ReturnType<typeof buildApp>>;

async function clearDb(): Promise<void> {
  await app.prisma.habitCheckIn.deleteMany();
  await app.prisma.habit.deleteMany();
  await app.prisma.expense.deleteMany();
  await app.prisma.refreshToken.deleteMany();
  await app.prisma.user.deleteMany();
}

describe("API integration", () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await app.close();
  });

  it("register/login/protected me flow", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      },
    });

    expect(registerRes.statusCode).toBe(201);
    const registerJson = registerRes.json();
    expect(registerJson.data.accessToken).toBeTypeOf("string");

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginJson = loginRes.json();

    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${loginJson.data.accessToken}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.email).toBe("test@example.com");
  });

  it("refresh token flow", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Refresh User",
        email: "refresh@example.com",
        password: "password123",
      },
    });

    const refreshToken = registerRes.json().data.refreshToken as string;

    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: {
        refreshToken,
      },
    });

    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json().data.accessToken).toBeTypeOf("string");
    expect(refreshRes.json().data.refreshToken).toBeTypeOf("string");
  });

  it("expense create and fetch", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Expense User",
        email: "expense@example.com",
        password: "password123",
      },
    });

    const accessToken = registerRes.json().data.accessToken as string;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        title: "Lunch",
        amount: 14.5,
        category: "Food",
        expenseDate: new Date().toISOString(),
        notes: "Salad",
      },
    });

    expect(createRes.statusCode).toBe(201);

    const fetchRes = await app.inject({
      method: "GET",
      url: "/api/expenses?page=1&pageSize=10",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(fetchRes.statusCode).toBe(200);
    const payload = fetchRes.json().data;
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].title).toBe("Lunch");
  });

  it("blocks protected route without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/expenses",
    });

    expect(res.statusCode).toBe(401);
  });
});
