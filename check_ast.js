const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
const sourceFile = ts.createSourceFile('AdminPanel.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function getLineAndChar(pos) {
  return sourceFile.getLineAndCharacterOfPosition(pos);
}

const diagnostics = sourceFile.parseDiagnostics;
console.log('Parse diagnostics count:', diagnostics.length);
for (const diag of diagnostics) {
  const { line, character } = getLineAndChar(diag.start);
  console.log('Line ' + (line + 1) + ', Char ' + (character + 1) + ': ' + diag.messageText);
}
