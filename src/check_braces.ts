import fs from "fs";
import * as ts from "typescript";
import path from "path";

const filePath = path.join(process.cwd(), "src/components/Dashboard.tsx");
const sourceText = fs.readFileSync(filePath, "utf-8");

const sourceFile = ts.createSourceFile(
  filePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true
);

const diagnostics = ts.createProgram([filePath], { noEmit: true }).getSemanticDiagnostics();
const syntactics = ts.createProgram([filePath], { noEmit: true }).getSyntacticDiagnostics();

console.log("Syntactic errors:");
for (const diag of syntactics) {
  if (diag.file) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start || 0);
    console.log(`[Line ${line + 1}, Char ${character + 1}]: ${ts.flattenDiagnosticMessageText(diag.messageText, "\n")}`);
  }
}
