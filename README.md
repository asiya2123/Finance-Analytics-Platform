# Finance Analytics Platform — Organized Project

## Folder structure

```text
Revenue_BI_Platform/
├── frontend/                 # Website pages, styles, scripts and Plotly
│   ├── index.html            # Main dashboard
│   ├── app.html              # Alternate app page
│   └── assets/
│       ├── css/              # Stylesheets
│       └── js/               # Frontend JavaScript and chart engine
├── backend/                  # Python + FastAPI API
│   ├── app.py                # API routes and data processing
│   ├── requirements.txt      # Python dependencies
│   └── data/                 # Uploaded datasets saved locally
├── tests/                    # Frontend engine smoke test
├── RUN_BACKEND.bat           # Windows setup and launch script
└── README.md
```

## Run on Windows
1. Install Python 3.11+ and make sure `python` works in Command Prompt/PowerShell.
2. Double-click `RUN_BACKEND.bat`. Keep its terminal window open while using the app.
3. Open http://127.0.0.1:8000 for the dashboard.
4. Open http://127.0.0.1:8000/docs for API documentation.
5. Open http://127.0.0.1:8000/api/health to check server status.

The first launch installs packages from `backend/requirements.txt`, so internet access is needed during installation. Uploaded files are stored under `backend/data/`. No PostgreSQL or MySQL database is required.

## SQL support
- Upload supported datasets using `POST /api/datasets/upload`.
- Discover tables using `GET /api/sql/tables/{dataset_id}`.
- Run read-only `SELECT`, `WITH ... SELECT`, and `EXPLAIN` queries using `POST /api/sql/execute`.
- SQL script uploads must use SQLite-compatible SQL. Uploading a `.sql` script is distinct from running a read-only query.

## Supported backend formats
CSV, TSV, TXT, XLSX, XLSM, JSON, XML, Parquet, Avro, SQL scripts, SQLite `.db` and `.sqlite` files. SQL scripts and external database dialects may need conversion to SQLite-compatible syntax.

## Tests
Run `node tests/smoke.js` from the project root if Node.js is installed.

## Notes
- The dashboard keeps its existing browser-side analysis; backend APIs are available at the same origin. A frontend feature only uses server-side processing if it is explicitly wired to the API.
- Uploaded data is stored locally. Protect the project folder because it may contain business-sensitive data.
