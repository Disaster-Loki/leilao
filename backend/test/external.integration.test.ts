import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  ARTWORK,
  getTestEnv,
  request,
  setExternalDown,
  setupTestEnv,
  teardownTestEnv,
} from "./helpers";

before(setupTestEnv);
after(teardownTestEnv);

test("API externa: busca protegida e falha isolada da vitrine", async () => {
  const { auctioneer } = getTestEnv();

  const unauthorized = await request("/external/artworks?q=teste");
  assert.equal(unauthorized.status, 401);

  const search = await request("/external/artworks?q=teste", { token: auctioneer.token });
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 1);
  assert.equal(search.body[0].title, ARTWORK.title);

  setExternalDown(true);
  try {
    const offline = await request("/external/artworks?q=offline", {
      token: auctioneer.token,
    });
    assert.equal(offline.status, 503);
    assert.equal(offline.body.error, "EXTERNAL_API_UNAVAILABLE");
    assert.match(offline.body.message, /temporariamente indisponível/);

    const showcase = await request("/lots");
    assert.equal(showcase.status, 200);
    assert.ok(Array.isArray(showcase.body.live));
  } finally {
    setExternalDown(false);
  }
});
