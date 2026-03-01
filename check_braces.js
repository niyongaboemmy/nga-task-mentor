const fs = require("fs");
const content = fs.readFileSync(
  "/Users/m2pro/dev/projects/nga-task-mentor/server/src/utils/quizGrader.ts",
  "utf8",
);
const lines = content.split("\n");
let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "{") balance++;
    if (line[j] === "}") {
      balance--;
      if (balance < 0) {
        console.log(`Unbalanced at line ${i + 1}, col ${j + 1}`);
        return;
      }
    }
  }
}
console.log("Final balance:", balance);
if (balance > 0) {
  console.log("Extra open braces at the end");
}
