import { deriveTemplate } from './server/services/template-deriver.ts';
import fs from 'fs';
const masterLatex = fs.readFileSync('context/master-cv.tex', 'utf-8');
const template = deriveTemplate(masterLatex);
console.log(template);
