from __future__ import annotations
import io, json, os, re, sqlite3, uuid
from pathlib import Path
from typing import Any
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

PROJECT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_DIR / 'frontend'
DATA_DIR = Path(__file__).resolve().parent / 'data'
DATA_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
app = FastAPI(title='Finance Analytics Backend', version='1.1.0', description='File-based analytics API; no database required.')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=False, allow_methods=['*'], allow_headers=['*'])

SUPPORTED = {'.csv','.tsv','.txt','.xlsx','.xlsm','.json','.xml','.parquet','.avro','.sql','.db','.sqlite'}

def clean_name(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9_.-]+', '_', Path(name).name)[:150] or 'dataset'

def read_sql_dump(raw: bytes) -> pd.DataFrame:
    # SQL files are executed only in an isolated in-memory SQLite database.
    # Non-SQLite dialect dumps may need to be exported to CSV first.
    text = raw.decode('utf-8-sig', errors='replace')
    conn = sqlite3.connect(':memory:')
    try:
        conn.executescript(text)
        tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", conn)
        if tables.empty:
            raise ValueError('The SQL file did not create any tables. Export the query result to CSV, or provide a SQLite-compatible CREATE/INSERT script.')
        frames = []
        for table in tables['name'].tolist():
            safe = table.replace('"', '""')
            frame = pd.read_sql_query(f'SELECT * FROM "{safe}" LIMIT 250000', conn)
            if not frame.empty:
                frame.insert(0, '_source_table', table)
                frames.append(frame)
        if not frames:
            raise ValueError('No rows were found in the SQL tables.')
        return pd.concat(frames, ignore_index=True, sort=False)
    finally:
        conn.close()

def read_dataset(filename: str, raw: bytes) -> pd.DataFrame:
    ext = Path(filename).suffix.lower()
    bio = io.BytesIO(raw)
    if ext == '.csv': return pd.read_csv(bio, low_memory=False)
    if ext in {'.tsv', '.txt'}: return pd.read_csv(bio, sep='\t' if ext == '.tsv' else None, engine='python', low_memory=False)
    if ext in {'.xlsx', '.xlsm'}: return pd.read_excel(bio)
    if ext == '.json':
        try: return pd.read_json(bio, orient='records')
        except ValueError:
            bio.seek(0); return pd.json_normalize(json.load(bio))
    if ext == '.xml': return pd.read_xml(bio)
    if ext == '.parquet': return pd.read_parquet(bio)
    if ext == '.avro':
        try:
            from fastavro import reader
        except ImportError as exc:
            raise ValueError('Avro support needs fastavro. Install it with: pip install fastavro') from exc
        return pd.DataFrame(list(reader(bio)))
    if ext == '.sql': return read_sql_dump(raw)
    if ext in {'.db', '.sqlite'}:
        conn = sqlite3.connect(f'file:{DATA_DIR / (uuid.uuid4().hex + ".sqlite")}?mode=memory&cache=shared', uri=True)
        # Load the uploaded SQLite file into a temporary in-memory connection.
        src = DATA_DIR / (uuid.uuid4().hex + '.sqlite')
        src.write_bytes(raw)
        try:
            disk = sqlite3.connect(str(src))
            tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", disk)
            if tables.empty: raise ValueError('No tables were found in this SQLite file.')
            pieces=[]
            for table in tables['name'].tolist():
                safe=table.replace('"','""'); f=pd.read_sql_query(f'SELECT * FROM "{safe}" LIMIT 250000', disk); f.insert(0,'_source_table',table); pieces.append(f)
            return pd.concat(pieces, ignore_index=True, sort=False)
        finally:
            disk.close(); conn.close(); src.unlink(missing_ok=True)
    raise ValueError(f'Unsupported file format: {ext or "no extension"}. Supported: {", ".join(sorted(SUPPORTED))}')

def norm(s: Any) -> str:
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def find_col(df: pd.DataFrame, patterns: list[str]) -> str | None:
    cols = list(df.columns)
    for p in patterns:
        for c in cols:
            if p in norm(c): return c
    return None

def numeric(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series): return pd.to_numeric(series, errors='coerce')
    s = series.astype(str).str.strip().str.replace(',', '', regex=False).str.replace(r'^[₹$€£]\s*', '', regex=True)
    s = s.str.replace(r'^\((.*)\)$', r'-\1', regex=True)
    return pd.to_numeric(s, errors='coerce')

def analyze(df: pd.DataFrame, filename: str, stored_name: str | None = None) -> dict[str, Any]:
    if df.empty: raise ValueError('The dataset has headers but no data rows.')
    df = df.copy()
    rev_col = find_col(df, ['revenue','salesamount','sales','turnover','income'])
    cost_col = find_col(df, ['totalcost','expense','expenses','cost','spend','cogs'])
    profit_col = find_col(df, ['profit','netincome','earnings','ebit'])
    qty_col = find_col(df, ['quantity','units','volume','qty'])
    date_col = find_col(df, ['date','timestamp','period','month'])
    metrics = {}
    for key, col in [('revenue', rev_col), ('cost', cost_col), ('profit', profit_col), ('quantity', qty_col)]:
        if col:
            vals = numeric(df[col]); metrics[key] = {'column': str(col), 'valid_values': int(vals.notna().sum()), 'total': float(vals.sum(skipna=True)), 'average': float(vals.mean()) if vals.notna().any() else None}
    if rev_col and cost_col:
        revenue = numeric(df[rev_col]); cost = numeric(df[cost_col]); actual_profit = numeric(df[profit_col]) if profit_col else revenue - cost
        total_revenue=float(revenue.sum(skipna=True)); total_cost=float(cost.sum(skipna=True)); total_profit=float(actual_profit.sum(skipna=True))
        # Approximate variable cost ratio based on total observed cost/revenue; fixed costs are user-editable.
        variable_ratio = min(max(total_cost / total_revenue, 0), 0.99) if total_revenue > 0 else None
        break_even = None
        if variable_ratio is not None and variable_ratio < 1:
            break_even = {'revenue': 0.0, 'contribution_margin_ratio': round(1-variable_ratio, 6), 'method': 'Initial estimate assumes all observed costs vary with revenue; set fixed costs to calculate an operational break-even.'}
        metrics['profit_and_loss'] = {'revenue':total_revenue,'cost':total_cost,'profit':total_profit,'profit_margin_pct':(total_profit/total_revenue*100 if total_revenue else None),'break_even':break_even}
    if rev_col and cost_col:
        # Provide an explicit editable-input calculation endpoint; this data-derived response is only a baseline.
        metrics['break_even_inputs'] = {'revenue_column':str(rev_col),'cost_column':str(cost_col),'revenue_total':float(numeric(df[rev_col]).sum(skipna=True)),'cost_total':float(numeric(df[cost_col]).sum(skipna=True)),'note':'Provide fixed_costs and variable_cost_ratio to /api/break-even for a meaningful break-even calculation.'}
    duplicates = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    columns = [{'name':str(c),'dtype':str(df[c].dtype),'missing':int(df[c].isna().sum()),'unique':int(df[c].nunique(dropna=True))} for c in df.columns]
    sample = json.loads(df.head(100).where(pd.notna(df.head(100)), None).to_json(orient='records', date_format='iso'))
    return {'ok':True,'dataset_id':stored_name,'filename':filename,'rows':int(len(df)),'columns':int(len(df.columns)),'column_names':[str(c) for c in df.columns],'column_profile':columns,'quality':{'missing_cells':missing_cells,'duplicate_rows':duplicates,'completeness_pct':round((1-missing_cells/(len(df)*len(df.columns)))*100,2) if len(df)*len(df.columns) else 0},'detected_fields':{'date':str(date_col) if date_col else None,'revenue':str(rev_col) if rev_col else None,'cost':str(cost_col) if cost_col else None,'profit':str(profit_col) if profit_col else None,'quantity':str(qty_col) if qty_col else None},'metrics':metrics,'sample_rows':sample}



# SQL Query Editor API: queries are read-only and run against an isolated in-memory
# SQLite connection. The uploaded source file is never modified by a query.
def _load_dataset_into_sqlite(dataset_id: str) -> tuple[sqlite3.Connection, list[str]]:
    matches = list(DATA_DIR.glob(f'{dataset_id}_*'))
    if not matches:
        raise HTTPException(status_code=404, detail='Dataset not found. Upload a dataset first.')
    path = matches[0]
    raw = path.read_bytes()
    conn = sqlite3.connect(':memory:')
    try:
        if path.suffix.lower() == '.sql':
            script = raw.decode('utf-8-sig', errors='replace')
            conn.executescript(script)
        elif path.suffix.lower() in {'.db', '.sqlite'}:
            src = sqlite3.connect(f'file:{path.resolve().as_posix()}?mode=ro', uri=True)
            try:
                src.backup(conn)
            finally:
                src.close()
        else:
            frame = read_dataset(path.name.split('_', 1)[1], raw)
            # Dataset names are quoted by pandas; the default query table is `dataset`.
            frame.to_sql('dataset', conn, index=False, if_exists='replace')
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]
        if not tables:
            conn.close()
            raise HTTPException(status_code=422, detail='This dataset contains no queryable tables.')
        return conn, tables
    except Exception:
        conn.close()
        raise

def _read_only_sql_statements(script: str) -> list[str]:
    # Parse statements using SQLite's own completeness rules. Only SELECT/CTE and
    # EXPLAIN statements are accepted, so scripts cannot mutate files or schema.
    statements, current = [], ''
    for line in script.splitlines(True):
        current += line
        if sqlite3.complete_statement(current):
            stmt = current.strip()
            current = ''
            if stmt:
                statements.append(stmt)
    if current.strip():
        statements.append(current.strip())
    if not statements:
        raise HTTPException(status_code=422, detail='Enter at least one SQL query.')
    for stmt in statements:
        first = re.match(r'^\s*(?:--[^\n]*\n\s*)*(SELECT|WITH|EXPLAIN)\b', stmt, re.I)
        if not first:
            raise HTTPException(status_code=400, detail='Only read-only SELECT, WITH ... SELECT, and EXPLAIN queries are allowed. Upload CREATE/INSERT scripts as .sql datasets instead.')
    return statements

@app.get('/api/sql/tables/{dataset_id}')
def sql_tables(dataset_id: str):
    conn, tables = _load_dataset_into_sqlite(dataset_id)
    try:
        details = []
        for table in tables:
            safe = table.replace('"', '""')
            cols = conn.execute(f'PRAGMA table_info("{safe}")').fetchall()
            count = conn.execute(f'SELECT COUNT(*) FROM "{safe}"').fetchone()[0]
            details.append({'name': table, 'rows': count, 'columns': [{'name': c[1], 'type': c[2]} for c in cols]})
        return {'ok': True, 'dataset_id': dataset_id, 'tables': details, 'default_table': 'dataset' if 'dataset' in tables else tables[0]}
    finally:
        conn.close()

@app.post('/api/sql/execute')
def execute_sql(payload: dict[str, Any]):
    dataset_id = str(payload.get('dataset_id', '')).strip()
    script = str(payload.get('query', '')).strip()
    if not dataset_id:
        raise HTTPException(status_code=422, detail='dataset_id is required. Upload a dataset first.')
    if not script:
        raise HTTPException(status_code=422, detail='SQL query is required.')
    if len(script) > 20000:
        raise HTTPException(status_code=413, detail='SQL script exceeds the 20,000-character limit.')
    statements = _read_only_sql_statements(script)
    conn, tables = _load_dataset_into_sqlite(dataset_id)
    try:
        # Prevent extension loading and cap execution time for expensive queries.
        conn.enable_load_extension(False)
        conn.set_progress_handler(lambda: 1, 5000000)
        results = []
        for stmt in statements:
            try:
                cur = conn.execute(stmt)
                if cur.description:
                    cols = [d[0] for d in cur.description]
                    rows = cur.fetchmany(1000)
                    results.append({'columns': cols, 'rows': [dict(zip(cols, row)) for row in rows], 'row_count_returned': len(rows), 'truncated': len(rows) == 1000})
                else:
                    results.append({'columns': [], 'rows': [], 'row_count_returned': 0, 'truncated': False})
            except sqlite3.Error as exc:
                raise HTTPException(status_code=400, detail=f'SQL error: {exc}') from exc
        return {'ok': True, 'dataset_id': dataset_id, 'tables': tables, 'results': results, 'safety': 'Read-only queries; up to 1,000 rows returned per statement.'}
    finally:
        conn.close()


@app.get('/api/health')
def health():
    return {'ok':True,'service':'Finance Analytics Backend','version':app.version,'storage':'local files; no database','supported_formats':sorted(SUPPORTED)}

@app.post('/api/datasets/upload')
async def upload_dataset(file: UploadFile = File(...)):
    filename = clean_name(file.filename or 'dataset')
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED:
        raise HTTPException(status_code=415, detail=f'Unsupported format {ext}. Supported formats: {", ".join(sorted(SUPPORTED))}')
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if not raw: raise HTTPException(status_code=400, detail='The uploaded file is empty.')
    if len(raw) > MAX_UPLOAD_BYTES: raise HTTPException(status_code=413, detail='Maximum upload size is 100 MB.')
    dataset_id = uuid.uuid4().hex
    saved = DATA_DIR / f'{dataset_id}_{filename}'
    try:
        df = read_dataset(filename, raw)
        result = analyze(df, filename, dataset_id)
        saved.write_bytes(raw)
        result['saved_bytes'] = len(raw)
        result['storage_note'] = 'Original uploaded file saved locally. No external database is used.'
        return JSONResponse(result)
    except HTTPException: raise
    except Exception as exc:
        saved.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f'Could not read/analyze this file: {str(exc)[:500]}') from exc

@app.post('/api/break-even')
def break_even(payload: dict[str, Any]):
    try:
        revenue = float(payload['revenue'])
        fixed_costs = float(payload['fixed_costs'])
        variable_ratio = float(payload['variable_cost_ratio'])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail='Provide numeric revenue, fixed_costs, and variable_cost_ratio (0 to less than 1).')
    if revenue < 0 or fixed_costs < 0 or not 0 <= variable_ratio < 1:
        raise HTTPException(status_code=422, detail='Revenue and fixed costs must be non-negative; variable_cost_ratio must be from 0 up to but not including 1.')
    cmr = 1 - variable_ratio
    be_revenue = fixed_costs / cmr
    margin_safety = ((revenue-be_revenue)/revenue*100) if revenue else None
    return {'ok':True,'revenue':revenue,'fixed_costs':fixed_costs,'variable_cost_ratio':variable_ratio,'contribution_margin_ratio':cmr,'break_even_revenue':be_revenue,'margin_of_safety_pct':margin_safety,'status':'above break-even' if revenue >= be_revenue else 'below break-even'}

@app.get('/api/datasets')
def list_datasets():
    items=[]
    for p in sorted(DATA_DIR.iterdir(), key=lambda x:x.stat().st_mtime, reverse=True):
        if p.is_file() and not p.name.startswith('.'):
            items.append({'dataset_id':p.name.split('_',1)[0],'filename':p.name.split('_',1)[1] if '_' in p.name else p.name,'bytes':p.stat().st_size,'modified':p.stat().st_mtime})
    return {'ok':True,'count':len(items),'items':items[:100]}

@app.get('/api/datasets/{dataset_id}/download')
def download_dataset(dataset_id: str):
    matches=list(DATA_DIR.glob(f'{dataset_id}_*'))
    if not matches: raise HTTPException(status_code=404, detail='Dataset not found.')
    return FileResponse(matches[0], filename=matches[0].name.split('_',1)[1])

# Serve the existing frontend through the same origin as the API.
@app.get('/', include_in_schema=False)
def index(): return FileResponse(FRONTEND_DIR / 'index.html')
app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')
