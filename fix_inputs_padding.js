const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/ConsentScreen.tsx',
  'src/components/QuestionnaireScreen.tsx',
  'src/components/CodeDetailsScreen.tsx',
  'src/components/MyPageScreen.tsx',
  'src/components/CheckoutScreen.tsx'
];

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Add scroll padding to main scrolling container
  // We look for overflowY: 'auto' and inject paddingBottom
  content = content.replace(/overflowY:\s*['"]auto['"],([\s\S]*?)padding:\s*['"][^'"]+['"],\n/g, (match) => {
    if (content.includes('paddingBottom:')) return match; // skip if already has
    return match + "            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',\n";
  });

  // Add onFocus to input/textarea if not exists
  content = content.replace(/(<(?:input|textarea)[^>]*?onChange=\{[^>]*?\})([^>]*?>)/g, (match, p1, p2) => {
    if (match.includes('onFocus={')) return match;
    return p1 + "\n                      onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}" + p2;
  });

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed padding and onFocus in ' + file);
});
