import os
import psycopg2
import psycopg2.extras
import bcrypt

DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def dict_row(row):
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    return [dict(r) for r in rows]


def init_db():
    """Create all tables if they don't exist yet."""
    conn = get_connection()
    c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id               SERIAL PRIMARY KEY,
        role             TEXT NOT NULL DEFAULT 'farmer',
        first_name       TEXT NOT NULL,
        last_name        TEXT NOT NULL,
        email            TEXT NOT NULL UNIQUE,
        phone            TEXT UNIQUE,
        password_hash    TEXT NOT NULL,
        profile_img      TEXT,
        gender           TEXT,
        dob              TEXT,
        address          TEXT,
        village          TEXT,
        district         TEXT,
        state            TEXT,
        pincode          TEXT,
        aadhar           TEXT,
        pan              TEXT,
        farm_size        TEXT,
        farm_type        TEXT,
        bio              TEXT,
        dl_number        TEXT,
        dl_expiry        TEXT,
        dl_type          TEXT,
        dl_rto           TEXT,
        vehicle_reg      TEXT,
        vehicle_type     TEXT,
        vehicle_reg_expiry TEXT,
        insurance        TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL,
        produce        TEXT NOT NULL,
        variety        TEXT,
        category       TEXT DEFAULT 'vegetables',
        grade          TEXT,
        quantity       REAL DEFAULT 0,
        price          REAL DEFAULT 0,
        min_price      REAL,
        available_from TEXT,
        valid_until    TEXT,
        location       TEXT,
        storage        TEXT,
        packaging      TEXT,
        harvest_date   TEXT,
        transport      TEXT,
        description    TEXT,
        image_urls     TEXT DEFAULT '',
        status         TEXT DEFAULT 'active',
        created_at     TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        listing_id INTEGER NOT NULL,
        quantity   REAL DEFAULT 1,
        UNIQUE(user_id, listing_id),
        FOREIGN KEY (user_id)    REFERENCES users(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id      INTEGER NOT NULL,
        farmer_id        INTEGER NOT NULL,
        listing_id       INTEGER NOT NULL,
        quantity         REAL DEFAULT 1,
        unit_price       REAL DEFAULT 0,
        total_price      REAL DEFAULT 0,
        delivery_address TEXT,
        status           TEXT DEFAULT 'pending',
        created_at       TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (farmer_id)   REFERENCES users(id),
        FOREIGN KEY (listing_id)  REFERENCES listings(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        message    TEXT NOT NULL,
        type       TEXT DEFAULT 'info',
        is_read    INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        subject    TEXT NOT NULL,
        category   TEXT DEFAULT 'general',
        message    TEXT NOT NULL,
        priority   TEXT DEFAULT 'medium',
        status     TEXT DEFAULT 'open',
        reply      TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS faq (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        category   TEXT DEFAULT 'general',
        role       TEXT DEFAULT 'all',
        sort_order INTEGER DEFAULT 0,
        is_active  INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS service_listings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL,
        service_type    TEXT DEFAULT 'transport',
        name            TEXT NOT NULL,
        sub_type        TEXT,
        reg_no          TEXT,
        model           TEXT,
        year            INTEGER,
        capacity        TEXT,
        available_space TEXT,
        fuel            TEXT,
        condition       TEXT DEFAULT 'Good',
        operator        TEXT,
        humidity        TEXT,
        temp_range      TEXT,
        nearest_apmc    TEXT,
        routes          TEXT,
        price           REAL DEFAULT 0,
        per_km          REAL DEFAULT 0,
        min_days        INTEGER DEFAULT 1,
        location        TEXT,
        status          TEXT DEFAULT 'available',
        features        TEXT DEFAULT '[]',
        description     TEXT,
        image_urls      TEXT DEFAULT '[]',
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS service_bookings (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id    INTEGER NOT NULL,
        customer_id   INTEGER NOT NULL,
        booking_date  TEXT,
        duration_days INTEGER DEFAULT 1,
        quantity      REAL DEFAULT 1,
        location      TEXT,
        notes         TEXT,
        amount        REAL DEFAULT 0,
        status        TEXT DEFAULT 'pending',
        created_at    TEXT DEFAULT (datetime('now')),
        updated_at    TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (listing_id)  REFERENCES service_listings(id),
        FOREIGN KEY (customer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS market_prices (
        id         INTEGER PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_addresses (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        type       TEXT DEFAULT 'home',
        name       TEXT,
        phone      TEXT,
        street     TEXT,
        village    TEXT,
        district   TEXT,
        pincode    TEXT,
        state      TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        role       TEXT DEFAULT 'other',
        message    TEXT NOT NULL,
        is_read    INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)

    conn.commit()
    conn.close()
    print("✅ SQLite database initialized:", DB_PATH)


if __name__ == '__main__':
    init_db()
