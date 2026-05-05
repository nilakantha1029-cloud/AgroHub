# 🌾 AgroHub

**AgroHub** is a full-stack agricultural marketplace web application built with **Flask** and **PostgreSQL**. It connects farmers, customers, and service providers on a single platform — enabling produce trading, equipment/vehicle/warehouse bookings, and agricultural support services.

---

## 🚀 Features

### 👨‍🌾 Farmer
- Create and manage produce listings (vegetables, grains, spices, fruits)
- View and update incoming orders from customers
- Access real-time market prices (APMC rates)
- Agricultural tips, buying advice, and blog posts
- Upload product images via Cloudinary
- Profile management with farm details, Aadhaar, PAN

### 🛒 Customer
- Browse produce listings and add to cart
- Place orders and track order status
- Book services: vehicles, rental equipment, and warehouses
- Save multiple delivery addresses
- View order history and notifications

### 🔧 Service Provider
- List services: vehicles, rental equipment, warehouses
- Manage booking requests (approve / reject / complete)
- Profile management with vehicle registration, DL details

### 🛡️ Admin Dashboard
- Full user management (view, edit, delete, create)
- Manage all product and service listings
- View all orders, support tickets, and contact messages
- Broadcast email announcements to all users
- Manage FAQs and market prices
- Admin login at `/admin`

### ✉️ Email Notifications (SendGrid)
- OTP verification on signup
- Welcome email, password reset, password change confirmation
- Order placed / status update emails
- Service booking request / status emails
- Support ticket creation / admin reply emails
- Contact form confirmation

---

## 🗂️ Project Structure

```
AgroHub/
├── app.py                  ← Main Flask application (all routes & API endpoints)
├── database.py             ← PostgreSQL connection & table initialisation
├── email_service.py        ← SendGrid email functions (OTP, orders, bookings…)
├── create_admin.py         ← Interactive CLI script to create admin accounts
├── view_db.py              ← CLI database viewer (users, orders, summary) — SQLite only
├── requirements.txt        ← Python dependencies
├── .env                    ← Environment variables (secrets, credentials)
├── agrohub.db              ← (Legacy) SQLite file — not used in production
├── static/
│   ├── Assets/             ← Images, logo, favicon
│   ├── landing.css / .js
│   ├── dashboard_farmer.css / .js
│   ├── dashboard_customer.css / .js
│   ├── dashboard_service_provider.css / .js
│   ├── admin.js / admincss.css
│   ├── sell_my_goods.css / .js
│   ├── book_vehicle.css / .js
│   ├── book_warehouse.css / .js
│   ├── rent_equipment.css / .js
│   ├── customer_orders.css / .js
│   ├── farmer_orders.css / .js
│   ├── profile.css / .js
│   ├── service_profile.css / .js
│   ├── customer_profile.css / .js
│   ├── login.css / .js
│   ├── signup.css / .js
│   ├── agri_tips.css / .js
│   └── … (more CSS/JS per page)
└── templates/
    ├── landing.html
    ├── login.html
    ├── signup.html
    ├── dashboard_farmer.html
    ├── dashboard_customer.html
    ├── dashboard_service_provider.html
    ├── admin_dashboard.html
    ├── sell_my_goods.html
    ├── book_vehicle.html
    ├── book_warehouse.html
    ├── rent_equipment.html
    ├── customer_orders.html
    ├── farmer_orders.html
    ├── profile.html / customer_profile.html / service_profile.html
    ├── help_support.html / customer_helpandsupport.html / service_help_support.html
    ├── agri_tips.html
    ├── buying_tips.html
    ├── blog.html
    ├── reset_password.html
    └── terms.html
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, Flask 2.3 |
| Database | PostgreSQL (via `psycopg2`) |
| Auth | bcrypt password hashing, Flask sessions |
| Email | SendGrid API (primary), Flask-Mail (fallback) |
| Image Upload | Cloudinary |
| CORS | Flask-CORS |
| Deployment | Gunicorn (production WSGI server) |
| Frontend | Vanilla HTML + CSS + JavaScript |

---

## 🏗️ Database Schema

AgroHub uses **PostgreSQL**. Tables are created automatically on first run via `init_db()` in `database.py`.

| Table | Purpose |
|---|---|
| `users` | Farmers, customers, service providers |
| `admin_users` | Admin accounts |
| `listings` | Produce listings by farmers |
| `cart_items` | Customer shopping cart |
| `orders` | Purchase orders |
| `service_listings` | Vehicle / equipment / warehouse listings |
| `service_bookings` | Bookings made by customers |
| `support_tickets` | Help & support tickets |
| `faq` | Frequently asked questions |
| `notifications` | In-app notifications per user |
| `market_prices` | Admin-managed APMC market price data |
| `user_addresses` | Saved delivery addresses |
| `contact_messages` | Contact form submissions |
| `otp_store` | OTP records for email verification |

---

## 🔑 Environment Variables (`.env`)

Create a `.env` file in the project root with the following:

```env
# ─── Flask Secret ──────────────────────────────────────────────
SECRET_KEY=your-random-secret-key-here
agriconnect_secret=your-random-secret-key-here

# ─── PostgreSQL Database ───────────────────────────────────────
DATABASE_URL=postgresql://username:password@host:5432/agrohub

# ─── Cloudinary (image uploads) ───────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── SendGrid (email) ─────────────────────────────────────────
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_SENDER_EMAIL=noreply@yourdomain.com
MAIL_DEFAULT_SENDER_NAME=AgroHub

# ─── Flask-Mail fallback (Gmail SMTP) ─────────────────────────
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USE_SSL=false
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_DEFAULT_SENDER=your_gmail@gmail.com

# ─── Admin Alert Email ─────────────────────────────────────────
ADMIN_EMAIL=admin@yourdomain.com

# ─── App Base URL ──────────────────────────────────────────────
APP_BASE_URL=http://127.0.0.1:5000
```

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords. Generate a 16-character password for "Mail".

---

## 🖥️ Local Development Setup

### Prerequisites
- Python 3.9+ (developed on Python 3.11)
- PostgreSQL server running locally or a cloud PostgreSQL URL (e.g. Supabase, Render, Neon)
- A [Cloudinary](https://cloudinary.com/) account (free tier works)
- A [SendGrid](https://sendgrid.com/) account for emails (free tier works)

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd AgroHub
```

### 2. Create a virtual environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

### 5. Set up PostgreSQL database

Make sure your PostgreSQL server is running, create a database, and set `DATABASE_URL` in `.env`:

```bash
# Example using psql
psql -U postgres
CREATE DATABASE agrohub;
\q
```

Then set in `.env`:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/agrohub
```

### 6. Run the app
```bash
python app.py
```

The app starts on `http://127.0.0.1:10000`

> On first run, all database tables are created automatically.

### 7. Create an admin account
```bash
python create_admin.py
```
Follow the prompts to enter admin name, email, and password. Then log in at `http://127.0.0.1:10000/admin`.

---

## 🌐 Sharing on Local Network

1. Find your local IP:
   - **Windows**: `ipconfig` → look for IPv4 Address
   - **macOS/Linux**: `ifconfig` or `ip addr`

2. Update `.env`:
   ```
   APP_BASE_URL=http://192.168.1.100:10000
   ```

3. Run the app — others on the same WiFi can access it at `http://YOUR_IP:10000`

---

## ☁️ Deployment (Render.com)

AgroHub is configured to deploy on [Render](https://render.com/). The app listens on port `10000` (Render's default).

### Steps

1. Push your code to GitHub.
2. Create a new **Web Service** on Render, connect your repo.
3. Set **Build Command**:
   ```
   pip install -r requirements.txt
   ```
4. Set **Start Command**:
   ```
   gunicorn app:app
   ```
5. Add all environment variables from `.env` in the Render dashboard under **Environment**.
6. Create a **PostgreSQL** database on Render (or use an external provider) and copy the connection string to `DATABASE_URL`.
7. Deploy. The app will auto-initialise all tables on first startup.

### After deployment — create admin
Navigate to:
```
https://your-app.onrender.com/setup-admin-once
```
> ⚠️ **Delete or protect this route** immediately after use — it creates a hardcoded admin account and is a security risk if left open.

Alternatively, run `create_admin.py` locally pointed at the production `DATABASE_URL`.

---

## 📡 Key API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/signup/send-otp` | Send OTP to email before signup |
| POST | `/api/signup/verify-otp` | Verify OTP |
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Login |
| GET | `/api/logout` | Logout |
| POST | `/api/forgot-password` | Send password reset email |
| POST | `/api/reset-password` | Reset password via token |

### Listings & Marketplace
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/market-listings` | All active produce listings (public) |
| POST | `/api/listings` | Create a produce listing (farmer) |
| PUT | `/api/listings/<id>` | Update listing |
| DELETE | `/api/listings/<id>` | Delete listing |
| GET | `/api/market-prices` | Current APMC market prices |

### Cart & Orders
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/cart` | View / add to cart |
| PUT | `/api/cart/<id>` | Update cart item quantity |
| DELETE | `/api/cart/clear` | Clear cart |
| POST | `/api/orders` | Place an order |
| GET | `/api/orders/customer` | Customer's orders |
| GET | `/api/orders/farmer` | Farmer's incoming orders |
| PUT | `/api/orders/<id>/status` | Update order status |

### Services
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/service-listings/public` | All available services (public) |
| POST | `/api/service-listings` | Create service listing |
| POST | `/api/service-bookings` | Book a service |
| GET | `/api/service-bookings` | Provider's bookings |
| GET | `/api/my-service-bookings` | Customer's bookings |
| PUT | `/api/service-bookings/<id>/status` | Update booking status |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/users` | All users |
| PUT/DELETE | `/api/admin/users/<id>` | Edit / delete user |
| POST | `/api/admin/broadcast` | Send broadcast email |
| GET/POST | `/api/admin/market-prices` | View / update market prices |
| GET | `/api/admin/tickets` | All support tickets |
| GET | `/api/admin/contacts` | Contact form messages |

---

## 🛠️ Utility Scripts

### `create_admin.py`
Interactive terminal script to add an admin account to the database.
```bash
python create_admin.py
```

### `view_db.py`
Terminal database viewer — shows users, admin accounts, and table row counts.
> ⚠️ This script uses SQLite (`agrohub.db`) — it will not show data from a PostgreSQL database. Use your PostgreSQL client (e.g. pgAdmin, DBeaver, or `psql`) for production data inspection.

---

## 🔒 Security Notes

- Change `SECRET_KEY` to a long random string before deploying.
- Never commit `.env` to version control — add it to `.gitignore`.
- The `/setup-admin-once` route creates a hardcoded admin; **delete or disable it** after first use.
- The `/test-email` route is a development helper — **remove it in production**.
- Session cookies are set with `SameSite=None; Secure=True` — ensure you deploy over HTTPS.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| `psycopg2.OperationalError` | Check `DATABASE_URL` is correct and PostgreSQL is running |
| Emails not sending | Verify `SENDGRID_API_KEY` and `SENDGRID_SENDER_EMAIL` in `.env` |
| Images not uploading | Check Cloudinary credentials in `.env` |
| `500 Internal Server Error` on login | Confirm all DB tables exist — run `python database.py` to reinitialise |
| Port conflict | Change port in `app.py`: `app.run(host="0.0.0.0", port=5000)` |

---

## 📦 Dependencies

```
Flask==2.3.3
Flask-CORS==4.0.0
Flask-Mail==0.10.0
bcrypt==4.0.1
python-dotenv==1.0.0
Werkzeug==2.3.7
itsdangerous==2.2.0
cloudinary==1.36.0
psycopg2-binary
gunicorn
sendgrid==6.11.0
```

---

## 📄 License

This project was developed as a major academic project. All rights reserved by the authors.