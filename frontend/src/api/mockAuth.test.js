import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authenticateMockLogin, shouldUseMockFallback, DEMO_CREDENTIALS } from "./mockAuth.js";
import { MOCK_USERS } from "./mockData.js";

describe("shouldUseMockFallback", () => {
  it("does not mock after HTTP auth failures from a live backend", () => {
    const err = new Error("Invalid email or password");
    err.status = 401;
    assert.equal(shouldUseMockFallback(err), false);
  });

  it("uses mock only for network/unreachable errors", () => {
    assert.equal(shouldUseMockFallback(new TypeError("Failed to fetch")), true);
  });
});

describe("authenticateMockLogin", () => {
  it("accepts a legitimate demo account with the correct password", () => {
    const user = authenticateMockLogin(
      MOCK_USERS,
      "student@university.edu",
      DEMO_CREDENTIALS["student@university.edu"]
    );
    assert.equal(user.email, "student@university.edu");
    assert.equal(user.role, "candidate");
    assert.equal(user.password, undefined);
  });

  it("accepts other seeded demo roles with their own passwords", () => {
    const admin = authenticateMockLogin(MOCK_USERS, "admin@recruit.com", "admin123");
    assert.equal(admin.role, "admin");
    const recruiter = authenticateMockLogin(MOCK_USERS, "recruiter@techcorp.com", "recruiter123");
    assert.equal(recruiter.role, "recruiter");
  });

  it("rejects an invalid password for a known user", () => {
    assert.throws(
      () => authenticateMockLogin(MOCK_USERS, "student@university.edu", "wrong-password"),
      (err) => err.status === 401 && err.message === "Invalid email or password"
    );
  });

  it("rejects an unknown user instead of defaulting to the demo candidate", () => {
    assert.throws(
      () => authenticateMockLogin(MOCK_USERS, "nobody@example.com", "student123"),
      (err) => err.status === 401 && err.message === "Invalid email or password"
    );
  });
});
