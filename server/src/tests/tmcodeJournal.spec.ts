import { canonicalFiles, chainHmac, filesHash, journalKey } from "../tmcode/journal";

/** PROTOCOL.md §4 test vectors: the server must agree with TMCode byte for byte. */
describe("TMCode snapshot chain (PROTOCOL.md §4 vectors)", () => {
  const nonce = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
  const sessionId = "6b1f0f3e-5c55-4b7a-9d55-2d6f1d0a9e01";
  const files = [
    { path: "main.py", content: "print(1)\n" },
    { path: "data/in.txt", content: "2 3\n" },
  ];

  it("nonce is base64 of the ASCII test string", () => {
    expect(Buffer.from(nonce, "base64").toString("ascii")).toBe("0123456789abcdef0123456789abcdef");
  });

  it("canonical files and files_hash", () => {
    expect(canonicalFiles(files)).toBe('[["data/in.txt","2 3\\n"],["main.py","print(1)\\n"]]');
    expect(filesHash(files)).toBe("73362b40acc83d209172257229759322f14c6f68cf5f892757c5c6ba8d12e692");
  });

  it("key and the hmac chain for seq 1 and 2", () => {
    const key = journalKey(nonce, sessionId);
    expect(key.toString("hex")).toBe("d8285399eb1ac762c955b6e46085613a4f7c2b3fba1fa1d7949acccdd63d6f8c");
    const fh = filesHash(files);
    const h1 = chainHmac(key, "", {
      seq: 1,
      question_id: 42,
      kind: "auto",
      files_hash: fh,
      client_ts: "2026-10-05T10:00:00.000Z",
    });
    expect(h1).toBe("f9bb208003aa8286b0cc58e586b0ce76013fe9e3d5ffa8853d0bf49ca46b2dfa");
    const h2 = chainHmac(key, h1, {
      seq: 2,
      question_id: 42,
      kind: "final",
      files_hash: fh,
      client_ts: "2026-10-05T10:05:00.000Z",
    });
    expect(h2).toBe("f95e202aa9cb68ed3e7c5b8e746b8d928751e1006b0c8728122e378d7f312035");
  });
});
