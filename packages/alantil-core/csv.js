export function normalizeGoogleSheetCsvUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.includes('output=csv') || value.includes('out:csv') || value.includes('format=csv')) return value;
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return value;
  const gid = value.match(/[?&#]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
}

export function parseCsvRows(text) {
  const matrix = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  const source = String(text || '');
  for (let index=0; index<source.length; index+=1) {
    const char=source[index];
    const next=source[index+1];
    if (inQuotes) {
      if (char === '"' && next === '"') { current += '"'; index += 1; }
      else if (char === '"') inQuotes = false;
      else current += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(current); current=''; }
    else if (char === '\n') { row.push(current); matrix.push(row); row=[]; current=''; }
    else if (char !== '\r') current += char;
  }
  if (current.length || row.length) { row.push(current); matrix.push(row); }
  if (!matrix.length) return { headers: [], rows: [] };
  const headers=matrix[0].map((header,index)=>{const value=String(header||'').trim().toLowerCase();return index===0?value.replace(/^\uFEFF/,''):value;});
  const rows=matrix.slice(1).filter((columns)=>columns&&!columns.every((cell)=>!String(cell||'').trim())).map((columns)=>{const object={};headers.forEach((header,index)=>{if(header)object[header]=columns[index]??'';});return object;});
  return { headers, rows };
}
