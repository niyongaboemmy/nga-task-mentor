import {
  canControlSession,
  canWatch,
  courseOfSession,
  proctorRoomsFor,
  sessionRoom,
  streamTargets,
  LiveIdentity,
} from "../src/proctorRooms";

const head: LiveIdentity = { userId: 1, isProctor: true, tid: 1, courses: "all" };
const teacher: LiveIdentity = { userId: 2, isProctor: true, tid: 1, courses: [10, 11] };
const otherSchool: LiveIdentity = { userId: 1, isProctor: true, tid: 2, courses: "all" };
const student: LiveIdentity = { userId: 9, isProctor: false, tid: 1, sessions: { s1: 10 } };

describe("proctor rooms (TM-9)", () => {
  it("proctors join only their school's rooms: all, or one per course", () => {
    expect(proctorRoomsFor(head)).toEqual(["t1:proctors:all"]);
    expect(proctorRoomsFor(teacher)).toEqual(["t1:proctors:course:10", "t1:proctors:course:11"]);
    expect(proctorRoomsFor(otherSchool)).toEqual(["t2:proctors:all"]);
    expect(proctorRoomsFor(student)).toEqual([]);
    expect(proctorRoomsFor({ ...teacher, courses: undefined })).toEqual([]);
  });

  it("a stream goes to school-wide proctors and its course's room; unknown course: school-wide only", () => {
    expect(streamTargets(1, 10)).toEqual(["t1:proctors:all", "t1:proctors:course:10"]);
    expect(streamTargets(1, null)).toEqual(["t1:proctors:all"]);
    expect(sessionRoom(2, "abc")).toBe("t2:proctoring-abc");
  });

  it("canWatch: same school, and the course is the proctor's", () => {
    expect(canWatch(head, { tid: 1, courseId: 99 })).toBe(true);
    expect(canWatch(teacher, { tid: 1, courseId: 10 })).toBe(true);
    expect(canWatch(teacher, { tid: 1, courseId: 12 })).toBe(false);
    expect(canWatch(teacher, { tid: 1, courseId: null })).toBe(false);
    expect(canWatch(otherSchool, { tid: 1, courseId: 10 })).toBe(false);
    expect(canWatch(student, { tid: 1, courseId: 10 })).toBe(false);
  });

  it("a session's course comes from the student's ticket, else the known stream", () => {
    expect(courseOfSession(student, "s1")).toBe(10);
    expect(courseOfSession(student, "s2", { tid: 1, courseId: 4 })).toBe(4);
    expect(courseOfSession(undefined, "s3")).toBeNull();
    expect(canControlSession(teacher, undefined)).toBe(true);
    expect(canControlSession(teacher, { tid: 1, courseId: 12 })).toBe(false);
    expect(canControlSession(student, undefined)).toBe(false);
  });
});
