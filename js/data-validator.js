export const canonical = value => String(value ?? '').normalize('NFC').replace(/\uFE0F/g, '').replace(/\s+/g, ' ').trim();
export const isEmpty = value => value == null || canonical(value) === '' || (Array.isArray(value) && !value.length);

export function mapHeaders(headers, schema) {
  if (!Array.isArray(headers) || headers.length !== schema.columnCount) throw new Error('SCHEMA_COLUMNS');
  const warnings = [], indexes = {}, used = new Set();
  for (const field of schema.fields) {
    const index = headers.findIndex(h => [field.header, ...(field.aliases || [])].some(a => canonical(a) === canonical(h)));
    if (index < 0 || used.has(index)) throw new Error('SCHEMA_HEADERS');
    indexes[field.id] = index; used.add(index);
    if (headers[index] !== field.header) warnings.push({code:'HEADER_ALIAS',field:field.id,column:field.column});
  }
  return {indexes,warnings};
}

// Parse multi-select against the actual catalog. Commas inside an option are not separators.
function multiple(raw, options) {
  if (Array.isArray(raw)) return raw;
  let rest = canonical(raw), found = [];
  const candidates = options.map(value => ({value,key:canonical(value)})).sort((a,b)=>b.key.length-a.key.length);
  while (rest) {
    const item = candidates.find(o => rest === o.key || rest.startsWith(o.key+', ') || rest.startsWith(o.key+'; '));
    if (!item) return null;
    found.push(item.value); rest = rest.slice(item.key.length).replace(/^[,;]\s*/, '');
  }
  return found;
}

export function validateField(raw, field, prior = {}) {
  const base = {raw:raw ?? null,value:null,status:'MISSING'};
  if (field.dependency) {
    const parent = prior[field.dependency.field];
    if (parent?.status === 'VALID' && canonical(parent.value) !== canonical(field.dependency.equals))
      return {...base,status:'NOT_APPLICABLE',warning:isEmpty(raw)?null:'VALUE_WHEN_NOT_APPLICABLE'};
    if (parent?.status !== 'VALID') return {...base,status:isEmpty(raw)?'MISSING':'INVALID',warning:'DEPENDENCY_UNKNOWN'};
  }
  if (isEmpty(raw)) return base;
  if (field.notObserved?.some(v=>canonical(v)===canonical(raw))) return {...base,status:'NOT_OBSERVED'};
  if (field.type === 'scale' || field.type === 'integer') {
    const clean = canonical(raw), number = /^\d+(?:\.0+)?$/.test(clean) ? Number(clean) : NaN;
    return Number.isSafeInteger(number) && number >= field.min && (field.max == null || number <= field.max)
      ? {...base,value:number,status:'VALID'} : {...base,status:'INVALID',warning:'INVALID_NUMBER'};
  }
  if (field.type === 'text') return {...base,value:canonical(raw),status:'VALID'};
  const options = field.options || [];
  const inputs = field.type === 'multi' ? multiple(raw,options) : [raw];
  if (!inputs) return {...base,status:'INVALID',warning:'INVALID_OPTION'};
  const values = inputs.map(v=>options.find(o=>canonical(v)===canonical(o)));
  if (values.some(v=>v===undefined)) return {...base,status:'INVALID',warning:'INVALID_OPTION'};
  return {...base,value:field.type==='multi'?[...new Set(values)]:values[0],status:'VALID'};
}
