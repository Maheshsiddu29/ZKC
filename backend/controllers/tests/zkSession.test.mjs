import {
  createSessionPayload,
  signSession,
  verifySession,
} from "../../server/zkSession.js";


describe("ZK session signing and verification", () => {
  test("valid session verifies and preserves predicates", () => {
    const predicates = { age18: true, int_gadgets: true };
    const payload = createSessionPayload({
      origin: "123",
      mask: 5,
      predicates,
    });

    const token = signSession(payload);
    const verified = verifySession(token);

    expect(verified).not.toBeNull();
    expect(verified.origin).toBe(payload.origin);
    expect(verified.mask).toBe(payload.mask);
    expect(verified.predicates).toEqual(predicates);
  });

  test("tampered token fails verification", () => {
    const payload = createSessionPayload({
      origin: "123",
      mask: 5,
      predicates: { any: true },
    });

    const token = signSession(payload);
    const [b64, sig] = token.split(".");
    // flip one char in signature
    const tampered = `${b64}.${sig.slice(0, -1)}X`;

    const verified = verifySession(tampered);
    expect(verified).toBeNull();
  });

  test("expired token fails verification", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      origin: "123",
      mask: 5,
      predicates: { any: true },
      iat: now - 1000,
      exp: now - 1,
    };

    const token = signSession(payload);
    const verified = verifySession(token);
    expect(verified).toBeNull();
  });
});
