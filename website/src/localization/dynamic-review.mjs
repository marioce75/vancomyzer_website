import fs from "node:fs";
import ts from "typescript";
for(const [repo,loc] of [['.', 'src/localization']]){
 const cfg=ts.readConfigFile(repo+'/tsconfig.json',ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(cfg.config,ts.sys,repo),program=ts.createProgram(parsed.fileNames,{...parsed.options,noEmit:true}),checker=program.getTypeChecker(),catalog=JSON.parse(fs.readFileSync(repo+'/'+loc+'/messages.json')),coverage=JSON.parse(fs.readFileSync(repo+'/'+loc+'/coverage.json'));let output=[];
 const selected=[...coverage.expressions.map(x=>({...x,surface:'child',code:x.expression})),...coverage.bindings.filter(x=>x.dynamic).map(x=>({...x,surface:'bound',code:x.text}))];
 for(const row of selected){const sf=program.getSourceFile(repo+'/'+row.file);let node,distance=Infinity;function find(n){if(ts.isJsxExpression(n)&&n.expression&&[n.getText(sf),n.expression.getText(sf)].includes(row.code)){const delta=Math.abs(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1-row.line);if(delta<distance){node=n.expression;distance=delta;}}ts.forEachChild(n,find)}if(sf)find(sf);let category='unresolved data flow — contextual review',detail='Unknown or open string domain; not evidence of untranslated copy.',finite=[];
 if(node){let type=checker.getTypeAtLocation(node),types=type.isUnion()?type.types:[type];detail=checker.typeToString(type).slice(0,300);const meaningful=types.filter(t=>!(t.flags&(ts.TypeFlags.Undefined|ts.TypeFlags.Null|ts.TypeFlags.Never)));finite=meaningful.filter(t=>t.isStringLiteral()).map(t=>t.value);
 if(meaningful.length&&meaningful.every(t=>t.flags&(ts.TypeFlags.NumberLike|ts.TypeFlags.BooleanLike)))category='typed numeric/boolean presentation';
 else if(meaningful.length&&finite.length===meaningful.length){let words=finite.filter(x=>/[A-Za-z]{2}/.test(x));category=words.length===0?'literal spacing/symbol invariant':words.every(x=>catalog[x])?'finite copy catalogued':'finite domain needs review';}
 else if(/<\w|<>/.test(row.code))category='structural JSX — descendants inventoried separately';
 else if(row.code==='children'||/^(?:sidebar|left|right|advisories|current.content)$/.test(row.code))category='React content slot — source children reviewed separately';
 else if(/locale ===|\bt\(|translate|countryNames\.of/.test(row.code))category='explicit localization expression';
 else if(row.tag==='style')category='CSS invariant';
 else if(/(?:citation|\.doi|\.source\.citation|MODEL.*VERSION|PN_VERSION|CATALOG.*|CAP_MODEL_VERSION|\.equation|equations\.|\.formula|\.engineManifest|\.engine_manifest|CHECKS_RUN_ON|LIPID_LABEL_RULES_VERSION)/.test(row.code))category='scientific citation/formula/version identifier';
 else if(/(?:full_name|username|institution_name|institutionName|userName|\.email|\.credentials|\.signer_|\.billing_email|\.supervisor_|\.phone|\.hospital_name|\.contact_name|\.study_id|\.case_id|\.source_identifier|\.path|miDir|varName)/.test(row.code))category='user/source data or technical identifier — preserved';
 else if(/(?:CommunityHospitalCover|EvaluationFrameworkDiagram|ComparisonTable|MarketOpportunity|PlatformVision|Principles|ProblemSection|SolutionSection)/.test(row.file))category='unpublished or unused component';
 }
 if(category==='finite domain needs review') {
  if(row.tag==='style')category='CSS invariant';
  else if(/citation|\.doi|BAI_2025_REFERENCE.source|m.comparator/.test(row.code))category='verified citation or program identity';
  else if(/CAP_MODEL_VERSION|PN_VERSION/.test(row.code))category='version identifier';
  else if(/LABS\[key\]\[1\]|m.label|row.key/.test(row.code))category='verified scientific symbol or unit';
  else if(/m.formula|ffmEquation/.test(row.code))category='formula invariant';
 }
 if(category==='unresolved data flow — contextual review') {
  if(row.surface==='bound')category='localized open text — runtime/source domain review';
  else if(/^(?:Element|false \| Element)$/.test(detail))category='React element/helper — descendant copy separately reviewed';
  else if(/^(?:frontmatter.author|s.vendor|p.supplier|product.name|email|tier.name|upgradeTier.name)$/.test(row.code))category='verified author/vendor/user/product identity';
  else if(/^(?:unit|unitLabel|field.unit|row.unit)$/.test(row.code))category='display unit — retain source';
  else if(/\.toFixed\(|\bfmt\(|\? `(?:\$\{[^}]+\} mg|q\$\{)|^i > 0 &&/.test(row.code))category='formatted numeric or punctuation expression';
  else if(row.file==='app/og/[image]/route.tsx')category='localized generated image copy — tested';
  else if(row.code==='heading.text'&&row.file==='components/blog/TableOfContents.tsx')category='localized MDX heading — article tests and browser anchors';
  else if(row.code==='clinicalNote'&&row.file.endsWith('CalculatorWorkspace.tsx'))category='localized generated note — existing report adapter';
 }

 if(category==='unresolved data flow — contextual review') {
  if(row.file.includes('AnimatedCounter')) category='unused legacy numeric counter';
  else if(/^(?:r.cite|LAB_RECENCY_POLICY.version|colin2021Pmid|loadedCase.reference|modelLabel)$/.test(row.code))category='source-traced citation/model/version';
  else if(/^(?:glyph\[kind\]|GLYPH\[severity\]|glyph|item.icon)$/.test(row.code))category='source-traced icon/glyph';
  else if(row.file.includes('PNCalculator')&&row.code==='value')category='source-traced formatted PN quantity';
  else if(/(?:market-intelligence)/.test(row.file)&&/^(?:p.text|drug|name|region|c.competitor_name|source.source|data.aiReport.executive_brief \|\| "—"|o.priority|a|g\.|idea\.|r\.(?:recommendation|timeline|rationale|severity|risk|evidence|mitigation))/.test(row.code))category='third-party or generated analysis content — verbatim, not UI catalog copy';
  else if(/^(?:app.notes|app.program_name \?\? "—"|app.expected_completion \?\? "—"|a.contact_title|a.current_monitoring \?\? "—"|grant.reason|p.user.name \?\? "—"|file.name|row.user_email)$/.test(row.code))category='source-traced user-entered content — verbatim';
  else if(/^(?:cyclePrice.amount|r.load|r.ignored|r.entered|phase.days|displayDose|s.value)$/.test(row.code))category='source-traced numeric/price/range display';
  else if(/^(?:adminDate|adminTime|coverage.generated|trialEnd)$/.test(row.code))category='recorded timestamp — existing format retained';
  else if(row.file.endsWith('DisclaimerModal.tsx'))category='translated legal text passed through brand-link formatter';
  else if(row.code==='isBand && metricsSlot')category='React metrics slot';
 }

 if(category==='unresolved data flow — contextual review') {
  if(row.file.includes('transparent-dosing/'))category='published platform or test-section identity — source spelling retained';
  else if(/^(?:row.plan_tier|row.template_version \?\? "—"|row.tier_at_time \?\? "—"|p.id|u.role|e.action|e.severity|health.db|health\?\.version \?\? "0.1.0"|m.event|a.tenant_id.*)$/.test(row.code))category='technical audit/schema identifier — retained for traceability';
  else if(/^(?:p.effective|p.review|p.convertedAt.*)$/.test(row.code))category='recorded date — original format retained';
  else if(/^(?:a.bed_count.*|p.aucTargetAttainmentRate.*|card.value)$/.test(row.code))category='source-traced numeric display';
  else if(row.code==='source.name')category='external source brand';
  else if(row.code==='primary'||row.code==='v')category='mixed React/user-data slot — preserve data, caller copy reviewed separately';
  else if(row.code==='value'&&/ReferralCard|PrimaryMetricsCard/.test(row.file))category='source-traced metric/price quantity';
  else if(row.code.startsWith('e.ip_address'))category='user/source address — verbatim';
 }
 output.push({file:row.file,line:row.line,surface:row.surface,expression:row.code,category,type:detail,...(finite.length?{finiteValues:finite,uncatalogued:finite.filter(x=>/[A-Za-z]{2}/.test(x)&&!catalog[x])}:{})});
 }
 const counts={};for(const x of output)counts[x.category]=(counts[x.category]||0)+1;
 const report={notice:'Static type/AST triage, not runtime or complete translation coverage. Records include overlapping structural parents and children. Open string domains remain unresolved; identifiers require contextual confirmation. No external/private data read.',counts,records:output};fs.writeFileSync(repo+'/'+loc+'/dynamic-review.json',JSON.stringify(report,null,2)+'\n');console.log(repo,counts);console.log('FINITE MISSING',JSON.stringify([...new Set(output.flatMap(x=>x.uncatalogued||[]))]));
}
