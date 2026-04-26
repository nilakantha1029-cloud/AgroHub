from flask import Flask, render_template, redirect, request, jsonify, session
from flask_cors import CORS
import sqlite3
import bcrypt
import re
import os
import json
import random
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

from email_service import (
    init_mail,
    generate_reset_token, verify_reset_token,
    send_forgot_password_email, send_password_changed_email,
    send_otp_email, send_welcome_email,
    send_order_placed_email, send_order_status_email,
    send_service_booking_request_email, send_service_booking_status_email,
    send_ticket_created_email, send_ticket_reply_email, send_ticket_new_admin_email,
    send_contact_confirmation_email, send_contact_admin_email,
    send_profile_updated_email,
    send_admin_user_updated_email, send_admin_user_deleted_email,
    send_admin_broadcast_email, send_listing_deleted_by_admin_email,
)
from database import get_connection, dict_row, dict_rows, init_db

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

app = Flask(__name__, static_folder='static')
app.secret_key = os.getenv('agriconnect_secret', os.getenv('SECRET_KEY', 'change-this-in-production'))
CORS(app, supports_credentials=True)
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=False
)

init_mail(app)
init_db()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

DEFAULT_MARKET_PRICES = {
    "vegetables": [
        {"emoji": "🍅", "name": "Tomatoes",   "loc": "Nashik APMC", "price": 48,  "unit": "kg"},
        {"emoji": "🧅", "name": "Onions",      "loc": "Lasalgaon",   "price": 36,  "unit": "kg"},
        {"emoji": "🥔", "name": "Potato",      "loc": "Sinnar",      "price": 22,  "unit": "kg"},
        {"emoji": "🥕", "name": "Carrots",     "loc": "Malegaon",    "price": 28,  "unit": "kg"},
        {"emoji": "🧄", "name": "Garlic",      "loc": "Lasalgaon",   "price": 180, "unit": "kg"},
        {"emoji": "🥦", "name": "Cauliflower", "loc": "Nashik",      "price": 30,  "unit": "kg"}
    ],
    "grains": [
        {"emoji": "🌾", "name": "Wheat",    "loc": "Niphad",   "price": 32, "unit": "kg"},
        {"emoji": "🌽", "name": "Maize",    "loc": "Nashik",   "price": 24, "unit": "kg"},
        {"emoji": "🫘", "name": "Toor Dal", "loc": "Yeola",    "price": 95, "unit": "kg"},
        {"emoji": "🫘", "name": "Chana Dal","loc": "Nashik",   "price": 85, "unit": "kg"},
        {"emoji": "🌾", "name": "Rice",     "loc": "Kolhapur", "price": 42, "unit": "kg"}
    ],
    "spices": [
        {"emoji": "🌶️", "name": "Red Chilli","loc": "Dindori", "price": 320, "unit": "kg"},
        {"emoji": "🌿", "name": "Coriander", "loc": "Nashik",  "price": 45,  "unit": "kg"},
        {"emoji": "🫚", "name": "Cumin",     "loc": "Nashik",  "price": 210, "unit": "kg"},
        {"emoji": "🟡", "name": "Turmeric",  "loc": "Sangli",  "price": 130, "unit": "kg"}
    ],
    "fruits": [
        {"emoji": "🥭", "name": "Mangoes", "loc": "Ratnagiri", "price": 120, "unit": "kg"},
        {"emoji": "🍊", "name": "Oranges", "loc": "Nagpur",    "price": 55,  "unit": "kg"},
        {"emoji": "🍇", "name": "Grapes",  "loc": "Nashik",    "price": 75,  "unit": "kg"},
        {"emoji": "🍌", "name": "Bananas", "loc": "Jalgaon",   "price": 35,  "unit": "kg"}
    ]
}

def validate_email(email):
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|in|org|net)$', email)

def validate_phone(phone):
    cleaned = re.sub(r'[^\d+]', '', phone)
    return re.match(r'^(\+91|91|0)?[6-9]\d{9}$', cleaned)

def validate_password(password):
    if len(password) < 8: return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password): return False, "Password must contain at least one uppercase letter"
    if not re.search(r'\d', password): return False, "Password must contain at least one number"
    if not re.search(r'[@$!%*?&]', password): return False, "Password must contain at least one special character"
    return True, "Valid"

def push_notification(user_id, message, notif_type='info'):
    try:
        conn = get_connection()
        conn.execute("INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)", (user_id, message, notif_type))
        conn.commit(); conn.close()
    except Exception as e:
        print("Notification error:", e)

def _upload_images(files):
    urls = []
    for f in files:
        if f and f.filename:
            try:
                result = cloudinary.uploader.upload(f)
                urls.append(result['secure_url'])
            except Exception as e:
                print("Cloudinary upload error:", e)
    return urls

def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

# PAGE ROUTES
@app.route('/') 
def home(): return render_template('landing.html')
@app.route('/terms') 
def terms(): return render_template('terms.html')
@app.route('/admin')
def admin_page():
    if not session.get('is_admin'): return redirect('/login')
    return render_template('admin_dashboard.html')
@app.route('/blog') 
def blog(): return render_template('blog.html')
@app.route('/login') 
def login_page(): return render_template('login.html')
@app.route('/signup') 
def signup_page(): return render_template('signup.html')
@app.route('/dashboard/<role>')
def dashboard(role):
    if role in ['farmer', 'customer', 'service_provider']: return render_template(f'dashboard_{role}.html')
    return 'Dashboard not found', 404
@app.route('/sellmygoods')
def sell_goods():
    if 'user_id' not in session: return redirect('/login')
    return render_template('sell_my_goods.html')
@app.route('/profile')
def profile_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('profile.html')
@app.route('/customerprofile')
def customer_profile_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('customer_profile.html')
@app.route('/help-support')
def help_support_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('help_support.html')
@app.route('/customer-helpandsupport')
def customer_helpandsupport_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('customer_helpandsupport.html')
@app.route('/service-help-support')
def service_help_support_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('service_help_support.html')
@app.route('/service-profile')
def service_profile_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('service_profile.html')
@app.route('/book-vehicle')
def book_vehicle_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('book_vehicle.html')
@app.route('/rent-equipment')
def rent_equipment_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('rent_equipment.html')
@app.route('/book-warehouse')
def book_warehouse_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('book_warehouse.html')
@app.route('/agri-tips')
def agri_tips_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('agri_tips.html')
@app.route('/buying-tips')
def buying_tips_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('buying_tips.html')
@app.route('/customer-orders')
def customer_orders_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('customer_orders.html')
@app.route('/farmer-orders')
def farmer_orders_page():
    if 'user_id' not in session: return redirect('/login')
    return render_template('farmer_orders.html')
@app.route('/reset-password')
def reset_password_page(): return render_template('reset_password.html')

# AUTH
_otp_store = {}

@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        first_name = data.get('first_name','').strip(); last_name = data.get('last_name','').strip()
        email = data.get('email','').strip().lower(); phone = data.get('phone','').strip() or None
        password = data.get('password',''); role = data.get('role','farmer').lower().replace('-','_')
        if role not in ['farmer','customer','service_provider']: return jsonify({'error':'Invalid role'}),400
        if not all([first_name,last_name,email,password]): return jsonify({'error':'All fields are required'}),400
        if len(first_name)>20 or len(last_name)>20: return jsonify({'error':'Name max 20 characters'}),400
        if not validate_email(email): return jsonify({'error':'Invalid email format'}),400
        if phone and not validate_phone(phone): return jsonify({'error':'Invalid phone number'}),400
        ok,msg = validate_password(password)
        if not ok: return jsonify({'error':msg}),400
        conn = get_connection()
        if dict_row(conn.execute("SELECT id FROM users WHERE email=?",(email,)).fetchone()):
            conn.close(); return jsonify({'error':'Email already registered'}),409
        if phone and dict_row(conn.execute("SELECT id FROM users WHERE phone=?",(phone,)).fetchone()):
            conn.close(); return jsonify({'error':'Phone already registered'}),409
        hashed = bcrypt.hashpw(password.encode(),bcrypt.gensalt()).decode()
        cur = conn.execute("INSERT INTO users (role,first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?,?)",(role,first_name,last_name,email,phone,hashed))
        user_id = cur.lastrowid; conn.commit(); conn.close()
        send_welcome_email(app,email,first_name,role)
        return jsonify({'success':True,'user_id':user_id,'role':role}),201
    except Exception as e:
        print("Signup error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        login_id = data.get('login_id','').strip().lower()
        password = data.get('password',''); role = data.get('role','farmer')
        if not login_id or not password: return jsonify({'error':'Email/Phone and password required'}),400
        conn = get_connection()
        user = dict_row(conn.execute("SELECT id,role,first_name,last_name,email,phone,password_hash,profile_img FROM users WHERE (email=? OR phone=?) AND role=?",(login_id,login_id,role)).fetchone())
        conn.close()
        if not user or not bcrypt.checkpw(password.encode(),user['password_hash'].encode()): return jsonify({'error':'Invalid credentials'}),401
        session['user_id']=user['id']; session['role']=user['role']
        session['name']=f"{user['first_name']} {user['last_name']}"; session['email']=user['email']
        session['profile_img']=user.get('profile_img') or ''
        return jsonify({'success':True,'message':f"Welcome back {user['first_name']}!",'user':{'id':user['id'],'role':user['role'],'name':session['name'],'email':user['email'],'profile_img':session['profile_img']},'dashboard_url':f"/dashboard/{user['role']}"})
    except Exception as e:
        print("Login error:",e); return jsonify({'error':'Login failed'}),500

@app.route('/api/validate-session')
def validate_session():
    if 'user_id' in session: return jsonify({'valid':True,'role':session.get('role')})
    return jsonify({'valid':False}),401

@app.route('/api/user')
def get_user():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    return jsonify({'name':session.get('name'),'email':session.get('email'),'role':session.get('role'),'profile_img':session.get('profile_img','')})

@app.route('/api/logout')
def logout():
    session.clear(); return jsonify({'message':'logged out'})

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json(); email = data.get('email','').strip().lower()
        if not validate_email(email): return jsonify({'error':'Invalid email'}),400
        conn = get_connection()
        user = dict_row(conn.execute("SELECT id,first_name FROM users WHERE email=?",(email,)).fetchone())
        conn.close()
        if user:
            token = generate_reset_token(app,email)
            send_forgot_password_email(app,email,user['first_name'],token)
        return jsonify({'success':True,'message':'If that email exists, a reset link has been sent.'})
    except Exception as e:
        print("Forgot password error:",e); return jsonify({'error':'Server error'}),500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token','').strip(); new_pass = data.get('new_password',''); confirm = data.get('confirm_password','')
        if not token or not new_pass: return jsonify({'error':'Token and new password are required'}),400
        if new_pass != confirm: return jsonify({'error':'Passwords do not match'}),400
        ok,msg = validate_password(new_pass)
        if not ok: return jsonify({'error':msg}),400
        email = verify_reset_token(app,token)
        if not email: return jsonify({'error':'Reset link is invalid or has expired'}),400
        conn = get_connection()
        user = dict_row(conn.execute("SELECT id,first_name FROM users WHERE email=?",(email,)).fetchone())
        if not user: conn.close(); return jsonify({'error':'User not found'}),404
        new_hash = bcrypt.hashpw(new_pass.encode(),bcrypt.gensalt()).decode()
        conn.execute("UPDATE users SET password_hash=? WHERE email=?",(new_hash,email))
        conn.commit(); conn.close()
        send_password_changed_email(app,email,user['first_name'])
        return jsonify({'success':True,'message':'Password reset successful. You can now log in.'})
    except Exception as e:
        print("Reset password error:",e); return jsonify({'error':'Server error'}),500

@app.route('/api/signup/send-otp', methods=['POST'])
def signup_send_otp():
    try:
        data = request.get_json()

        first_name = data.get('first_name','').strip()
        last_name  = data.get('last_name','').strip()
        email      = data.get('email','').strip().lower()
        phone      = data.get('phone','').strip() or None
        password   = data.get('password','')
        role       = data.get('role','farmer').lower().replace('-','_')

        if role not in ['farmer','customer','service_provider']:
            return jsonify({'error':'Invalid role'}),400

        if not all([first_name,last_name,email,password]):
            return jsonify({'error':'All fields are required'}),400

        if len(first_name)>20 or len(last_name)>20:
            return jsonify({'error':'Name max 20 characters'}),400

        if not validate_email(email):
            return jsonify({'error':'Invalid email format'}),400

        if phone and not validate_phone(phone):
            return jsonify({'error':'Invalid phone number'}),400

        ok,msg = validate_password(password)
        if not ok:
            return jsonify({'error':msg}),400

        conn = get_connection()
        cur = conn.cursor()

        # Check email
        cur.execute("SELECT id FROM users WHERE email=%s",(email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error':'Email already registered'}),409

        # Check phone
        if phone:
            cur.execute("SELECT id FROM users WHERE phone=%s",(phone,))
            if cur.fetchone():
                cur.close()
                conn.close()
                return jsonify({'error':'Phone already registered'}),409

        cur.close()
        conn.close()

        otp = str(random.randint(100000,999999))

        _otp_store[email] = {
            'otp': otp,
            'expires': time.time()+300,
            'user_data': {
                'first_name':first_name,
                'last_name':last_name,
                'email':email,
                'phone':phone,
                'password':password,
                'role':role
            }
        }

        send_otp_email(app,email,first_name,otp)

        return jsonify({'success':True,'message':f'OTP sent to {email}'})

    except Exception as e:
        print("Send OTP error:",e)
        return jsonify({'error':str(e)}),500

@app.route('/api/signup/verify-otp', methods=['POST'])
def signup_verify_otp():
    try:
        data = request.get_json()
        email=data.get('email','').strip().lower(); otp=data.get('otp','').strip()
        entry=_otp_store.get(email)
        if not entry: return jsonify({'error':'No OTP found for this email. Please request a new one.'}),400
        if time.time()>entry['expires']:
            del _otp_store[email]; return jsonify({'error':'OTP has expired. Please request a new one.'}),400
        if entry['otp']!=otp: return jsonify({'error':'Incorrect OTP. Please try again.'}),400
        ud=entry['user_data']
        hashed=bcrypt.hashpw(ud['password'].encode(),bcrypt.gensalt()).decode()
        conn=get_connection()
        if dict_row(conn.execute("SELECT id FROM users WHERE email=?",(ud['email'],)).fetchone()):
            conn.close(); del _otp_store[email]; return jsonify({'error':'Email already registered'}),409
        cur=conn.execute("INSERT INTO users (role,first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?,?)",(ud['role'],ud['first_name'],ud['last_name'],ud['email'],ud['phone'],hashed))
        user_id=cur.lastrowid; conn.commit(); conn.close()
        del _otp_store[email]
        send_welcome_email(app,ud['email'],ud['first_name'],ud['role'])
        return jsonify({'success':True,'user_id':user_id,'role':ud['role']}),201
    except Exception as e:
        print("Verify OTP error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/signup/resend-otp', methods=['POST'])
def signup_resend_otp():
    try:
        data=request.get_json(); email=data.get('email','').strip().lower()
        entry=_otp_store.get(email)
        if not entry: return jsonify({'error':'Session expired. Please start signup again.'}),400
        otp=str(random.randint(100000,999999)); entry['otp']=otp; entry['expires']=time.time()+300
        send_otp_email(app,email,entry['user_data']['first_name'],otp)
        return jsonify({'success':True,'message':'New OTP sent!'})
    except Exception as e: return jsonify({'error':str(e)}),500

# MARKET PRICES
@app.route('/api/market-prices', methods=['GET'])
def get_market_prices():
    try:
        conn=get_connection(); row=dict_row(conn.execute("SELECT data,updated_at FROM market_prices WHERE id=1").fetchone()); conn.close()
        prices=json.loads(row['data']) if row and row.get('data') else DEFAULT_MARKET_PRICES
        updated_at=row.get('updated_at') if row else None
        flat=[{**item,'category':cat} for cat,items in prices.items() for item in items]
        return jsonify({'prices':prices,'flat':flat,'updated_at':updated_at})
    except Exception as e:
        flat=[{**item,'category':cat} for cat,items in DEFAULT_MARKET_PRICES.items() for item in items]
        return jsonify({'prices':DEFAULT_MARKET_PRICES,'flat':flat,'updated_at':None})

# PROFILE
@app.route('/api/profile', methods=['GET'])
def get_profile():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    user=dict_row(conn.execute("SELECT id,role,first_name,last_name,email,phone,gender,dob,profile_img,address,village,district,state,pincode,aadhar,pan,farm_size,farm_type,bio,dl_number,dl_expiry,dl_type,dl_rto,vehicle_reg,vehicle_type,vehicle_reg_expiry,insurance,created_at FROM users WHERE id=?",(session['user_id'],)).fetchone())
    conn.close()
    if not user: return jsonify({'error':'User not found'}),404
    return jsonify(user)

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        g = lambda k,d='': request.form.get(k,d)
        first_name=g('first_name').strip(); last_name=g('last_name').strip()
        phone=g('phone').strip() or None
        if not first_name or not last_name: return jsonify({'error':'Name is required'}),400
        if phone and not validate_phone(phone): return jsonify({'error':'Invalid phone number'}),400
        profile_img=None
        img_file=request.files.get('profile_img')
        if img_file and img_file.filename:
            try:
                result=cloudinary.uploader.upload(img_file,folder='agriconnect/profiles',transformation=[{'width':400,'height':400,'crop':'fill','gravity':'face'}])
                profile_img=result['secure_url']
            except Exception as e:
                print("Profile image upload error:",e); return jsonify({'error':'Image upload failed'}),500
        fields=(first_name,last_name,phone,g('gender') or None,g('dob') or None,g('address') or None,g('village') or None,g('district') or None,g('state') or None,g('pincode') or None,g('aadhar') or None,g('pan') or None,g('farm_size') or None,g('farm_type') or None,g('bio') or None,g('dl_number') or None,g('dl_expiry') or None,g('dl_type') or None,g('dl_rto') or None,g('vehicle_reg') or None,g('vehicle_type') or None,g('vehicle_reg_expiry') or None,g('insurance') or None)
        conn=get_connection()
        if profile_img:
            conn.execute("UPDATE users SET first_name=?,last_name=?,phone=?,gender=?,dob=?,profile_img=?,address=?,village=?,district=?,state=?,pincode=?,aadhar=?,pan=?,farm_size=?,farm_type=?,bio=?,dl_number=?,dl_expiry=?,dl_type=?,dl_rto=?,vehicle_reg=?,vehicle_type=?,vehicle_reg_expiry=?,insurance=? WHERE id=?",(*fields[:5],profile_img,*fields[5:],session['user_id']))
        else:
            conn.execute("UPDATE users SET first_name=?,last_name=?,phone=?,gender=?,dob=?,address=?,village=?,district=?,state=?,pincode=?,aadhar=?,pan=?,farm_size=?,farm_type=?,bio=?,dl_number=?,dl_expiry=?,dl_type=?,dl_rto=?,vehicle_reg=?,vehicle_type=?,vehicle_reg_expiry=?,insurance=? WHERE id=?",(*fields,session['user_id']))
        conn.commit()
        session['name']=f"{first_name} {last_name}"
        if profile_img: session['profile_img']=profile_img
        else:
            row=dict_row(conn.execute("SELECT profile_img FROM users WHERE id=?",(session['user_id'],)).fetchone())
            if row and row.get('profile_img'): session['profile_img']=row['profile_img']
        conn.close()
        if session.get('email'): send_profile_updated_email(app,session['email'],session['name'])
        return jsonify({'success':True,'name':session['name'],'profile_img':session.get('profile_img','')})
    except Exception as e:
        print("Update profile error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/send-password-otp', methods=['POST'])
def send_password_otp():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json()
        cur_p=data.get('current_password','').strip(); new_p=data.get('new_password','').strip(); conf_p=data.get('confirm_password','').strip()
        if not cur_p or not new_p or not conf_p: return jsonify({'error':'All fields are required'}),400
        if new_p!=conf_p: return jsonify({'error':'New passwords do not match'}),400
        ok,msg=validate_password(new_p)
        if not ok: return jsonify({'error':msg}),400
        conn=get_connection()
        user=dict_row(conn.execute("SELECT password_hash,email,first_name FROM users WHERE id=?",(session['user_id'],)).fetchone()); conn.close()
        if not user or not bcrypt.checkpw(cur_p.encode(),user['password_hash'].encode()): return jsonify({'error':'Current password is incorrect'}),401
        otp=str(random.randint(100000,999999))
        session['pw_otp']=otp; session['pw_otp_expiry']=(datetime.utcnow()+timedelta(minutes=10)).isoformat()
        session['pw_new_hash']=bcrypt.hashpw(new_p.encode(),bcrypt.gensalt()).decode(); session.modified=True
        send_otp_email(app,user['email'],user['first_name'],otp)
        return jsonify({'success':True,'message':f"OTP sent to {user['email'][:3]}***{user['email'].split('@')[1]}"})
    except Exception as e:
        print("Send OTP error:",e); return jsonify({'error':'Server error'}),500

@app.route('/api/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json()
        cur_p=data.get('current_password','').strip(); new_p=data.get('new_password','').strip()
        conf_p=data.get('confirm_password','').strip(); otp_in=data.get('otp','').strip()
        if not otp_in: return jsonify({'error':'OTP is required'}),400
        stored_otp=session.get('pw_otp'); stored_exp=session.get('pw_otp_expiry'); stored_hash=session.get('pw_new_hash')
        if not stored_otp or not stored_exp or not stored_hash: return jsonify({'error':'No OTP found. Please request a new one.'}),400
        if datetime.utcnow()>datetime.fromisoformat(stored_exp):
            for k in ['pw_otp','pw_otp_expiry','pw_new_hash']: session.pop(k,None)
            return jsonify({'error':'OTP has expired. Please request a new one.'}),400
        if otp_in!=stored_otp: return jsonify({'error':'Invalid OTP. Please try again.'}),401
        if not new_p or new_p!=conf_p: return jsonify({'error':'Password mismatch'}),400
        ok,msg=validate_password(new_p)
        if not ok: return jsonify({'error':msg}),400
        conn=get_connection()
        user=dict_row(conn.execute("SELECT password_hash FROM users WHERE id=?",(session['user_id'],)).fetchone())
        if not user or not bcrypt.checkpw(cur_p.encode(),user['password_hash'].encode()):
            conn.close(); return jsonify({'error':'Current password is incorrect'}),401
        conn.execute("UPDATE users SET password_hash=? WHERE id=?",(stored_hash,session['user_id'])); conn.commit(); conn.close()
        for k in ['pw_otp','pw_otp_expiry','pw_new_hash']: session.pop(k,None)
        if session.get('email'): send_password_changed_email(app,session['email'],session.get('name','User'))
        return jsonify({'success':True,'message':'Password changed successfully'})
    except Exception as e:
        print("Change password error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/account', methods=['DELETE'])
def delete_account():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json(); password=data.get('password','')
        conn=get_connection()
        user=dict_row(conn.execute("SELECT password_hash FROM users WHERE id=?",(session['user_id'],)).fetchone())
        if not user or not bcrypt.checkpw(password.encode(),user['password_hash'].encode()):
            conn.close(); return jsonify({'error':'Incorrect password'}),401
        uid=session['user_id']
        for sql in ["DELETE FROM notifications WHERE user_id=?","DELETE FROM support_tickets WHERE user_id=?","DELETE FROM cart_items WHERE user_id=?","DELETE FROM listings WHERE user_id=?","DELETE FROM users WHERE id=?"]:
            conn.execute(sql,(uid,))
        conn.execute("DELETE FROM orders WHERE customer_id=? OR farmer_id=?",(uid,uid))
        conn.commit(); conn.close(); session.clear()
        return jsonify({'success':True,'message':'Account deleted'})
    except Exception as e:
        print("Delete account error:",e); return jsonify({'error':str(e)}),500

# SUPPORT
@app.route('/api/support/faq', methods=['GET'])
def get_faq():
    role=session.get('role','farmer')
    conn=get_connection()
    faqs=dict_rows(conn.execute("SELECT * FROM faq WHERE is_active=1 AND (role=? OR role='all') ORDER BY sort_order ASC,id ASC",(role,)).fetchall())
    conn.close(); return jsonify(faqs)

@app.route('/api/support/tickets', methods=['GET'])
def get_tickets():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    tickets=dict_rows(conn.execute("SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC",(session['user_id'],)).fetchall())
    conn.close(); return jsonify(tickets)

@app.route('/api/support/tickets', methods=['POST'])
def create_ticket():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json()
        subject=data.get('subject','').strip(); category=data.get('category','general').strip()
        message=data.get('message','').strip(); priority=data.get('priority','medium').strip()
        if not subject or not message: return jsonify({'error':'Subject and message are required'}),400
        if len(subject)>200: return jsonify({'error':'Subject too long (max 200 chars)'}),400
        conn=get_connection()
        cur=conn.execute("INSERT INTO support_tickets (user_id,subject,category,message,priority) VALUES (?,?,?,?,?)",(session['user_id'],subject,category,message,priority))
        ticket_id=cur.lastrowid; conn.commit(); conn.close()
        push_notification(session['user_id'],f"✅ Support ticket #{ticket_id} submitted: '{subject}'. We'll get back to you within 24 hours.",'info')
        user_email=session.get('email',''); user_name=session.get('name','User')
        if user_email: send_ticket_created_email(app,user_email,user_name,ticket_id,subject,message)
        if ADMIN_EMAIL: send_ticket_new_admin_email(app,ADMIN_EMAIL,ticket_id,user_name,subject,message)
        return jsonify({'success':True,'ticket_id':ticket_id}),201
    except Exception as e:
        print("Create ticket error:",e); return jsonify({'error':str(e)}),500

# LISTINGS
@app.route('/api/listings', methods=['POST'])
def add_listing():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        g=lambda k,d='':request.form.get(k,d)
        produce=g('produce').strip()
        if not produce: return jsonify({'error':'Produce name is required'}),400
        image_urls=_upload_images(request.files.getlist('images'))
        conn=get_connection()
        conn.execute("INSERT INTO listings (user_id,produce,variety,category,grade,quantity,price,min_price,available_from,valid_until,location,storage,packaging,harvest_date,transport,description,image_urls,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(session['user_id'],produce,g('variety').strip(),g('category','vegetables').strip(),g('grade').strip() or None,g('qty',0),g('price',0),g('minprice') or None,g('from') or None,g('till') or None,g('location').strip(),g('storage') or None,g('pack') or None,g('harvest') or None,g('transport') or None,g('desc') or None,','.join(image_urls),g('status','active')))
        conn.commit(); conn.close(); return jsonify({'success':True})
    except Exception as e:
        print("Add listing error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/listings/<int:listing_id>', methods=['PUT'])
def update_listing(listing_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        g=lambda k,d='':request.form.get(k,d)
        produce=g('produce').strip(); variety=g('variety').strip(); category=g('category','vegetables').strip()
        grade=g('grade').strip() or None; qty=g('qty',0); price=g('price',0); min_price=g('minprice') or None
        location=g('location').strip(); avail_from=g('from') or None; valid_till=g('till') or None
        storage=g('storage') or None; packaging=g('pack') or None; harvest=g('harvest') or None
        transport=g('transport') or None; desc=g('desc') or None; status=g('status','active')
        new_images=_upload_images(request.files.getlist('images'))
        conn=get_connection()
        if new_images:
            conn.execute("UPDATE listings SET produce=?,variety=?,category=?,grade=?,quantity=?,price=?,min_price=?,location=?,available_from=?,valid_until=?,storage=?,packaging=?,harvest_date=?,transport=?,description=?,image_urls=?,status=? WHERE id=? AND user_id=?",(produce,variety,category,grade,qty,price,min_price,location,avail_from,valid_till,storage,packaging,harvest,transport,desc,','.join(new_images),status,listing_id,session['user_id']))
        else:
            conn.execute("UPDATE listings SET produce=?,variety=?,category=?,grade=?,quantity=?,price=?,min_price=?,location=?,available_from=?,valid_until=?,storage=?,packaging=?,harvest_date=?,transport=?,description=?,status=? WHERE id=? AND user_id=?",(produce,variety,category,grade,qty,price,min_price,location,avail_from,valid_till,storage,packaging,harvest,transport,desc,status,listing_id,session['user_id']))
        conn.commit(); conn.close(); return jsonify({'success':True})
    except Exception as e:
        print("Update listing error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/listings', methods=['GET'])
def get_listings():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    data=dict_rows(conn.execute("SELECT * FROM listings WHERE user_id=? ORDER BY created_at DESC",(session['user_id'],)).fetchall())
    conn.close()
    for row in data:
        if not row.get('category'): row['category']='vegetables'
    return jsonify(data)

@app.route('/api/listings/<int:listing_id>', methods=['DELETE'])
def delete_listing(listing_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection(); conn.execute("DELETE FROM listings WHERE id=? AND user_id=?",(listing_id,session['user_id'])); conn.commit(); conn.close()
    return jsonify({'success':True})

@app.route('/api/market-listings')
def market_listings():
    category=request.args.get('category','').strip()
    conn=get_connection()
    if category and category!='all':
        data=dict_rows(conn.execute("SELECT l.*,u.first_name,u.last_name FROM listings l JOIN users u ON l.user_id=u.id WHERE l.status='active' AND l.category=? ORDER BY l.created_at DESC",(category,)).fetchall())
    else:
        data=dict_rows(conn.execute("SELECT l.*,u.first_name,u.last_name FROM listings l JOIN users u ON l.user_id=u.id WHERE l.status='active' ORDER BY l.created_at DESC").fetchall())
    conn.close()
    for row in data:
        if not row.get('category'): row['category']='vegetables'
    return jsonify(data)

@app.route('/api/farmers')
def get_farmers():
    conn=get_connection()
    farmers=dict_rows(conn.execute("SELECT u.id,u.first_name,u.last_name,u.profile_img,COUNT(l.id) AS listing_count,GROUP_CONCAT(DISTINCT l.produce) AS produces,GROUP_CONCAT(DISTINCT l.location) AS locations FROM users u LEFT JOIN listings l ON u.id=l.user_id AND l.status='active' WHERE u.role='farmer' GROUP BY u.id ORDER BY listing_count DESC,u.created_at DESC LIMIT 20").fetchall())
    conn.close(); return jsonify(farmers)

# CART
@app.route('/api/cart', methods=['GET'])
def get_cart():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    items=dict_rows(conn.execute("SELECT ci.id,ci.listing_id,ci.quantity,l.produce,l.price,l.image_urls,l.location,l.quantity AS stock,l.category,u.first_name,u.last_name FROM cart_items ci JOIN listings l ON ci.listing_id=l.id JOIN users u ON l.user_id=u.id WHERE ci.user_id=?",(session['user_id'],)).fetchall())
    conn.close(); return jsonify(items)

@app.route('/api/cart', methods=['POST'])
def add_to_cart():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    data=request.get_json(); listing_id=data.get('listing_id'); quantity=data.get('quantity',1)
    if not listing_id: return jsonify({'error':'listing_id required'}),400
    conn=get_connection()
    conn.execute("INSERT INTO cart_items (user_id,listing_id,quantity) VALUES (?,?,?) ON CONFLICT(user_id,listing_id) DO UPDATE SET quantity=quantity+excluded.quantity",(session['user_id'],listing_id,quantity))
    conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/cart/<int:item_id>', methods=['PUT'])
def update_cart_item(item_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    data=request.get_json(); quantity=data.get('quantity',1)
    if quantity<1: return jsonify({'error':'Quantity must be at least 1'}),400
    conn=get_connection(); conn.execute("UPDATE cart_items SET quantity=? WHERE id=? AND user_id=?",(quantity,item_id,session['user_id'])); conn.commit(); conn.close()
    return jsonify({'success':True})

@app.route('/api/cart/clear', methods=['DELETE'])
def clear_cart():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection(); conn.execute("DELETE FROM cart_items WHERE user_id=?",(session['user_id'],)); conn.commit(); conn.close()
    return jsonify({'success':True})

# ORDERS
@app.route('/api/orders', methods=['POST'])
def place_order():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    data=request.get_json(); listing_id=data.get('listing_id'); quantity=float(data.get('quantity',1)); delivery=data.get('delivery_address','')
    conn=get_connection()
    listing=dict_row(conn.execute("SELECT * FROM listings WHERE id=? AND status='active'",(listing_id,)).fetchone())
    if not listing: conn.close(); return jsonify({'error':'Listing not found or not active'}),404
    total_price=float(listing['price'])*quantity; farmer_id=listing['user_id']; customer_name=session.get('name','A customer')
    cur=conn.execute("INSERT INTO orders (customer_id,farmer_id,listing_id,quantity,unit_price,total_price,delivery_address) VALUES (?,?,?,?,?,?,?)",(session['user_id'],farmer_id,listing_id,quantity,listing['price'],total_price,delivery))
    order_id=cur.lastrowid
    conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,'info')",(farmer_id,f"🛒 New order #{order_id}: {listing['produce']} — {quantity} kg from {customer_name}. Total: ₹{total_price:,.0f}"))
    conn.commit()
    farmer_row=dict_row(conn.execute("SELECT email,first_name FROM users WHERE id=?",(farmer_id,)).fetchone()); conn.close()
    if farmer_row and farmer_row.get('email'): send_order_placed_email(app,farmer_row['email'],farmer_row['first_name'],customer_name,order_id,listing['produce'],quantity,total_price)
    return jsonify({'success':True,'order_id':order_id})

@app.route('/api/orders/customer', methods=['GET'])
def get_customer_orders():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    orders=dict_rows(conn.execute("SELECT o.*,l.produce,l.image_urls,l.location AS farm_location,u.first_name AS farmer_first,u.last_name AS farmer_last FROM orders o JOIN listings l ON o.listing_id=l.id JOIN users u ON o.farmer_id=u.id WHERE o.customer_id=? ORDER BY o.created_at DESC",(session['user_id'],)).fetchall())
    conn.close(); return jsonify(orders)

@app.route('/api/orders/farmer', methods=['GET'])
def get_farmer_orders():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    orders=dict_rows(conn.execute("SELECT o.*,l.produce,l.image_urls,u.first_name AS customer_first,u.last_name AS customer_last,u.phone AS customer_phone FROM orders o JOIN listings l ON o.listing_id=l.id JOIN users u ON o.customer_id=u.id WHERE o.farmer_id=? ORDER BY o.created_at DESC",(session['user_id'],)).fetchall())
    conn.close(); return jsonify(orders)

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    data=request.get_json(); new_status=data.get('status','')
    valid_transitions={'pending':['accepted','rejected'],'accepted':['ready_to_ship'],'ready_to_ship':['shipped'],'shipped':['delivered'],'delivered':[],'rejected':[]}
    conn=get_connection()
    order=dict_row(conn.execute("SELECT o.status,o.customer_id,l.produce FROM orders o JOIN listings l ON o.listing_id=l.id WHERE o.id=? AND o.farmer_id=?",(order_id,session['user_id'])).fetchone())
    if not order: conn.close(); return jsonify({'error':'Order not found'}),404
    if new_status not in valid_transitions.get(order['status'],[]): conn.close(); return jsonify({'error':f"Cannot move from '{order['status']}' to '{new_status}'"}),400
    conn.execute("UPDATE orders SET status=? WHERE id=?",(new_status,order_id))
    messages={'accepted':f"✅ Your order #{order_id} for {order['produce']} was accepted!",'rejected':f"❌ Your order #{order_id} for {order['produce']} was rejected.",'ready_to_ship':f"📦 Order #{order_id} ({order['produce']}) is packed & ready to ship!",'shipped':f"🚚 Order #{order_id} ({order['produce']}) is on its way!",'delivered':f"🎉 Order #{order_id} ({order['produce']}) has been delivered!"}
    types={'accepted':'success','rejected':'error','ready_to_ship':'info','shipped':'info','delivered':'success'}
    conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,?)",(order['customer_id'],messages[new_status],types[new_status])); conn.commit()
    cust_row=dict_row(conn.execute("SELECT email,first_name FROM users WHERE id=?",(order['customer_id'],)).fetchone()); conn.close()
    if cust_row and cust_row.get('email'): send_order_status_email(app,cust_row['email'],cust_row['first_name'],order_id,order['produce'],new_status)
    return jsonify({'success':True})

# NOTIFICATIONS
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection()
    notifs=dict_rows(conn.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 40",(session['user_id'],)).fetchall())
    conn.close(); return jsonify(notifs)

@app.route('/api/notifications/unread-count', methods=['GET'])
def notif_unread_count():
    if 'user_id' not in session: return jsonify({'count':0})
    conn=get_connection(); row=conn.execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0",(session['user_id'],)).fetchone()
    count=row[0] if row else 0; conn.close(); return jsonify({'count':count})

@app.route('/api/notifications/mark-read', methods=['POST'])
def mark_notifications_read():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection(); conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?",(session['user_id'],)); conn.commit(); conn.close()
    return jsonify({'success':True})

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        file=request.files.get('file'); img_type=request.form.get('type','service')
        if not file or not file.filename: return jsonify({'error':'No file provided'}),400
        folder_map={'service':'agriconnect/service_listings','profile':'agriconnect/profiles'}
        result=cloudinary.uploader.upload(file,folder=folder_map.get(img_type,'agriconnect/misc'),transformation=[{'width':1200,'height':900,'crop':'limit','quality':'auto','fetch_format':'auto'}])
        return jsonify({'url':result['secure_url'],'public_id':result['public_id']})
    except Exception as e:
        print("Image upload error:",e); return jsonify({'error':'Upload failed'}),500

# SERVICE LISTINGS
@app.route('/api/service-listings', methods=['POST'])
def create_service_listing():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json(); conn=get_connection()
        cur=conn.execute("INSERT INTO service_listings (user_id,service_type,name,sub_type,reg_no,model,year,capacity,available_space,fuel,condition,operator,humidity,temp_range,nearest_apmc,routes,price,per_km,min_days,location,status,features,description,image_urls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(session['user_id'],data.get('service_type','transport'),data.get('name',''),data.get('sub_type',''),data.get('reg_no',''),data.get('model',''),data.get('year') or None,data.get('capacity',''),data.get('available_space',''),data.get('fuel',''),data.get('condition','Good'),data.get('operator',''),data.get('humidity',''),data.get('temp_range',''),data.get('nearest_apmc',''),data.get('routes',''),float(data.get('price') or 0),float(data.get('per_km') or 0),int(data.get('min_days') or 1),data.get('location',''),data.get('status','available'),data.get('features','[]'),data.get('description',''),data.get('image_urls','[]')))
        new_id=cur.lastrowid; conn.commit(); conn.close()
        push_notification(session['user_id'],f"✅ New service listed: {data.get('name','')} ({data.get('service_type','').capitalize()})",'success')
        return jsonify({'success':True,'id':new_id}),201
    except Exception as e:
        print("Create service listing error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-listings', methods=['GET'])
def get_service_listings():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        conn=get_connection()
        rows=dict_rows(conn.execute("SELECT * FROM service_listings WHERE user_id=? ORDER BY created_at DESC",(session['user_id'],)).fetchall())
        conn.close(); return jsonify(rows)
    except Exception as e:
        print("Get service listings error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-listings/public', methods=['GET'])
def get_public_service_listings():
    service_type=request.args.get('type',''); location=request.args.get('location','')
    try:
        conn=get_connection()
        query="SELECT sl.*,u.first_name,u.last_name,u.phone AS provider_phone FROM service_listings sl JOIN users u ON sl.user_id=u.id WHERE sl.status='available'"
        params=[]
        if service_type: query+=" AND sl.service_type=?"; params.append(service_type)
        if location: query+=" AND sl.location LIKE ?"; params.append(f'%{location}%')
        query+=" ORDER BY sl.created_at DESC"
        rows=dict_rows(conn.execute(query,params).fetchall()); conn.close(); return jsonify(rows)
    except Exception as e:
        print("Get public listings error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-listings/<int:listing_id>', methods=['PUT'])
def update_service_listing(listing_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json(); conn=get_connection()
        conn.execute("UPDATE service_listings SET service_type=?,name=?,sub_type=?,reg_no=?,model=?,year=?,capacity=?,available_space=?,fuel=?,condition=?,operator=?,humidity=?,temp_range=?,nearest_apmc=?,routes=?,price=?,per_km=?,min_days=?,location=?,status=?,features=?,description=?,image_urls=?,updated_at=datetime('now') WHERE id=? AND user_id=?",(data.get('service_type','transport'),data.get('name',''),data.get('sub_type',''),data.get('reg_no',''),data.get('model',''),data.get('year') or None,data.get('capacity',''),data.get('available_space',''),data.get('fuel',''),data.get('condition','Good'),data.get('operator',''),data.get('humidity',''),data.get('temp_range',''),data.get('nearest_apmc',''),data.get('routes',''),float(data.get('price') or 0),float(data.get('per_km') or 0),int(data.get('min_days') or 1),data.get('location',''),data.get('status','available'),data.get('features','[]'),data.get('description',''),data.get('image_urls','[]'),listing_id,session['user_id']))
        conn.commit(); conn.close(); return jsonify({'success':True})
    except Exception as e:
        print("Update service listing error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-listings/<int:listing_id>', methods=['DELETE'])
def delete_service_listing(listing_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        conn=get_connection(); conn.execute("DELETE FROM service_listings WHERE id=? AND user_id=?",(listing_id,session['user_id'])); conn.commit(); conn.close()
        return jsonify({'success':True})
    except Exception as e:
        print("Delete service listing error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-bookings', methods=['GET'])
def get_service_bookings():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        conn=get_connection()
        rows=dict_rows(conn.execute("SELECT sb.*,sl.name AS service_name,sl.service_type,sl.price,u.first_name AS customer_first,u.last_name AS customer_last,u.phone AS customer_phone FROM service_bookings sb JOIN service_listings sl ON sb.listing_id=sl.id JOIN users u ON sb.customer_id=u.id WHERE sl.user_id=? ORDER BY sb.created_at DESC",(session['user_id'],)).fetchall())
        conn.close()
        for row in rows: row['customer']=f"{row['customer_first']} {row['customer_last']}"
        return jsonify(rows)
    except Exception as e:
        print("Get service bookings error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-bookings/<int:booking_id>/status', methods=['PUT'])
def update_service_booking_status(booking_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json(); new_status=data.get('status','')
        if new_status not in ['pending','accepted','rejected','active','completed']: return jsonify({'error':'Invalid status'}),400
        conn=get_connection()
        booking=dict_row(conn.execute("SELECT sb.*,sl.name AS service_name,sb.customer_id FROM service_bookings sb JOIN service_listings sl ON sb.listing_id=sl.id WHERE sb.id=? AND sl.user_id=?",(booking_id,session['user_id'])).fetchone())
        if not booking: conn.close(); return jsonify({'error':'Booking not found'}),404
        conn.execute("UPDATE service_bookings SET status=?,updated_at=datetime('now') WHERE id=?",(new_status,booking_id))
        msgs={'accepted':f"✅ Your service booking #{booking_id} ({booking['service_name']}) has been accepted!",'rejected':f"❌ Your service booking #{booking_id} ({booking['service_name']}) was rejected.",'active':f"🚀 Service booking #{booking_id} ({booking['service_name']}) is now active!",'completed':f"🎉 Service booking #{booking_id} ({booking['service_name']}) completed!"}
        if new_status in msgs:
            notif_type='success' if new_status in ('accepted','completed') else 'error' if new_status=='rejected' else 'info'
            conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,?)",(booking['customer_id'],msgs[new_status],notif_type))
        conn.commit()
        cust_row=dict_row(conn.execute("SELECT email,first_name FROM users WHERE id=?",(booking['customer_id'],)).fetchone()); conn.close()
        if cust_row and cust_row.get('email') and new_status in msgs: send_service_booking_status_email(app,cust_row['email'],cust_row['first_name'],booking_id,booking['service_name'],new_status)
        return jsonify({'success':True})
    except Exception as e:
        print("Update service booking status error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/service-bookings', methods=['POST'])
def create_service_booking():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json(); listing_id=data.get('listing_id')
        if not listing_id: return jsonify({'error':'listing_id is required'}),400
        conn=get_connection()
        listing=dict_row(conn.execute("SELECT id,user_id,name,service_type,status FROM service_listings WHERE id=?",(listing_id,)).fetchone())
        if not listing: conn.close(); return jsonify({'error':'Listing not found'}),404
        if listing['status']!='available': conn.close(); return jsonify({'error':'This service is not currently available'}),400
        booking_date=data.get('booking_date'); duration_days=int(data.get('duration_days') or 1)
        quantity=float(data.get('quantity') or 1); location=data.get('location',''); notes=data.get('notes',''); amount=float(data.get('amount') or 0)
        cur=conn.execute("INSERT INTO service_bookings (listing_id,customer_id,booking_date,duration_days,quantity,location,notes,amount,status) VALUES (?,?,?,?,?,?,?,?,'pending')",(listing_id,session['user_id'],booking_date or None,duration_days,quantity,location,notes,amount))
        booking_id=cur.lastrowid; farmer_name=session.get('name','A farmer')
        conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,'info')",(listing['user_id'],f"📋 New booking request #{booking_id} for '{listing['name']}' from {farmer_name}. Check your dashboard to accept or reject."))
        conn.commit()
        prov_row=dict_row(conn.execute("SELECT email,first_name FROM users WHERE id=?",(listing['user_id'],)).fetchone()); conn.close()
        if prov_row and prov_row.get('email'): send_service_booking_request_email(app,prov_row['email'],prov_row['first_name'],booking_id,listing['name'],farmer_name,booking_date,amount)
        return jsonify({'success':True,'booking_id':booking_id}),201
    except Exception as e:
        print("Create service booking error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/my-service-bookings', methods=['GET'])
def get_my_service_bookings():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    service_type=request.args.get('type','')
    try:
        conn=get_connection()
        query="SELECT sb.*,sl.name AS service_name,sl.service_type,sl.price AS unit_price,sl.location AS facility_location,u.first_name AS provider_first,u.last_name AS provider_last,u.phone AS provider_phone FROM service_bookings sb JOIN service_listings sl ON sb.listing_id=sl.id JOIN users u ON sl.user_id=u.id WHERE sb.customer_id=?"
        params=[session['user_id']]
        if service_type: query+=" AND sl.service_type=?"; params.append(service_type)
        query+=" ORDER BY sb.created_at DESC"
        rows=dict_rows(conn.execute(query,params).fetchall()); conn.close()
        for row in rows: row['provider_name']=f"{row['provider_first']} {row['provider_last']}"
        return jsonify(rows)
    except Exception as e:
        print("Get my service bookings error:",e); return jsonify({'error':str(e)}),500

# ADMIN
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data=request.get_json(); email=data.get('email','').strip().lower(); password=data.get('password','')
    conn=get_connection(); admin=dict_row(conn.execute("SELECT * FROM admin_users WHERE email=?",(email,)).fetchone()); conn.close()
    if not admin or not bcrypt.checkpw(password.encode(),admin['password_hash'].encode()): return jsonify({'error':'Invalid credentials'}),401
    session['user_id']=f"admin_{admin['id']}"; session['name']=admin['name']; session['email']=admin['email']; session['role']='admin'; session['is_admin']=True
    return jsonify({'success':True})

@app.route('/api/admin/users')
@admin_required
def admin_get_users():
    conn=get_connection()
    users=dict_rows(conn.execute("SELECT id,role,first_name,last_name,email,phone,profile_img,gender,dob,state,district,village,pincode,farm_size,farm_type,bio,created_at FROM users ORDER BY created_at DESC").fetchall())
    conn.close(); return jsonify(users)

@app.route('/api/admin/users/<int:uid>', methods=['PUT'])
@admin_required
def admin_update_user(uid):
    data=request.get_json(); conn=get_connection()
    conn.execute("UPDATE users SET first_name=?,last_name=?,email=?,phone=?,state=?,district=? WHERE id=?",(data.get('first_name'),data.get('last_name'),data.get('email'),data.get('phone') or None,data.get('state'),data.get('district'),uid))
    conn.commit(); conn.close()
    target_email=data.get('email',''); target_name=f"{data.get('first_name','')} {data.get('last_name','')}".strip()
    if target_email: send_admin_user_updated_email(app,target_email,target_name)
    return jsonify({'success':True})

@app.route('/api/admin/users/<int:uid>', methods=['DELETE'])
@admin_required
def admin_delete_user(uid):
    conn=get_connection()
    del_user=dict_row(conn.execute("SELECT email,first_name FROM users WHERE id=?",(uid,)).fetchone())
    if del_user and del_user.get('email'): send_admin_user_deleted_email(app,del_user['email'],del_user['first_name'])
    for sql in ["DELETE FROM notifications WHERE user_id=?","DELETE FROM support_tickets WHERE user_id=?","DELETE FROM cart_items WHERE user_id=?","DELETE FROM listings WHERE user_id=?","DELETE FROM users WHERE id=?"]:
        conn.execute(sql,(uid,))
    conn.execute("DELETE FROM orders WHERE customer_id=? OR farmer_id=?",(uid,uid))
    conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/admin/create-user', methods=['POST'])
@admin_required
def admin_create_user():
    data=request.get_json(); role=data.get('role','admin')
    hashed=bcrypt.hashpw(data.get('password','').encode(),bcrypt.gensalt()).decode()
    if role=='admin':
        conn=get_connection(); conn.execute("INSERT INTO admin_users (name,email,password_hash) VALUES (?,?,?)",(f"{data.get('first_name','')} {data.get('last_name','')}".strip(),data.get('email'),hashed)); conn.commit(); conn.close()
    return jsonify({'success':True})

@app.route('/api/admin/listings')
@admin_required
def admin_get_listings():
    conn=get_connection(); data=dict_rows(conn.execute("SELECT l.*,u.first_name,u.last_name FROM listings l JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC").fetchall()); conn.close()
    return jsonify(data)

@app.route('/api/admin/listings/<int:lid>', methods=['DELETE'])
@admin_required
def admin_delete_listing(lid):
    conn=get_connection()
    listing_row=dict_row(conn.execute("SELECT l.produce,u.email,u.first_name FROM listings l JOIN users u ON l.user_id=u.id WHERE l.id=?",(lid,)).fetchone())
    conn.execute("DELETE FROM listings WHERE id=?",(lid,)); conn.commit(); conn.close()
    if listing_row and listing_row.get('email'): send_listing_deleted_by_admin_email(app,listing_row['email'],listing_row['first_name'],listing_row['produce'])
    return jsonify({'success':True})

@app.route('/api/admin/orders')
@admin_required
def admin_get_orders():
    conn=get_connection()
    data=dict_rows(conn.execute("SELECT o.*,l.produce,uc.first_name AS customer_first,uc.last_name AS customer_last,uf.first_name AS farmer_first,uf.last_name AS farmer_last FROM orders o JOIN listings l ON o.listing_id=l.id JOIN users uc ON o.customer_id=uc.id JOIN users uf ON o.farmer_id=uf.id ORDER BY o.created_at DESC").fetchall())
    conn.close(); return jsonify(data)

@app.route('/api/admin/tickets')
@admin_required
def admin_get_tickets():
    conn=get_connection()
    data=dict_rows(conn.execute("SELECT t.*,(u.first_name||' '||u.last_name) AS user_name FROM support_tickets t JOIN users u ON t.user_id=u.id ORDER BY t.created_at DESC").fetchall())
    conn.close(); return jsonify(data)

@app.route('/api/admin/tickets/<int:tid>', methods=['PUT'])
@admin_required
def admin_update_ticket(tid):
    data=request.get_json(); status=data.get('status','in_progress'); reply=data.get('reply','').strip()
    conn=get_connection()
    ticket=dict_row(conn.execute("SELECT user_id,subject,status AS old_status FROM support_tickets WHERE id=?",(tid,)).fetchone())
    conn.execute("UPDATE support_tickets SET status=?,reply=?,updated_at=datetime('now') WHERE id=?",(status,reply,tid))
    if ticket:
        status_labels={'open':'is open','in_progress':'is being reviewed','resolved':'has been resolved ✅','closed':'has been closed'}
        label=status_labels.get(status,f"status changed to {status}")
        msg_parts=[f"🎫 Support ticket #{tid} ({ticket['subject'][:40]}) {label}."]
        if reply: msg_parts.append(f" Admin replied: \"{reply[:80]}{'...' if len(reply)>80 else ''}\"")
        notif_type='success' if status=='resolved' else 'info' if status=='in_progress' else 'warn'
        conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,?)",(ticket['user_id'],''.join(msg_parts),notif_type))
    conn.commit()
    if ticket:
        user_row=dict_row(conn.execute("SELECT email FROM users WHERE id=?",(ticket['user_id'],)).fetchone())
        if user_row and user_row.get('email'): send_ticket_reply_email(app,user_row['email'],f"User #{ticket['user_id']}",tid,ticket['subject'],status,reply)
    conn.close(); return jsonify({'success':True})

@app.route('/api/admin/faqs')
@admin_required
def admin_get_faqs():
    conn=get_connection(); data=dict_rows(conn.execute("SELECT * FROM faq ORDER BY sort_order,id").fetchall()); conn.close(); return jsonify(data)

@app.route('/api/admin/faqs', methods=['POST'])
@admin_required
def admin_create_faq():
    data=request.get_json(); conn=get_connection()
    conn.execute("INSERT INTO faq (question,answer,category,role,sort_order,is_active) VALUES (?,?,?,?,?,1)",(data['question'],data['answer'],data.get('category','general'),data.get('role','all'),data.get('sort_order',0)))
    conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/admin/faqs/<int:fid>', methods=['PUT'])
@admin_required
def admin_update_faq(fid):
    data=request.get_json(); conn=get_connection()
    conn.execute("UPDATE faq SET question=?,answer=?,category=?,role=?,sort_order=? WHERE id=?",(data['question'],data['answer'],data.get('category','general'),data.get('role','all'),data.get('sort_order',0),fid))
    conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/admin/faqs/<int:fid>', methods=['DELETE'])
@admin_required
def admin_delete_faq(fid):
    conn=get_connection(); conn.execute("DELETE FROM faq WHERE id=?",(fid,)); conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/admin/broadcast', methods=['POST'])
@admin_required
def admin_broadcast():
    data=request.get_json(); message=data.get('message','').strip(); targets=data.get('targets',['all']); ntype=data.get('type','info')
    if not message: return jsonify({'error':'Message required'}),400
    conn=get_connection(); user_ids=set()
    for target in targets:
        if target=='all': rows=conn.execute("SELECT id FROM users").fetchall()
        elif target=='farmer_customer': rows=conn.execute("SELECT id FROM users WHERE role IN ('farmer','customer')").fetchall()
        elif target=='farmer_provider': rows=conn.execute("SELECT id FROM users WHERE role IN ('farmer','service_provider')").fetchall()
        elif target=='customer_provider': rows=conn.execute("SELECT id FROM users WHERE role IN ('customer','service_provider')").fetchall()
        else: rows=conn.execute("SELECT id FROM users WHERE role=?",(target,)).fetchall()
        for row in rows: user_ids.add(row[0])
    for uid in user_ids: conn.execute("INSERT INTO notifications (user_id,message,type,is_read) VALUES (?,?,?,0)",(uid,message,ntype))
    conn.commit()
    if user_ids:
        placeholders=','.join(['?']*len(user_ids))
        email_rows=conn.execute(f"SELECT email FROM users WHERE id IN ({placeholders})",tuple(user_ids)).fetchall()
        email_list=[r[0] for r in email_rows if r[0]]
        if email_list: send_admin_broadcast_email(app,email_list,message,ntype)
    conn.close(); return jsonify({'success':True,'count':len(user_ids)})

@app.route('/api/admin/market-prices', methods=['GET'])
@admin_required
def admin_get_market_prices():
    try:
        conn=get_connection(); row=dict_row(conn.execute("SELECT data,updated_at FROM market_prices WHERE id=1").fetchone()); conn.close()
        if row and row.get('data'): return jsonify({'prices':json.loads(row['data']),'updated_at':row.get('updated_at')})
        return jsonify({'prices':DEFAULT_MARKET_PRICES,'updated_at':None})
    except: return jsonify({'prices':DEFAULT_MARKET_PRICES,'updated_at':None})

@app.route('/api/admin/market-prices', methods=['POST'])
@admin_required
def admin_save_market_prices():
    data=request.get_json()
    try:
        conn=get_connection()
        conn.execute("INSERT INTO market_prices (id,data,updated_at) VALUES (1,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",(json.dumps(data),))
        sample_items=[]
        for cat in ['vegetables','grains','spices','fruits']:
            for item in data.get(cat,[])[:2]: sample_items.append(f"{item['emoji']} {item['name']} ₹{item['price']}/{item['unit']}")
            if len(sample_items)>=4: break
        notif_message=f"💹 Market prices updated by admin! Sample: {', '.join(sample_items[:3])}… Check the market prices section for full details."
        users=conn.execute("SELECT id FROM users").fetchall()
        for u in users: conn.execute("INSERT INTO notifications (user_id,message,type) VALUES (?,?,'info')",(u[0],notif_message))
        conn.commit(); conn.close()
        return jsonify({'success':True,'notified':len(users)})
    except Exception as e:
        print("Save market prices error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/landing-stats')
def landing_stats():
    try:
        conn=get_connection()
        users=dict_row(conn.execute("SELECT SUM(CASE WHEN role='farmer' THEN 1 ELSE 0 END) AS active_farmers,SUM(CASE WHEN role='customer' THEN 1 ELSE 0 END) AS total_customers,SUM(CASE WHEN role='service_provider' THEN 1 ELSE 0 END) AS total_providers FROM users").fetchone())
        orders=conn.execute("SELECT COUNT(*) AS total FROM orders").fetchone()
        services=dict_row(conn.execute("SELECT SUM(CASE WHEN service_type='storage' AND status='available' THEN 1 ELSE 0 END) AS storage_units,SUM(CASE WHEN service_type='equipment' AND status='available' THEN 1 ELSE 0 END) AS equipment_units,SUM(CASE WHEN service_type='transport' AND status='available' THEN 1 ELSE 0 END) AS transport_units FROM service_listings").fetchone())
        conn.close()
        return jsonify({'active_farmers':int(users['active_farmers'] or 0),'total_customers':int(users['total_customers'] or 0),'total_orders':int(orders[0] or 0),'storage_units':int(services['storage_units'] or 0),'equipment_units':int(services['equipment_units'] or 0),'transport_units':int(services['transport_units'] or 0)})
    except Exception as e:
        print("Landing stats error:",e); return jsonify({'active_farmers':0,'total_customers':0,'total_orders':0,'storage_units':0,'equipment_units':0,'transport_units':0})

# ADDRESSES
@app.route('/api/addresses', methods=['GET'])
def get_addresses():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    conn=get_connection(); rows=dict_rows(conn.execute("SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_default DESC,created_at DESC",(session['user_id'],)).fetchall()); conn.close(); return jsonify(rows)

@app.route('/api/addresses', methods=['POST'])
def add_address():
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        data=request.get_json()
        street=data.get('street','').strip(); village=data.get('village','').strip(); state=data.get('state','').strip()
        if not street or not village or not state: return jsonify({'error':'Street, village/city and state are required'}),400
        is_default=bool(data.get('is_default',False))
        conn=get_connection()
        if is_default: conn.execute("UPDATE user_addresses SET is_default=0 WHERE user_id=?",(session['user_id'],))
        count=conn.execute("SELECT COUNT(*) FROM user_addresses WHERE user_id=?",(session['user_id'],)).fetchone()[0]
        if count==0: is_default=True
        cur=conn.execute("INSERT INTO user_addresses (user_id,type,name,phone,street,village,district,pincode,state,is_default) VALUES (?,?,?,?,?,?,?,?,?,?)",(session['user_id'],data.get('type','home'),data.get('name','').strip(),data.get('phone','').strip() or None,street,village,data.get('district','').strip() or None,data.get('pincode','').strip() or None,state,is_default))
        new_id=cur.lastrowid; conn.commit(); conn.close(); return jsonify({'success':True,'id':new_id}),201
    except Exception as e:
        print("Add address error:",e); return jsonify({'error':str(e)}),500

@app.route('/api/addresses/<int:addr_id>/default', methods=['PUT'])
def set_default_address(addr_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        conn=get_connection()
        conn.execute("UPDATE user_addresses SET is_default=0 WHERE user_id=?",(session['user_id'],))
        conn.execute("UPDATE user_addresses SET is_default=1 WHERE id=? AND user_id=?",(addr_id,session['user_id']))
        conn.commit(); conn.close(); return jsonify({'success':True})
    except Exception as e: return jsonify({'error':str(e)}),500

@app.route('/api/addresses/<int:addr_id>', methods=['DELETE'])
def delete_address(addr_id):
    if 'user_id' not in session: return jsonify({'error':'Unauthorized'}),401
    try:
        conn=get_connection()
        row=dict_row(conn.execute("SELECT is_default FROM user_addresses WHERE id=? AND user_id=?",(addr_id,session['user_id'])).fetchone())
        was_default=row and row['is_default']
        conn.execute("DELETE FROM user_addresses WHERE id=? AND user_id=?",(addr_id,session['user_id']))
        if was_default:
            remaining=conn.execute("SELECT id FROM user_addresses WHERE user_id=? ORDER BY created_at DESC LIMIT 1",(session['user_id'],)).fetchone()
            if remaining: conn.execute("UPDATE user_addresses SET is_default=1 WHERE id=?",(remaining[0],))
        conn.commit(); conn.close(); return jsonify({'success':True})
    except Exception as e: return jsonify({'error':str(e)}),500

# CONTACT
@app.route('/api/contact', methods=['POST'])
def submit_contact():
    try:
        data=request.get_json()
        name=data.get('name','').strip(); email=data.get('email','').strip().lower(); role=data.get('role','other').strip(); message=data.get('message','').strip()
        if not all([name,email,message]): return jsonify({'error':'All fields are required'}),400
        if not validate_email(email): return jsonify({'error':'Invalid email format'}),400
        if len(message)<10: return jsonify({'error':'Message too short'}),400
        conn=get_connection(); cur=conn.execute("INSERT INTO contact_messages (name,email,role,message) VALUES (?,?,?,?)",(name,email,role,message)); contact_id=cur.lastrowid; conn.commit(); conn.close()
        send_contact_confirmation_email(app,email,name,message)
        if ADMIN_EMAIL: send_contact_admin_email(app,ADMIN_EMAIL,contact_id,name,email,role,message)
        return jsonify({'success':True,'message':'Message sent successfully!'})
    except Exception as e:
        print("Contact form error:",e); return jsonify({'error':'Failed to send message'}),500

@app.route('/api/admin/contacts')
@admin_required
def admin_get_contacts():
    conn=get_connection(); data=dict_rows(conn.execute("SELECT * FROM contact_messages ORDER BY created_at DESC").fetchall()); conn.close(); return jsonify(data)

@app.route('/api/admin/contacts/<int:cid>/read', methods=['PUT'])
@admin_required
def admin_mark_contact_read(cid):
    conn=get_connection(); conn.execute("UPDATE contact_messages SET is_read=1 WHERE id=?",(cid,)); conn.commit(); conn.close(); return jsonify({'success':True})

@app.route('/api/admin/contacts/<int:cid>', methods=['DELETE'])
@admin_required
def admin_delete_contact(cid):
    conn=get_connection(); conn.execute("DELETE FROM contact_messages WHERE id=?",(cid,)); conn.commit(); conn.close(); return jsonify({'success':True})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=10000)
