import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repositoryDir } from "./environment.js";

const read = (file) => readFileSync(path.join(repositoryDir, file), "utf8");

describe("local and container toolchain pins", () => {
  it("uses the same Node release for local development, CI and Docker", () => {
    const nodeVersion = read(".nvmrc").trim();
    expect(nodeVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(read("frontend/Dockerfile")).toContain(`FROM node:${nodeVersion}-bookworm-slim@sha256:`);
    expect(read(".github/workflows/ci.yml")).toContain("node-version-file: .nvmrc");
  });

  it("uses the same Go release for the backend, migration tools and Docker", () => {
    const backendVersion = read("my-backend/go.mod").match(/^go (\S+)$/m)?.[1];
    const toolsVersion = read("my-backend/tools/go.mod").match(/^go (\S+)$/m)?.[1];
    expect(backendVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(toolsVersion).toBe(backendVersion);
    expect(read("my-backend/Dockerfile")).toContain(
      `FROM golang:${backendVersion}-bookworm@sha256:`,
    );
  });

  it("pins every downloaded base image by digest", () => {
    for (const file of ["frontend/Dockerfile", "my-backend/Dockerfile"]) {
      const stages = [...read(file).matchAll(/^FROM (\S+)(?: AS (\S+))?/gm)];
      expect(stages.length).toBeGreaterThanOrEqual(2);
      const aliases = new Set();
      for (const [, image, alias] of stages) {
        if (image !== "scratch" && !aliases.has(image)) {
          expect(image).toMatch(/@sha256:[a-f0-9]{64}$/);
        }
        if (alias) aliases.add(alias);
      }
    }
  });
});
