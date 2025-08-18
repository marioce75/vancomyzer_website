import React from 'react';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

let mdReq;
try {
  // Webpack (CRA) context for markdown files
  // eslint-disable-next-line no-undef
  mdReq = require.context('../../content/clinical', false, /\.md$/);
} catch (e) {
  mdReq = null;
}

function parseFrontMatter(raw){
  const m = /^---[\s\S]*?---/.exec(raw || '');
  if (m) {
    const fm = m[0].replace(/^---|---$/g,'');
    const metaObj = Object.fromEntries(fm.split(/\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
      const [k, ...rest] = l.split(':'); return [k.trim(), rest.join(':').trim().replace(/^"|"$/g,'')];
    }));
    const body = raw.slice(m[0].length);
    return { meta: metaObj, body };
  }
  return { meta: null, body: raw };
}

function useArticle(slug, overrideText){
  const [text, setText] = React.useState('');
  const [meta, setMeta] = React.useState(null);
  React.useEffect(()=>{
    let canceled = false;
    async function run(){
      if (overrideText) {
        const { meta, body } = parseFrontMatter(overrideText);
        if (!canceled) { setMeta(meta); setText(body); }
        return;
      }
      if(!slug){ setText(''); setMeta(null); return; }
      const path = `./${slug}.md`;
      try {
        const resource = mdReq ? mdReq(path) : null;
        if (resource && typeof resource === 'string' && resource.startsWith('---')) {
          // In tests we might mock to raw content; no fetch needed
          const { meta, body } = parseFrontMatter(resource);
          if (!canceled) { setMeta(meta); setText(body); }
          return;
        }
        const url = resource || path;
        const resp = await fetch(url);
        const raw = await resp.text();
        const { meta, body } = parseFrontMatter(raw);
        if (!canceled) { setMeta(meta); setText(body); }
      } catch (e) {
        if (!canceled) { setMeta(null); setText('# Not found'); }
      }
    }
    run();
    return () => { canceled = true; };
  }, [slug, overrideText]);
  return { text, meta };
}

function Toc({ root }){
  const [headings, setHeadings] = React.useState([]);
  React.useEffect(()=>{
    if(!root) return;
    const hs = Array.from(root.querySelectorAll('h1, h2, h3'));
    setHeadings(hs.map(h=>({ id: h.id, text: h.textContent, level: Number(h.tagName.substring(1)) })));
  }, [root]);
  return (
    <Box sx={{ position: 'sticky', top: 16, maxHeight: '80vh', overflow: 'auto', pr: 2 }} aria-label="Article table of contents">
      {headings.map(h=> (
        <Typography key={h.id} variant="body2" sx={{ ml: (h.level-1)*2, cursor: 'pointer' }} onClick={()=>{ document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          {h.text}
        </Typography>
      ))}
    </Box>
  );
}

function addHeadingAnchors(container){
  const hs = Array.from(container.querySelectorAll('h1, h2, h3'));
  hs.forEach((h)=>{
    const id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    h.id = id;
    // Avoid duplicate button
    if (h.querySelector('[data-anchor-btn]')) return;
    const btn = document.createElement('button');
    btn.setAttribute('type','button');
    btn.setAttribute('data-anchor-btn','1');
    btn.setAttribute('aria-label','Copy link to section');
    btn.style.marginLeft = '8px';
    btn.style.border = 'none';
    btn.style.background = 'transparent';
    btn.style.cursor = 'pointer';
    btn.innerText = '#';
    btn.onclick = () => {
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard?.writeText(url);
    };
    h.appendChild(btn);
  });
}

export default function GuidelineArticle({ slug, overrideText }){
  const { text, meta } = useArticle(slug || '00_tutorial_overview', overrideText);
  const ref = React.useRef(null);

  React.useEffect(()=>{
    const root = ref.current; if(!root) return;
    addHeadingAnchors(root);
  }, [text]);

  const exportPdf = async () => {
    const el = ref.current; if(!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 72; // 1in margins
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    let y = 72; // top margin
    pdf.setFontSize(14);
    pdf.text(meta?.title || 'Clinical Article', 72, y);
    y += 16;
    pdf.setFontSize(10);
    if (meta?.updated) { pdf.text(`Updated ${meta.updated}`, 72, y); y += 12; }

    // paginate image
    let position = 0;
    while (position < imgHeight) {
      const sliceHeight = Math.min(pageHeight - y - 40, imgHeight - position);
      pdf.addImage(imgData, 'PNG', 72, y, imgWidth, sliceHeight, undefined, 'FAST');
      position += sliceHeight;
      if (position < imgHeight) { pdf.addPage(); y = 40; }
    }

    // footer page numbers
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.text(`${i}/${pages}`, pageWidth - 72, pageHeight - 24, { align: 'right' });
    }

    pdf.save(`${slug || 'article'}.pdf`);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '250px 1fr' }, gap: 2 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Toc root={ref.current} />
      </Box>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h5">{meta?.title || 'Clinical Article'}</Typography>
          <Tooltip title="Export to PDF">
            <IconButton aria-label="Export PDF" onClick={exportPdf} size="small">
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <div ref={ref}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </Box>
    </Paper>
  );
}
