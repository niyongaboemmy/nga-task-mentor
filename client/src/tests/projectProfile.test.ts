import { describe, expect, it } from "vitest";
import { profileProject } from "../components/Projects/grading/projectProfile";
import { fitScale } from "../components/Projects/grading/previewFit";

const f = (path: string, content = "") => ({ path, content });

describe("how to check a project, by its technology", () => {
  it("web page → Preview", () => {
    const p = profileProject([f("index.html", "<h1>Hi</h1>"), f("style.css")]);
    expect(p).toMatchObject({ id: "web-page", primary: "preview" });
    expect(p.actions[0]).toBe("preview");
  });

  it("React/Vue/Svelte/Angular apps need a build: Code first, with the reason", () => {
    for (const [dep, label] of [["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"], ["@angular/core", "Angular"], ["next", "Next.js"]] as const) {
      const p = profileProject([f("package.json", `{"dependencies":{"${dep}":"1"}}`), f("index.html"), f("src/App.jsx")]);
      expect(p).toMatchObject({ id: "web-app-build", label: `${label} app`, primary: "code" });
      expect(p.note).toMatch(/build/);
    }
  });

  it("web servers (Express, Flask, Django, Spring, ASP.NET) → TMCode", () => {
    expect(profileProject([f("package.json", '{"dependencies":{"express":"4"}}'), f("server.js")]).id).toBe("web-server");
    expect(profileProject([f("app.py", "from flask import Flask")]).id).toBe("web-server");
    expect(profileProject([f("manage.py"), f("site/settings.py")]).id).toBe("web-server");
    expect(profileProject([f("pom.xml", "<artifactId>spring-boot-starter-web</artifactId>"), f("src/main/java/App.java")]).id).toBe("web-server");
    expect(profileProject([f("Web.csproj", '<Project Sdk="Microsoft.NET.Sdk.Web">')]).id).toBe("web-server");
    expect(profileProject([f("app.py", "from flask import Flask"), f("tests/test_app.py")]).primary).toBe("run");
  });

  it("window apps (Swing, JavaFX, Tkinter, pygame) can't be shown here", () => {
    expect(profileProject([f("Main.java", "import javax.swing.JFrame;")])).toMatchObject({ id: "desktop-gui", label: "Java window app" });
    expect(profileProject([f("game.py", "import pygame")]).id).toBe("desktop-gui");
  });

  it("phone apps → TMCode", () => {
    expect(profileProject([f("pubspec.yaml", "dependencies:\n  flutter:\n    sdk: flutter"), f("lib/main.dart")])).toMatchObject({ id: "mobile-app", label: "Flutter app" });
  });

  it("SQL → Run (tables)", () => {
    expect(profileProject([f("schema.sql"), f("seed.sql"), f("main.sql")])).toMatchObject({ id: "sql", primary: "run" });
  });

  it("Python data analysis → Run, charts not shown", () => {
    const p = profileProject([f("analysis.py", "import pandas as pd"), f("marks.csv")]);
    expect(p).toMatchObject({ id: "data-analysis", primary: "run" });
    expect(p.note).toMatch(/Charts/);
  });

  it("projects with unit tests → unit tests first", () => {
    expect(profileProject([f("src/shop/cart.py"), f("tests/test_cart.py")])).toMatchObject({ id: "unit-tested", label: "Python project with unit tests", primary: "run" });
    expect(profileProject([f("Grades.java"), f("GradesTest.java")]).actions[0]).toBe("unit-tests");
  });

  it("programs → Run with inputs; ignores dependencies and build output", () => {
    expect(profileProject([f("main.c"), f("build/main.o")])).toMatchObject({ id: "program", label: "C program", primary: "run" });
    expect(profileProject([f("main.py"), f("node_modules/x/index.html")])).toMatchObject({ id: "program", label: "Python program" });
  });

  it("anything else → read the code", () => {
    expect(profileProject([f("notes.txt")])).toMatchObject({ id: "code-only", primary: "code" });
  });
});

describe("preview scaling keeps the screen's proportions", () => {
  it("scales a page down to fit, never up", () => {
    expect(fitScale({ w: 1440, h: 900 }, { w: 720, h: 900 })).toBe(0.5);
    expect(fitScale({ w: 390, h: 844 }, { w: 1000, h: 422 })).toBe(0.5);
    expect(fitScale({ w: 390, h: 844 }, { w: 2000, h: 2000 })).toBe(1);
  });
});
