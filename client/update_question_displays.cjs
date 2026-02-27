const fs = require("fs");
const path = require("path");

const componentsDir = path.join(__dirname, "src/components");

function findTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (let file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsxFiles(filePath, fileList);
    } else if (filePath.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = findTsxFiles(componentsDir);

allFiles.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  // We DO NOT want to replace it in RichEditor.tsx or RichTextDisplay.tsx or QuestionBankModal.tsx (form inputs)
  if (
    file.includes("RichEditor.tsx") ||
    file.includes("RichTextDisplay.tsx") ||
    file.includes("QuestionForms.tsx") ||
    file.includes("CreateQuestionPage.tsx") ||
    file.includes("EditQuestionPage.tsx") ||
    file.includes("QuestionBankModal.tsx")
  ) {
    return;
  }

  // Replace {currentQuestion.question_text}
  if (content.includes("{currentQuestion.question_text}")) {
    content = content.replace(
      /\{currentQuestion\.question_text\}/g,
      '<RichTextDisplay content={currentQuestion.question_text || ""} />',
    );
    changed = true;
  }

  // Replace {question.question_text} with <RichTextDisplay ... /> BUT make sure we don't accidentally do it in an input value
  // e.g. value={question.question_text} -> value={<Rich...>} (BAD).
  // Let's replace only occurrences NOT directly following a `={`, which typically means an attribute.
  // Regex to find `{question.question_text}` NOT preceded by `value=` or `title=`
  const pattern = /(?<!value=|title=)\{question\.question_text\}/g;
  if (pattern.test(content)) {
    content = content.replace(
      pattern,
      '<RichTextDisplay content={question.question_text || ""} />',
    );
    changed = true;
  }

  // Also replace dangerouslySetInnerHTML={{ __html: question.question_text }} if there's any
  const patternDanger =
    /dangerouslySetInnerHTML=\{\{\s*__html:\s*(currentQuestion\.question_text|question\.question_text)\s*\}\}/g;
  if (patternDanger.test(content)) {
    // Wait, if it's on a div, that div will still be there.
    // We should just manually check that later. It wasn't found in my grep.
  }

  if (changed) {
    if (!content.includes("RichTextDisplay")) {
      let relativePath = path
        .relative(
          path.dirname(file),
          path.join(componentsDir, "Common", "RichTextDisplay"),
        )
        .replace(/\\/g, "/");
      if (!relativePath.startsWith(".")) {
        relativePath = "./" + relativePath;
      }
      content = `import RichTextDisplay from "${relativePath}";\n` + content;
    }
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
