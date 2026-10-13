/**
 * E2E: a coding question in a quiz is the code workspace (CODE_RUNNER_PLAN.md
 * §7.2): no "Start coding" gate, Run and Run tests through the quiz's run
 * route, the answer saved as {code, language}, and full screen with the
 * timer and "Save & next" in view. Mocked API; screenshots to $TMCODE_SHOTS.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");
test.use({ serviceWorkers: "block" });

const QUIZ_ID = 7;
const quiz = {
  id: QUIZ_ID,
  title: "Python basics",
  description: "",
  status: "published",
  type: "Quiz",
  time_limit: 600,
  instructions: "<p>Write the programs.</p>",
  student_state: {
    availability: { state: "open", opens_at: null, closes_at: null },
    attempts: { max_attempts: 1, attempts_used: 0, attempts_left: 1, in_progress_submission_id: null, current_attempt_number: 1, can_start_new_attempt: true, last_finished_submission_id: null },
    enrolled: true,
    can_start: true,
    blocked_reason: null,
  },
  questions: [
    {
      id: 401,
      quiz_id: QUIZ_ID,
      points: 5,
      order: 1,
      question_type: "coding",
      question_text: "<p>Read two numbers and print their sum.</p>",
      question_data: {
        language: "python",
        allowed_languages: ["javascript"],
        starter_code: "a, b = map(int, input().split())\nprint(a + b)\n",
        test_cases: [{ id: "v1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 }],
      },
      questionBank: { question_type: "coding", question_text: "<p>Read two numbers and print their sum.</p>" },
    },
    {
      id: 402,
      quiz_id: QUIZ_ID,
      points: 1,
      order: 2,
      question_type: "single_choice",
      question_text: "<p>Pick one</p>",
      options: ["A", "B"],
      questionBank: { question_type: "single_choice", question_text: "<p>Pick one</p>", options: ["A", "B"] },
    },
  ],
};

const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify({ success: true, data }) });

async function setup(page: Page) {
  const calls: { path: string; body: unknown }[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "student");
  await page.route("**/api/**", (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    const path = new URL(req.url()).pathname.replace(/^.*\/api/, "");
    const post = req.method() === "POST" || req.method() === "PUT";
    if (post) calls.push({ path, body: req.postDataJSON?.() ?? null });
    if (path === "/auth/me") return route.fallback();
    if (path === `/quizzes/${QUIZ_ID}`) return json(route, quiz);
    if (path === "/quizzes/submissions" && post) return json(route, { id: 55, quiz_id: QUIZ_ID, status: "in_progress", answers: [], started_at: new Date().toISOString(), time_remaining_seconds: 600 });
    if (path === "/quizzes/questions/401/run-code") {
      const b = req.postDataJSON() as { run_tests?: boolean; stdin?: string };
      if (b.run_tests) return json(route, { results: [{ testCaseId: "v1", passed: true, input: "1 2", expected: "3", actual: "3\n", error: null, executionTime: 14, memoryUsed: null, status: "Accepted", is_hidden: false }], passed: 1, total: 1 });
      const [a, c] = String(b.stdin ?? "").split(/\s+/).map(Number);
      return json(route, { stdout: `${(a ?? 0) + (c ?? 0)}\n`, stderr: null, status: "Accepted", exit_code: 0, execution_time: 12, memory_used: null, web_preview: false });
    }
    if (path.startsWith("/proctoring")) return json(route, { enabled: false });
    return json(route, []);
  });
  return calls;
}

async function openQuestion(page: Page) {
  await page.goto(`/taskmentor/quizzes/${QUIZ_ID}/take`);
  await expect(page.getByText("Write the programs.")).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < 6; i++) {
    const start = page.getByRole("button", { name: /start/i });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      break;
    }
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByTestId("quiz-code-answer")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("code-editor").locator(".view-lines")).toContainText("print", { timeout: 20_000 });
}

test("answer a coding question in the workspace: run, test, save", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  const calls = await setup(page);
  await openQuestion(page);
  // No gate: the editor is there at once.
  await expect(page.getByRole("button", { name: /start coding/i })).toHaveCount(0);

  await page.getByTestId("run-stdin").fill("4 8");
  await page.getByTestId("quiz-code-answer").getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("run-output")).toHaveText("12");
  expect(calls.find((c) => c.path === "/quizzes/questions/401/run-code")?.body).toMatchObject({ language: "python", stdin: "4 8", code: expect.stringContaining("print(a + b)") });

  await page.getByRole("tab", { name: /Tests/ }).click();
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(page.getByText("1/1 tests passed")).toBeVisible();
  await shot(page, "quiz-coding-inline");

  // Typing keeps the answer as {code, language} (saved on the device, then with Save / Next).
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n# done");
  await expect
    .poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem("quiz_7_answers"))) ?? "[]").find((a: { question_id: number }) => a.question_id === 401)?.answer, { timeout: 10_000 })
    .toMatchObject({ language: "python", code: expect.stringContaining("# done") });
});

test("full screen keeps the timer, Exit and Save & next in view", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  await setup(page);
  await openQuestion(page);
  await page.getByTestId("quiz-code-expand").click();
  await expect(page.getByTestId("quiz-code-timer")).toBeVisible();
  await expect(page.getByRole("button", { name: /Exit full screen/ })).toBeVisible();
  await shot(page, "quiz-coding-fullscreen");
  await page.getByTestId("quiz-code-next").click();
  await expect(page.getByText("Pick one").first()).toBeVisible();
});

test("on a phone: Task, Code and Output tabs inside the question", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout");
  await setup(page);
  await openQuestion(page).catch(async () => {
    // The phone layout may need the Code tab first.
    await page.getByRole("tab", { name: "Code" }).click();
  });
  await page.getByRole("tab", { name: "Output" }).click();
  await page.getByTestId("run-stdin").fill("2 2");
  await page.getByTestId("quiz-code-answer").getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("run-output")).toHaveText("4");
  await shot(page, "quiz-coding-phone");
});
