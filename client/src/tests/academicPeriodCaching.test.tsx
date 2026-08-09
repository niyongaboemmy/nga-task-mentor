import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  emitAcademicPeriodChanged,
  onAcademicPeriodChanged,
} from "../utils/academicPeriodEvents";
import {
  CourseCacheProvider,
  useCourseCache,
} from "../contexts/CourseCacheContext";
import {
  SchemeOfWorkProvider,
  useSchemeOfWork,
} from "../contexts/SchemeOfWorkContext";
import { CourseApiService } from "../services/courseApi";
import { QuestionBankApiService } from "../services/quizApi";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../services/courseApi", () => ({
  CourseApiService: { getCourse: vi.fn() },
}));

vi.mock("../services/quizApi", () => ({
  QuestionBankApiService: { getSchemeOfWorkEntries: vi.fn() },
}));

// ─── Tests: the pub/sub utility itself ───────────────────────────────────────

describe("academicPeriodEvents", () => {
  it("delivers emitted events to subscribers and stops after unsubscribing", () => {
    const handler = vi.fn();
    const unsubscribe = onAcademicPeriodChanged(handler);

    emitAcademicPeriodChanged();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitAcademicPeriodChanged();
    expect(handler).toHaveBeenCalledTimes(1); // no further calls
  });
});

// ─── Tests: CourseCacheContext respects a period switch ──────────────────────

describe("CourseCacheContext + academic period switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves cached course details until the period changes, then refetches", async () => {
    (CourseApiService.getCourse as any).mockResolvedValue({
      success: true,
      data: { id: 1, title: "Math" },
    });

    const { result } = renderHook(() => useCourseCache(), {
      wrapper: CourseCacheProvider,
    });

    await act(async () => {
      await result.current.getCourse(1);
    });
    await act(async () => {
      await result.current.getCourse(1);
    });
    expect(CourseApiService.getCourse).toHaveBeenCalledTimes(1);

    // Switching academic period must invalidate the cache, since Layout's
    // remount can't reach a provider mounted above it.
    act(() => emitAcademicPeriodChanged());

    await act(async () => {
      await result.current.getCourse(1);
    });
    expect(CourseApiService.getCourse).toHaveBeenCalledTimes(2);
  });
});

// ─── Tests: SchemeOfWorkContext keys by term, and clears on period switch ────

describe("SchemeOfWorkContext + academic period switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not serve one term's entries for another term (composite cache key)", async () => {
    (QuestionBankApiService.getSchemeOfWorkEntries as any)
      .mockResolvedValueOnce({ success: true, data: [{ id: 1 }] }) // term 7
      .mockResolvedValueOnce({ success: true, data: [{ id: 2 }] }); // term 5

    const { result } = renderHook(() => useSchemeOfWork(), {
      wrapper: SchemeOfWorkProvider,
    });

    let termSeven: any[] = [];
    let termFive: any[] = [];
    await act(async () => {
      termSeven = await result.current.getEntries(1, 10, 7);
    });
    await act(async () => {
      termFive = await result.current.getEntries(1, 10, 5);
    });

    expect(QuestionBankApiService.getSchemeOfWorkEntries).toHaveBeenCalledTimes(2);
    expect(termSeven).toEqual([{ id: 1 }]);
    expect(termFive).toEqual([{ id: 2 }]);

    // Re-requesting term 7 should hit the cache, not the network, since
    // nothing has changed.
    await act(async () => {
      await result.current.getEntries(1, 10, 7);
    });
    expect(QuestionBankApiService.getSchemeOfWorkEntries).toHaveBeenCalledTimes(2);
  });

  it("clears every cached term's entries when the academic period changes", async () => {
    (QuestionBankApiService.getSchemeOfWorkEntries as any).mockResolvedValue({
      success: true,
      data: [{ id: 1 }],
    });

    const { result } = renderHook(() => useSchemeOfWork(), {
      wrapper: SchemeOfWorkProvider,
    });

    await act(async () => {
      await result.current.getEntries(1, 10, 7);
    });
    await act(async () => {
      await result.current.getEntries(1, 10, 7);
    });
    expect(QuestionBankApiService.getSchemeOfWorkEntries).toHaveBeenCalledTimes(1);

    act(() => emitAcademicPeriodChanged());

    await waitFor(() => {
      expect(result.current.isLoading(1, 10, 7)).toBe(false);
    });

    await act(async () => {
      await result.current.getEntries(1, 10, 7);
    });
    expect(QuestionBankApiService.getSchemeOfWorkEntries).toHaveBeenCalledTimes(2);
  });
});
