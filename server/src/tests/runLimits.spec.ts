import { memoryMbOf, questionRunLimits, timeSOf } from "../utils/runLimits";
import { Judge0Runner } from "../services/coderunner";
import { Judge0Service } from "../services/Judge0Service";

describe("coding question run limits", () => {
  it("reads memory in MB, and the old KB values (256000) as KB", () => {
    expect(memoryMbOf(256)).toBe(256);
    expect(memoryMbOf(256000)).toBe(250);
    expect(memoryMbOf(262144)).toBe(256);
    expect(memoryMbOf(4096)).toBe(512); // clamped to the runners' maximum
    expect(memoryMbOf(1)).toBe(16);
    expect(memoryMbOf(undefined)).toBeUndefined();
  });

  it("clamps time to 0.1–20 s with a 5 s default", () => {
    expect(timeSOf(2)).toBe(2);
    expect(timeSOf(500)).toBe(20);
    expect(questionRunLimits({})).toEqual({ time_s: 5, memory_mb: 256 });
    expect(questionRunLimits({ time_limit: 2, memory_limit: 256000 })).toEqual({ time_s: 2, memory_mb: 250 });
  });

  it("Judge0 grading sends cpu_time_limit and a memory limit Judge0 accepts", async () => {
    const submit = jest.spyOn(Judge0Service, "submit").mockResolvedValue("tok");
    jest.spyOn(Judge0Service, "waitAndGetResult").mockResolvedValue({
      stdout: "3", stderr: null, compile_output: null, message: null, time: "0.01", memory: 10, token: "tok",
      status: { id: 3, description: "Accepted" },
    } as any);
    await new Judge0Runner().run({
      language: "python",
      files: [{ path: "main.py", content: "print(3)" }],
      tests: [{ id: "1", input: "", expected_output: "3" }],
      limits: { time_s: 2, memory_mb: 4000 },
    });
    expect(submit.mock.calls[0][0]).toMatchObject({ cpu_time_limit: 2, memory_limit: 512000 });
    expect(submit.mock.calls[0][0]).not.toHaveProperty("cpu_limit");
  });
});
