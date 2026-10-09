import { rebasePreviewRoots } from "../preview";

const base = "/api/tmcode/preview/tok.sig/";

describe("rebasePreviewRoots", () => {
  it("keeps root-relative links in HTML inside the preview", () => {
    const html = `<link rel="stylesheet" href="/style.css"><script type="module" src="/src/main.tsx"></script>
<a href='/about.html'>About</a><form action=/send><img src="/img/a.png"><video poster="/p.jpg"></video>`;
    expect(rebasePreviewRoots(html, base, "html")).toBe(`<link rel="stylesheet" href="${base}style.css"><script type="module" src="${base}src/main.tsx"></script>
<a href='${base}about.html'>About</a><form action=${base}send><img src="${base}img/a.png"><video poster="${base}p.jpg"></video>`);
  });

  it("leaves relative, absolute and protocol-relative links alone", () => {
    const html = `<link href="css/a.css"><script src="https://cdn.x/y.js"></script><script src="//cdn.x/z.js"></script><a href="#top">`;
    expect(rebasePreviewRoots(html, base, "html")).toBe(html);
  });

  it("rebases url(/…) in stylesheets and inline styles", () => {
    expect(rebasePreviewRoots(`body{background:url(/bg.png)} .a{background:url("/a.svg")} .b{background:url(//cdn/b.png)}`, base, "css")).toBe(
      `body{background:url(${base}bg.png)} .a{background:url("${base}a.svg")} .b{background:url(//cdn/b.png)}`,
    );
    expect(rebasePreviewRoots(`<div style="background:url('/x.png')"></div>`, base, "html")).toBe(`<div style="background:url('${base}x.png')"></div>`);
  });

  it("doesn't touch text that merely mentions a path", () => {
    // (Attribute-like text such as " src=/x" in prose would be rewritten: no HTML parser here, and it's rare.)
    expect(rebasePreviewRoots(`<p>Open /index.html, then go to /about</p>`, base, "html")).toBe(`<p>Open /index.html, then go to /about</p>`);
  });
});
