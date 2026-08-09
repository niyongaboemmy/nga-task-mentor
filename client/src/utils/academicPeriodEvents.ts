// A few data caches (CourseCacheContext, SchemeOfWorkContext, the
// module-level Assignments list cache) live outside -- or, in the case of a
// module-level Map, entirely independent of -- the React tree that gets
// remounted when the academic period switcher fires (see Layout's
// `key={academicPeriodVersion}`). Remounting alone can't reach them, so
// AcademicPeriodSwitcher/AuthContext broadcast this event and each cache
// clears itself in response.
const ACADEMIC_PERIOD_CHANGED_EVENT = "nga-tm:academic-period-changed";

export const emitAcademicPeriodChanged = (): void => {
  window.dispatchEvent(new Event(ACADEMIC_PERIOD_CHANGED_EVENT));
};

/** Returns an unsubscribe function -- call it from a useEffect cleanup. */
export const onAcademicPeriodChanged = (handler: () => void): (() => void) => {
  window.addEventListener(ACADEMIC_PERIOD_CHANGED_EVENT, handler);
  return () => window.removeEventListener(ACADEMIC_PERIOD_CHANGED_EVENT, handler);
};
