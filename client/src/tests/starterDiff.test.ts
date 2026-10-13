import { describe, it, expect } from "vitest";
import { diffFiles } from "../components/Projects/grading/diffSinceStarter";

describe("changes since the starter", () => {
  it("lists added, changed and deleted files, ignoring the test definitions", () => {
    const starter = [
      { path: "main.c", content: "int main(){}" },
      { path: "util.c", content: "int add(){}" },
      { path: "README.md", content: "# Lab" },
      { path: ".nga/tests.json", content: "{}" },
    ];
    const work = [
      { path: "main.c", content: "int main(){ return 0; }" },
      { path: "README.md", content: "# Lab" },
      { path: "list.c", content: "struct node;" },
      { path: ".nga/tests.json", content: '{"changed":true}' },
    ];
    expect(diffFiles(starter, work).map((c) => [c.path, c.kind])).toEqual([
      ["list.c", "added"],
      ["main.c", "changed"],
      ["util.c", "deleted"],
    ]);
  });

  it("nothing changed: no entries", () => {
    const files = [{ path: "a.py", content: "print(1)" }];
    expect(diffFiles(files, files)).toEqual([]);
  });
});
