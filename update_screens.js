const fs = require('fs');
const path = require('path');

const files = [
  'src/components/AuthScreen.tsx',
  'src/components/LandingScreen.tsx',
  'src/components/ConsentScreen.tsx',
  'src/components/DiagnosisIntroScreen.tsx',
  'src/components/QuestionnaireScreen.tsx',
  'src/components/AnalyzingScreen.tsx',
  'src/components/ResultScreen.tsx',
  'src/components/CodePlanScreen.tsx',
  'src/components/CommonGuideScreen.tsx',
  'src/components/CodeDetailsScreen.tsx',
  'src/components/MyPageScreen.tsx',
  'src/components/MembershipScreen.tsx',
  'src/components/CheckoutScreen.tsx',
  'src/components/codePlanShared.tsx'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Skip if already processed
  if (content.includes('useMediaQuery(')) {
     // Wait, let's process it anyway but ensure we don't duplicate import
  }

  // Add import if not exists
  if (!content.includes('useMediaQuery')) {
    const importMatch = content.match(/import.*?['"].*?['"];?\n/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      content = content.replace(lastImport, lastImport + "import { useMediaQuery } from '../utils/useMediaQuery';\n");
    } else {
      content = "import { useMediaQuery } from '../utils/useMediaQuery';\n" + content;
    }
  }

  // Find component function definition to inject hook
  // Regex to find: export function ComponentName(props) {
  const funcRegex = /export\s+function\s+([A-Za-z0-9_]+)\s*\((.*?)\)\s*\{/g;
  content = content.replace(funcRegex, (match, name, args) => {
    // If it's a known component
    if (!content.includes(`const isDesktopMockup = useMediaQuery`)) {
      return `${match}\n  const isDesktopMockup = useMediaQuery('(min-width: 768px)');\n`;
    }
    return match;
  });

  // Replace height: '844px' -> minHeight: '100dvh'
  // Replace borderRadius: '32px' -> borderRadius: isDesktopMockup ? '32px' : 0
  content = content.replace(/height:\s*['"]844px['"]/g, "minHeight: '100dvh'");
  content = content.replace(/borderRadius:\s*['"]32px['"]/g, "borderRadius: isDesktopMockup ? '32px' : 0");

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Updated ' + file);
});
