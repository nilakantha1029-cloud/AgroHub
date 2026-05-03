import psycopg2
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def create_admin():
    if not DATABASE_URL:
        print("❌ DATABASE_URL environment variable not set.")
        return

    print()
    print("🔐 AgroHub — Create Admin Account")
    print("─" * 40)
    name     = input("Admin Name     : ").strip()
    email    = input("Admin Email    : ").strip().lower()
    password = input("Admin Password : ").strip()

    if not name or not email or not password:
        print("❌ All fields are required.")
        return

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO admin_users (name, email, password_hash) VALUES (%s, %s, %s)",
            (name, email, hashed)
        )
        conn.commit()
        cur.close()
        conn.close()
        print()
        print("✅ Admin account created successfully!")
        print(f"   Email    : {email}")
        print(f"   Password : {password}")
        print(f"   Login at : https://agrohub-xav9.onrender.com/admin")
    except psycopg2.errors.UniqueViolation:
        print("❌ That email is already registered as admin.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    create_admin()