import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


def get_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def dict_row(row):
    return row if row else None


def dict_rows(rows):
    return rows if rows else []


def init_db():
    """Initialize PostgreSQL tables"""
    conn = get_connection()
    cur = conn.cursor()

    # USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        role TEXT DEFAULT 'farmer',
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        profile_img TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        village TEXT,
        district TEXT,
        state TEXT,
        pincode TEXT,
        aadhar TEXT,
        pan TEXT,
        farm_size TEXT,
        farm_type TEXT,
        bio TEXT,
        dl_number TEXT,
        dl_expiry TEXT,
        dl_type TEXT,
        dl_rto TEXT,
        vehicle_reg TEXT,
        vehicle_type TEXT,
        vehicle_reg_expiry TEXT,
        insurance TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ADMIN USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # LISTINGS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        produce TEXT NOT NULL,
        variety TEXT,
        category TEXT DEFAULT 'vegetables',
        grade TEXT,
        quantity REAL DEFAULT 0,
        price REAL DEFAULT 0,
        min_price REAL,
        available_from TEXT,
        valid_until TEXT,
        location TEXT,
        storage TEXT,
        packaging TEXT,
        harvest_date TEXT,
        transport TEXT,
        description TEXT,
        image_urls TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # CART
    cur.execute("""
    CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        listing_id INTEGER REFERENCES listings(id),
        quantity REAL DEFAULT 1,
        UNIQUE(user_id, listing_id)
    )
    """)

    # ORDERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES users(id),
        farmer_id INTEGER REFERENCES users(id),
        listing_id INTEGER REFERENCES listings(id),
        quantity REAL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        delivery_address TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # NOTIFICATIONS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # SUPPORT
    cur.execute("""
    CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        subject TEXT,
        category TEXT,
        message TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        reply TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # FAQ
    cur.execute("""
    CREATE TABLE IF NOT EXISTS faq (
        id SERIAL PRIMARY KEY,
        question TEXT,
        answer TEXT,
        category TEXT,
        role TEXT DEFAULT 'all',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE
    )
    """)

    # SERVICES
    cur.execute("""
    CREATE TABLE IF NOT EXISTS service_listings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        service_type TEXT,
        name TEXT,
        sub_type TEXT,
        reg_no TEXT,
        model TEXT,
        year INTEGER,
        capacity TEXT,
        available_space TEXT,
        fuel TEXT,
        condition TEXT,
        operator TEXT,
        humidity TEXT,
        temp_range TEXT,
        nearest_apmc TEXT,
        routes TEXT,
        price REAL DEFAULT 0,
        per_km REAL DEFAULT 0,
        min_days INTEGER DEFAULT 1,
        location TEXT,
        status TEXT DEFAULT 'available',
        features TEXT,
        description TEXT,
        image_urls TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # SERVICE BOOKINGS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS service_bookings (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES service_listings(id),
        customer_id INTEGER REFERENCES users(id),
        booking_date TEXT,
        duration_days INTEGER DEFAULT 1,
        quantity REAL DEFAULT 1,
        location TEXT,
        notes TEXT,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # MARKET PRICES
    cur.execute("""
    CREATE TABLE IF NOT EXISTS market_prices (
        id SERIAL PRIMARY KEY,
        data TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ADDRESSES
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT,
        name TEXT,
        phone TEXT,
        street TEXT,
        village TEXT,
        district TEXT,
        pincode TEXT,
        state TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # CONTACT
    cur.execute("""
    CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        role TEXT,
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    cur.close()
    conn.close()

    print("✅ PostgreSQL database initialized successfully")


if __name__ == "__main__":
    init_db()