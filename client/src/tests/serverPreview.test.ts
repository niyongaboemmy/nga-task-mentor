import { describe, expect, it } from "vitest";
import { looksLikeServer } from "../components/code/serverDetect";
import { plainTerminalText } from "../components/code/useInteractiveRun";

const f = (path: string, content: string) => ({ path, content });

describe("which projects are web servers", () => {
  it("finds servers by their packages and code", () => {
    expect(looksLikeServer([f("package.json", '{"dependencies":{"express":"^4.19.0"}}')])).toBe(true);
    expect(looksLikeServer([f("app.py", "from flask import Flask\napp = Flask(__name__)")])).toBe(true);
    expect(looksLikeServer([f("main.py", "from fastapi import FastAPI")])).toBe(true);
    expect(looksLikeServer([f("requirements.txt", "Django==5.0\n")])).toBe(true);
    expect(looksLikeServer([f("server.js", "require('http').createServer((q, s) => s.end('hi')).listen(3000)")])).toBe(true);
    expect(looksLikeServer([f("src/main/java/App.java", "@SpringBootApplication\npublic class App {}")])).toBe(true);
    expect(looksLikeServer([f("Web.csproj", '<Project Sdk="Microsoft.NET.Sdk.Web">')])).toBe(true);
  });

  it("leaves ordinary programs alone", () => {
    expect(looksLikeServer([f("main.py", "a, b = map(int, input().split())\nprint(a + b)")])).toBe(false);
    expect(looksLikeServer([f("main.js", 'console.log("hi")')])).toBe(false);
    expect(looksLikeServer([f("package.json", '{"devDependencies":{"vitest":"1"}}')])).toBe(false);
  });
});

describe("real terminal output, as plain text", () => {
  it("drops colours, cursor moves, titles and terminal line endings", () => {
    expect(plainTerminalText("\x1b[1;32mPASS\x1b[0m done\r\n")).toBe("PASS done\n");
    expect(plainTerminalText("\x1b]0;title\x07Name? ")).toBe("Name? ");
    expect(plainTerminalText("a\x1b[2K\x1b[1Gb\r")).toBe("ab");
  });
});
