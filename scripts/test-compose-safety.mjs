#!/usr/bin/env node

// This test intentionally checks specific Compose/entrypoint strings. If the
// Docker local-demo stack is refactored, update these assertions together with
// a boundary review of the default exposure and production secret guards.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync("docker-compose.yml", "utf8");
const apiEntrypoint = readFileSync("apps/api/docker-entrypoint.sh", "utf8");
const apiIndex = readFileSync("apps/api/src/index.ts", "utf8");

function assertIncludes(source, text, label) {
    assert.ok(source.includes(text), `${label} must include ${JSON.stringify(text)}`);
}

function assertBefore(source, before, after, label) {
    const beforeIndex = source.indexOf(before);
    const afterIndex = source.indexOf(after);
    assert.ok(beforeIndex >= 0, `${label} missing ${JSON.stringify(before)}`);
    assert.ok(afterIndex >= 0, `${label} missing ${JSON.stringify(after)}`);
    assert.ok(beforeIndex < afterIndex, `${label} expected ${JSON.stringify(before)} before ${JSON.stringify(after)}`);
}

const portMappings = [...compose.matchAll(/^\s*-\s*["']?([^"'\s#]+)["']?\s*$/gm)]
    .map((match) => match[1])
    .filter((value) => /^\d+\.\d+\.\d+\.\d+:|^\d+:\d+/.test(value));

assert.ok(portMappings.length > 0, "docker-compose.yml should expose local demo ports");
for (const mapping of portMappings) {
    assert.ok(
        mapping.startsWith("127.0.0.1:"),
        `compose port mapping ${mapping} must bind to 127.0.0.1 for the default local demo stack`,
    );
}

assertIncludes(compose, "NODE_ENV: development", "api compose environment");
assertIncludes(compose, "DEV_AUTH_SECRET: manga-compose-dev-auth-secret-change-me", "api compose environment");
assertIncludes(compose, "DELIVERY_SECRET: manga-compose-delivery-secret-change-me", "api compose environment");
assertIncludes(compose, "healthcheck:", "compose services");
assertIncludes(compose, "fetch('http://127.0.0.1:3000/api/v1/health')", "api healthcheck");
assertIncludes(compose, "condition: service_healthy", "viewer/cms dependency gates");

assertBefore(
    apiEntrypoint,
    'if [ "${NODE_ENV:-development}" = "production" ]; then',
    'if [ "${PRISMA_PROVIDER:-postgresql}" = "postgresql" ]; then',
    "api docker entrypoint production secret guard",
);
assertIncludes(apiEntrypoint, '*change-me*)', "api docker entrypoint production secret guard");

assertIncludes(apiIndex, 'DEV_AUTH_SECRET.includes("change-me")', "api production config validation");
assertIncludes(apiIndex, 'DELIVERY_SECRET.includes("change-me")', "api production config validation");

console.log("Docker Compose safety checks passed.");
