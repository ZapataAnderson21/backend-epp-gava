import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getAllFiles(dir, fileList = []) {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name !== 'node_modules' && file.name !== 'dist' && file.name !== 'generated') {
        await getAllFiles(filePath, fileList);
      }
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function fixImports() {
  const srcDir = join(__dirname, 'src');
  const files = await getAllFiles(srcDir);
  
  let totalFixed = 0;
  
  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    let modified = false;
    
    // Fix relative imports that don't end with .js
    // Matches: from './something' or from "../something" but not from './something.js'
    const newContent = content.replace(
      /from\s+['"](\.\.[\/\\][^'"]+?)(?<!\.js)['"]/g,
      (match, path) => {
        modified = true;
        return `from '${path}.js'`;
      }
    ).replace(
      /from\s+['"](\.\/[^'"]+?)(?<!\.js)['"]/g,
      (match, path) => {
        modified = true;
        return `from '${path}.js'`;
      }
    );
    
    if (modified) {
      await writeFile(file, newContent, 'utf-8');
      totalFixed++;
      console.log(`✓ Fixed: ${file}`);
    }
  }
  
  console.log(`\n✅ Fixed ${totalFixed} files`);
}

fixImports().catch(console.error);
