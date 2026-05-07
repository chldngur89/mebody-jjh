const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/AuthScreen.tsx',
  'src/components/ConsentScreen.tsx',
  'src/components/QuestionnaireScreen.tsx'
];

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Change font sizes of inputs to 16px to prevent iOS zoom
  content = content.replace(/<input([\s\S]*?)style=\{\{([\s\S]*?)fontSize:\s*['"]1[0-5]px['"]([\s\S]*?)\}\}/g, "<input$1style={{$2fontSize: '16px'$3}}");

  // Also replace textarea if any
  content = content.replace(/<textarea([\s\S]*?)style=\{\{([\s\S]*?)fontSize:\s*['"]1[0-5]px['"]([\s\S]*?)\}\}/g, "<textarea$1style={{$2fontSize: '16px'$3}}");

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed inputs in ' + file);
});
