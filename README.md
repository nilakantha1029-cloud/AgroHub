# AgroHub — SQLite Edition 🌾

This is the **portable version** of AgroHub that uses SQLite3 instead of MySQL.
No database server required — the database is a single file (`agrohub.db`) that
is created automatically when you run the app.

## ✅ What Changed
- **Removed**: MySQL (`mysql-connector-python`) dependency
- **Added**: SQLite3 (built into Python — no installation needed)
- **Added**: `database.py` — creates all tables automatically on first run
- **All APIs, email, OTP, admin, orders, bookings** work exactly the same

---

## 🚀 Quick Start (Any Laptop / PC)

### 1. Install Python (if not installed)
Download from https://python.org (Python 3.8+)

### 2. Open Terminal / Command Prompt in the project folder

### 3. Create virtual environment (recommended)
```bash
python -m venv venv

# Windows:
venv\Scripts\activate

# Mac / Linux:
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Run the app
```bash
python app.py
```

### 6. Open browser
```
http://127.0.0.1:5000
```

That's it! The database (`agrohub.db`) is created automatically. ✅

---

## 📁 Project Structure
```
Agrihub/
├── app.py              ← Main Flask app (SQLite3, all APIs)
├── database.py         ← SQLite DB helper & table creation
├── email_service.py    ← Flask-Mail email functions
├── requirements.txt    ← Python packages (no MySQL)
├── .env                ← Config (email, cloudinary, secret)
├── agrohub.db          ← SQLite database (auto-created)
├── static/             ← CSS, JS, images
└── templates/          ← HTML pages
```

---

## ⚙️ Configuration (.env)

Edit `.env` to change settings:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask session secret (change before sharing!) |
| `MAIL_USERNAME` | Gmail address for sending emails |
| `MAIL_PASSWORD` | Gmail App Password (16-char) |
| `ADMIN_EMAIL` | Email to receive admin alerts |
| `CLOUDINARY_*` | Image upload credentials |
| `APP_BASE_URL` | Your IP address (e.g. `http://192.168.1.5:5000`) |

---

## 🌐 Sharing with Friends on Same Network

1. Find your IP address:
   - **Windows**: `ipconfig` → look for IPv4
   - **Mac/Linux**: `ifconfig` or `ip addr`

2. Update `APP_BASE_URL` in `.env`:
   ```
   APP_BASE_URL=http://192.168.1.100:5000
   ```

3. Run the app:
   ```bash
   python app.py
   ```

4. Friends on same WiFi open: `http://YOUR_IP:5000`

---

## 🗄️ Database

- **File**: `agrohub.db` (SQLite3)
- **Location**: Same folder as `app.py`
- **Auto-created**: Yes, on first run
- **Portable**: Copy the whole folder and it works anywhere

> To reset the database: delete `agrohub.db` and restart the app.
