import { describe, it, expect } from "vitest";
import { api, wsUrls } from "./api";

describe("api client unit tests", () => {
  it("constructs correct WebSocket URLs", () => {
    const jobWs = wsUrls.jobProgress("test-job-123");
    expect(jobWs).toMatch(/^ws:\/\/.*\/ws\/jobs\/test-job-123$/);

    const chatWs = wsUrls.chat("test-session-456");
    expect(chatWs).toMatch(/^ws:\/\/.*\/ws\/chat\/test-session-456$/);
  });

  it("exposes core API methods", () => {
    expect(typeof api.health).toBe("function");
    expect(typeof api.analyze).toBe("function");
    expect(typeof api.getJobStatus).toBe("function");
    expect(typeof api.getGraph).toBe("function");
    expect(typeof api.getFiles).toBe("function");
    expect(typeof api.getOnboardingDoc).toBe("function");
    expect(typeof api.getCommits).toBe("function");
    expect(typeof api.exportGraph).toBe("function");
    expect(typeof api.getGitHubLoginUrl).toBe("function");
  });

  it("builds proper GitHub login URL", () => {
    const loginUrl = api.getGitHubLoginUrl();
    expect(loginUrl).toContain("/api/v1/auth/github/login");
  });
});
