import React from 'react';
import { Paper, Box, TextField, Chip, Typography, Stack } from '@mui/material';
import staticIndex from '../../content/clinical/index.json';

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

export default function GuidelinesIndex({ onSelect }){
  const [q, setQ] = React.useState('');
  const [tag, setTag] = React.useState('all');
  const [articles, setArticles] = React.useState(staticIndex);

  React.useEffect(()=>{
    // Try to build index at runtime from markdown files
    try {
      // eslint-disable-next-line no-undef
      const ctx = require.context('../../content/clinical', false, /\.md$/);
      const keys = ctx.keys();
      const list = keys.map((k)=>{
        const raw = ctx(k);
        // If webpack inlines URL, fetch text; if mock provides raw, use directly
        const contentPromise = typeof raw === 'string' && raw.startsWith('---') ? Promise.resolve(raw) : fetch(raw).then(r=>r.text()).catch(()=> '');
        return contentPromise.then((content)=>{
          const { meta, body } = parseFrontMatter(content);
          const slug = k.replace(/^\.\//,'').replace(/\.md$/,'');
          const preview = (body || '').split(/\n/).map(s=>s.trim()).find(Boolean) || '';
          const tags = Array.isArray(meta?.tags) ? meta.tags : (meta?.tags ? String(meta.tags).split(',').map(s=>s.trim()) : []);
          return { slug, title: meta?.title || slug, tags, updated: meta?.updated || '', preview };
        });
      });
      Promise.all(list).then((arr)=>{
        if (Array.isArray(arr) && arr.length) setArticles(arr);
      });
    } catch (e) {
      // Fallback to static index.json
      setArticles(staticIndex);
    }
  }, []);

  const tags = React.useMemo(()=> Array.from(new Set(articles.flatMap(a=>a.tags))).sort(), [articles]);
  const filtered = React.useMemo(()=>{
    const s = q.trim().toLowerCase();
    return articles.filter(a=> (tag==='all' || a.tags.includes(tag)) && (!s || a.title.toLowerCase().includes(s) || a.preview.toLowerCase().includes(s)));
  }, [q, tag, articles]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="Search" value={q} onChange={(e)=>setQ(e.target.value)} sx={{ minWidth: 240 }} inputProps={{ 'aria-label': 'Search guidelines' }} />
        <Stack direction="row" spacing={1} aria-label="Filter by tag">
          <Chip label="All" color={tag==='all'?'primary':'default'} onClick={()=>setTag('all')} clickable />
          {tags.map(t=> <Chip key={t} label={t} color={tag===t?'primary':'default'} onClick={()=>setTag(t)} clickable />)}
        </Stack>
      </Box>
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {filtered.map(a=> (
          <Paper key={a.slug} variant="outlined" sx={{ p: 2, cursor: 'pointer' }} role="button" tabIndex={0} onClick={()=>onSelect?.(a.slug)} onKeyDown={(e)=>{ if(e.key==='Enter') onSelect?.(a.slug); }} aria-label={`Open article ${a.title}`}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{a.title}</Typography>
            {a.updated ? <Typography variant="caption" color="text.secondary">Updated {a.updated}</Typography> : null}
            <Typography variant="body2" sx={{ mt: 1 }}>{a.preview}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {a.tags.map(t=> <Chip key={t} size="small" label={t} />)}
            </Box>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
}
