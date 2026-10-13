/**
 * What a TMCode grade is out of: the assignment's max score; without one (0), the criteria's sum;
 * with neither, 100, so an assignment without criteria can still get one final grade.
 */
export function assignmentMaxPoints(maxScore: number, rubric: { max_score: number }[]): number {
  if (maxScore > 0) return maxScore;
  const sum = rubric.reduce((n, c) => n + (c.max_score || 0), 0);
  return sum > 0 ? sum : 100;
}
