import { isPrivateAddress, sniffImage, downloadImage } from "../editorImages";

describe("sniffImage", () => {
  it("identifies images from their bytes", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe("png");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(Buffer.from("GIF89a....", "latin1"))?.ext).toBe("gif");
    expect(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))?.ext).toBe("webp");
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffImage(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "142.250.72.14", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("downloadImage guards", () => {
  it("refuses non-http schemes", async () => {
    await expect(downloadImage("file:///etc/passwd")).rejects.toThrow(/http/);
  });
  it("refuses literal private addresses", async () => {
    await expect(downloadImage("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/not allowed/);
    await expect(downloadImage("http://[::1]:5002/x.png")).rejects.toThrow(/not allowed/);
  });
  it("refuses hostnames that resolve to a private address", async () => {
    await expect(downloadImage("http://localhost:5002/uploads/x.png")).rejects.toThrow(/not allowed/);
  });
});
