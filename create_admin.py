"""
create_admin.py — Create an Admin Account for AgroHub
Run: python create_admin.py
"""
import sqlite3
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'agrohub.db')

def create_admin():
    if not os.path.exists(DB_PATH):
        print("❌ agrohub.db not found. Run the main app first.")
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

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO admin_users (name, email, password_hash) VALUES (?,?,?)",
            (name, email, hashed)
        )
        conn.commit()
        print()
        print("✅ Admin account created successfully!")
        print(f"   Email    : {email}")
        print(f"   Password : {password}")
        print(f"   Login at : http://127.0.0.1:5000/admin")
    except sqlite3.IntegrityError:
        print("❌ That email is already registered as admin.")
    finally:
        conn.close()

if __name__ == '__main__':
    create_admin()
