import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";

let importCounter = 0;

type DeliveryModule = typeof import("../src/delivery.ts");

async function importDeliveryWithSecrets(secrets: { deliverySecret?: string; devAuthSecret?: string }): Promise<DeliveryModule> {
    const previousDeliverySecret = process.env.DELIVERY_SECRET;
    const previousDevAuthSecret = process.env.DEV_AUTH_SECRET;
    if (secrets.deliverySecret === undefined) {
        delete process.env.DELIVERY_SECRET;
    } else {
        process.env.DELIVERY_SECRET = secrets.deliverySecret;
    }
    if (secrets.devAuthSecret === undefined) {
        delete process.env.DEV_AUTH_SECRET;
    } else {
        process.env.DEV_AUTH_SECRET = secrets.devAuthSecret;
    }

    const module = await import(`../dist/delivery.js?delivery-test=${importCounter++}`);

    if (previousDeliverySecret === undefined) {
        delete process.env.DELIVERY_SECRET;
    } else {
        process.env.DELIVERY_SECRET = previousDeliverySecret;
    }
    if (previousDevAuthSecret === undefined) {
        delete process.env.DEV_AUTH_SECRET;
    } else {
        process.env.DEV_AUTH_SECRET = previousDevAuthSecret;
    }

    return module;
}

async function importDeliveryWithSecret(secret: string | undefined): Promise<DeliveryModule> {
    return importDeliveryWithSecrets({ deliverySecret: secret });
}

function signedToken(secret: string, payload: { pageId: string; userId: string; exp: number }): string {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", secret).update(data).digest("base64url");
    return `${data}.${sig}`;
}

function retargetTokenKeepingSignature(token: string, pageId: string): string {
    const [data, sig] = token.split(".");
    assert.ok(data);
    assert.ok(sig);
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as { pageId: string; userId: string; exp: number };
    const retargetedData = Buffer.from(JSON.stringify({ ...payload, pageId })).toString("base64url");
    return `${retargetedData}.${sig}`;
}

function tamperAuthTokenKeepingSignature(token: string): string {
    const [data, sig] = token.split(".");
    assert.ok(data);
    assert.ok(sig);
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as { id: string; name: string; role: string };
    const tamperedData = Buffer.from(JSON.stringify({ ...payload, role: "admin" })).toString("base64url");
    return `${tamperedData}.${sig}`;
}

test("delivery token generation and verification roundtrips page and user data", async () => {
    const { generateDeliveryToken, verifyDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret");

    const token = generateDeliveryToken("page-1", "user-1");
    const payload = verifyDeliveryToken(token);

    assert.deepEqual(payload && { pageId: payload.pageId, userId: payload.userId }, {
        pageId: "page-1",
        userId: "user-1",
    });
    assert.equal(typeof payload?.exp, "number");
});

test("delivery token verification rejects tampered payload data", async () => {
    const { generateDeliveryToken, verifyDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret");

    const token = generateDeliveryToken("page-1", "user-1");
    const tampered = retargetTokenKeepingSignature(token, "page-2");

    assert.equal(verifyDeliveryToken(tampered), null);
});

test("delivery token verification rejects expired tokens", async () => {
    const secret = "delivery-test-secret";
    const { verifyDeliveryToken } = await importDeliveryWithSecret(secret);
    const token = signedToken(secret, {
        pageId: "page-1",
        userId: "user-1",
        exp: Math.floor(Date.now() / 1000) - 1,
    });

    assert.equal(verifyDeliveryToken(token), null);
});

test("delivery route callers can reject a token for a different page", async () => {
    const { generateDeliveryToken, verifyDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret");

    const token = generateDeliveryToken("page-1", "user-1");
    const payload = verifyDeliveryToken(token);

    assert.equal(payload?.pageId, "page-1");
    assert.notEqual(payload?.pageId, "page-2");
});

test("delivery token verification rejects tokens signed with another secret", async () => {
    const { generateDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret-a");
    const { verifyDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret-b");

    const token = generateDeliveryToken("page-1", "user-1");

    assert.equal(verifyDeliveryToken(token), null);
});

test("delivery token verification rejects malformed tokens", async () => {
    const { verifyDeliveryToken } = await importDeliveryWithSecret("delivery-test-secret");

    assert.equal(verifyDeliveryToken("not-a-token"), null);
    assert.equal(verifyDeliveryToken("payload.signature.extra"), null);
});

test("auth token generation and verification roundtrips user data", async () => {
    const { generateAuthToken, verifyAuthToken } = await importDeliveryWithSecrets({ devAuthSecret: "auth-test-secret" });

    const token = generateAuthToken({ id: "user-1", name: "User One", role: "user" });
    const payload = verifyAuthToken(token);

    assert.deepEqual(payload, { id: "user-1", name: "User One", role: "user" });
});

test("auth token verification rejects tampered payload data", async () => {
    const { generateAuthToken, verifyAuthToken } = await importDeliveryWithSecrets({ devAuthSecret: "auth-test-secret" });

    const token = generateAuthToken({ id: "user-1", name: "User One", role: "user" });
    const tampered = tamperAuthTokenKeepingSignature(token);

    assert.equal(verifyAuthToken(tampered), null);
});

test("auth token verification rejects tokens signed with another secret", async () => {
    const { generateAuthToken } = await importDeliveryWithSecrets({ devAuthSecret: "auth-test-secret-a" });
    const { verifyAuthToken } = await importDeliveryWithSecrets({ devAuthSecret: "auth-test-secret-b" });

    const token = generateAuthToken({ id: "user-1", name: "User One", role: "user" });

    assert.equal(verifyAuthToken(token), null);
});

test("auth token verification rejects malformed tokens", async () => {
    const { verifyAuthToken } = await importDeliveryWithSecrets({ devAuthSecret: "auth-test-secret" });

    assert.equal(verifyAuthToken("not-a-token"), null);
    assert.equal(verifyAuthToken("payload.signature.extra"), null);
});
