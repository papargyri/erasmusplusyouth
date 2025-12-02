# 🚀 AUTO-SYNC SETUP INSTRUCTIONS

## Step 1: Make Google Sheet Public

Your sheet URL: https://docs.google.com/spreadsheets/d/1uIJ9MfdLTXnXJdvsRKhIQddY4OKoj6oQXYjKyip5iQ4/edit

**To enable auto-sync:**

1. Open the sheet
2. Click **"Share"** button (top right corner)
3. Under "General access" change to:
   - **"Anyone with the link"**
   - Permission: **"Viewer"**
4. Click **"Done"**

## Step 2: Run the Sync Script

```bash
node update-from-google-sheets.js
```

This will:
- ✅ Fetch latest data from your Google Sheet
- ✅ Extract organization names, countries, websites
- ✅ Get Google Drive logo URLs from Column 4
- ✅ Update index.html automatically
- ✅ Create a backup before updating

## Step 3: Test Your Website

Open: http://localhost:8000/index.html

All logos should be mapped correctly!

---

## 📊 Column Mapping

Your sheet structure:
- **Column 1**: Organization Name
- **Column 2**: Country
- **Column 3**: Website
- **Column 4**: Logo (Google Drive link) ← **This is what we use!**

---

## 🔄 How to Add New Members

1. Add new row to your Google Sheet
2. Fill in: Name, Country, Website, Logo URL
3. Run: `node update-from-google-sheets.js`
4. Done! Your website is updated

---

## ⚠️ Troubleshooting

**If you get "WARNING: 0 organizations":**
- Sheet is not public yet
- Follow Step 1 above

**If logos don't show:**
- Make sure Column 4 has Google Drive links
- Format: https://drive.google.com/open?id=XXXXX
- Or: https://drive.google.com/file/d/XXXXX/view

---

## 📁 Files

- `update-from-google-sheets.js` - Main sync script
- `sync-reference.json` - Last sync details
- `index.html.backup-YYYY-MM-DD` - Automatic backups

---

## ✨ Benefits

- ✅ No manual Excel file exports
- ✅ Real-time updates from Google Sheets
- ✅ Perfect row-based mapping
- ✅ Automatic backups
- ✅ One command to sync everything

Run `node update-from-google-sheets.js` anytime to sync new members!
