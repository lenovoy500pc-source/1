Apps Script backend for Loyalty app

Files:
- Code.gs: Main server handlers (doPost/doGet), session/token management, sheet helpers.
- helpers.gs: placeholder for splitting helper utilities if needed.
- appsscript.json: manifest for the Apps Script project.

Deployment steps:
1. Open Google Drive -> New -> More -> Google Apps Script.
2. Create a new project and paste `Code.gs` and `helpers.gs` contents into separate files in the script editor. Also set the project manifest from `appsscript.json` if needed.
3. Update constants at the top of `Code.gs`: `REG_SHEET_NAME`, `PURCHASE_SHEET_NAME`, and `OWNER_EMAIL` to match your sheet names and owner email.
4. In the Apps Script editor, under "Deploy" -> "New deployment" choose "Web app".
   - Execute as: Me
   - Who has access: Anyone
5. Deploy and copy the Web App URL. Use that as `API_URL` in the client-side `config.js`.
6. Ensure the spreadsheet with the sheets exists and the Apps Script project is bound to that spreadsheet, or use `SpreadsheetApp.openById()` change in `Code.gs` to point to the proper spreadsheet ID.

Security notes:
- Tokens are stored in Script Properties for simplicity. For heavy-production use consider a proper database with token revocation and stronger cryptography.
- Ensure `OWNER_EMAIL` is set correctly; server enforces owner-only actions.
- Passwords are validated against the registration sheet; prefer hashing and secure storage for production.

