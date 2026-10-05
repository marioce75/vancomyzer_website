/* Source inventory, not a claim of complete translation coverage.
 * Run from the application root. --strict fails on unresolved candidates.
 * Runtime/API/generated-report content still needs manual and browser review.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const catalog = JSON.parse(fs.readFileSync(new URL('./messages.json', import.meta.url), 'utf8'));
const prefix = fs.existsSync('src/app') ? 'src/' : '';
const pending = [], bindings = [], invariant = [], expressions = [], articles = [], files = [];
const dirs = prefix ? ['src/app', 'src/components', 'src/lib'] : ['app', 'components', 'lib', 'content'];
const entities={ge:'≥',le:'≤',times:'×',minus:'−',mdash:'—',ndash:'–',bull:'•',middot:'·',copy:'©',trade:'™',nbsp:'\u00a0',amp:'&',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',gt:'>',lt:'<',quot:'"',apos:"'"};
const decode=s=>s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi,(m,k)=>k.startsWith('#x')?String.fromCodePoint(parseInt(k.slice(2),16)):k.startsWith('#')?String.fromCodePoint(+k.slice(1)):entities[k]??m);
// Explicitly invariant source tokens only. Never whitelist prose or clinical claims.
const invariants=new Set(['Dōsys','Dōsys Health LLC','Vancomyzer™','Mario Cardenas','Mario Cardenas, PharmD, MBA','McAllen, Texas','©','doi:','CL','SCr','mEq/L (','mmol/L)','mmol/L','kcal','mg·h/L','AUC₂₄ ≈','AUC₂₄ 400–600','2020 ASHP / IDSA / PIDS / SIDP','Abdelmessih 2022 · OR 0.625','PrecisePK','InsightRX','DoseMeRx','VancoCalc','82 kg','1.2 mg/dL','487 mg·h/L']);
function candidate(item){
 if(invariants.has(item.text)||/^(?:https?:\/\/)?(?:[\w-]+\.)+(?:com|health|org)(?:\/\S*)?$/.test(item.text)||/^[\w.+-]+@[\w.-]+\.[A-Za-z]+$/.test(item.text)||/^doi:10\./.test(item.text)||/^Colin PJ, et al\. Clin Pharmacokinet\./.test(item.text)||/^Rybak MJ, et al\. Am J Health-Syst Pharm\./.test(item.text)) invariant.push({...item,reason:'Untranslated proper name, citation, address, symbol or unit'});
 else pending.push(item);
}
function scan(dir) {
 if(!fs.existsSync(dir))return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['__tests__','node_modules'].includes(entry.name))scan(file);continue;}
  if(!/\.(tsx?|mdx)$/.test(file)||file.includes('/api/'))continue;
  files.push(file);
  if(file.endsWith('.mdx')){
   if(file.startsWith('content/blog/')&&!/content\/blog\/(es|fr)\//.test(file)){
    const translations=['es','fr'].map(locale=>({locale,file:path.join(path.dirname(file),locale,path.basename(file)),exists:fs.existsSync(path.join(path.dirname(file),locale,path.basename(file)))}));
    articles.push({file,translations,status:translations.every(x=>x.exists)?'Complete prose files; integrity tested separately; bilingual clinical review pending':'Missing translation'});
    if(!translations.every(x=>x.exists))pending.push({file,kind:'MDX',text:'Missing full article translation'});
   }else if(!/content\/blog\/(es|fr)\//.test(file))pending.push({file,kind:'Unpublished MDX',text:'Not published; untranslated draft outside current public article set'});
   continue;
  }
  const source=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const localizedImageAlias=/import\s*\{\s*LocalizedImage as Image\s*\}/.test(source);
  function visit(node){
   const location={file,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1};
   if(ts.isJsxSelfClosingElement(node)&&['LocalizedText','LocalizedGeneratedText'].includes(node.tagName.getText(sf))){
    const rawValue=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)==='text')?.initializer;
    const value=rawValue&&ts.isJsxExpression(rawValue)?rawValue.expression:rawValue;
    if(value&&ts.isStringLiteral(value))bindings.push({...location,text:value.text,translated:!!catalog[value.text]});
    else bindings.push({...location,text:value?.getText(sf),dynamic:true});
   }
   if(ts.isJsxText(node)){
    const text=decode(node.text.replace(/\s+/g,' ').trim());
    if(/[A-Za-z]{2}/.test(text))candidate({...location,kind:'Unbound JSX text',text});
   }
   if(ts.isJsxExpression(node)&&node.expression&&ts.isJsxElement(node.parent)){
    const expr=node.expression;
    if(!ts.isJsxElement(expr)&&!ts.isJsxSelfClosingElement(expr)&&!ts.isCallExpression(expr)&&!ts.isNumericLiteral(expr)) expressions.push({...location,tag:node.parent.openingElement.tagName.getText(sf),expression:expr.getText(sf),notice:'May be numeric, invariant, rich content, or untranslated data; not counted as covered'});
   }
   if(ts.isJsxAttribute(node)&&node.initializer){
    const tag=node.parent.parent.tagName?.getText(sf)??'',name=node.name.getText(sf);
    const recordProp=(['PageHeader','Record','RecordSection'].includes(tag)&&['title','kicker','lede','label','note'].includes(name)) || (tag==='Advisory'&&['title','summary'].includes(name)) || (tag==='InputSection'&&['title','hint'].includes(name));
    const descriptive=['aria-label','alt','title','placeholder'].includes(name);
    if(recordProp||descriptive){
     if(tag==='Image'&&name==='placeholder')return; // next/image loading mode, not user prose
     const bound=recordProp||tag==='ClinicalNumberInput'||tag.startsWith('Localized')||(tag==='Image'&&localizedImageAlias);
     if(ts.isStringLiteral(node.initializer)){
      const item={...location,kind:recordProp?'Shared component text':'Accessible attribute',text:node.initializer.text};
      if(bound){if(invariants.has(item.text))invariant.push({...item,reason:'Proper name or unit'});else bindings.push({...item,translated:!!catalog[item.text]});}
      else candidate({...item,kind:'Unbound '+item.kind});
     }else if(recordProp)bindings.push({...location,text:node.initializer.getText(sf),dynamic:true,kind:'Shared component text'});
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(sf);
 }
}
dirs.forEach(scan);
const summary={catalogEntries:Object.keys(catalog).length,files:files.length,staticBindings:bindings.filter(x=>!x.dynamic).length,dynamicBindingsRequiringRuntimeAudit:bindings.filter(x=>x.dynamic).length,unboundCandidates:pending.length,invariantCandidates:invariant.length,unreviewedChildExpressions:expressions.length,publishedArticlesWithBothTranslations:articles.filter(x=>x.translations.every(y=>y.exists)).length,missingBoundTranslations:bindings.filter(x=>!x.dynamic&&!x.translated).length};
fs.writeFileSync(path.join(prefix,'localization','coverage.json'),JSON.stringify({notice:'INCOMPLETE. Explicit bindings, unbound static text, and unreviewed child expressions are inventoried separately. No percentage is claimed. Dynamic API messages, report exports, imported datasets, metadata and rich text also require review. Article integrity is checked by articles.test.ts in Dosys. Citation language is retained. No clinical or legal review is implied.',summary,files,articles,bindings,pending,invariant,expressions},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--strict')&&(pending.length||summary.missingBoundTranslations||expressions.length||summary.dynamicBindingsRequiringRuntimeAudit))process.exitCode=1;
