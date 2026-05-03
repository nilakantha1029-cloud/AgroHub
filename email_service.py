# ══════════════════════════════════════════════════════════════════
#  AgroHub — Email Service  (email_service.py)
#  All Flask-Mail logic lives here. Import send_* helpers into app.py
# ══════════════════════════════════════════════════════════════════
import os
import threading
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime
import socket
socket.setdefaulttimeout(10)

mail = Mail()

# ──────────────────────────────────────────
#  Shared helper: send one e-mail
# ──────────────────────────────────────────
def _send(app, subject, recipients, html_body, text_body=""):
    def _do_send():
        try:
            with app.app_context():
                msg = Message(
                    subject=subject,
                    sender=(
                        os.getenv("MAIL_DEFAULT_SENDER_NAME", "AgroHub"),
                        os.getenv("MAIL_DEFAULT_SENDER", os.getenv("MAIL_USERNAME", ""))
                    ),
                    recipients=recipients,
                    html=html_body,
                    body=text_body or "Please view this email in an HTML-capable client."
                )
                mail.send(msg)
            print(f"[EMAIL OK] {subject} → {recipients}")
        except Exception as e:
            print(f"[EMAIL ERROR] {subject} → {recipients}: {type(e).__name__}: {e}")

    thread = threading.Thread(target=_do_send, daemon=True)
    thread.start()
    return True


# ──────────────────────────────────────────
#  Password-reset token helpers
# ──────────────────────────────────────────
def generate_reset_token(app, email):
    s = URLSafeTimedSerializer(app.secret_key)
    return s.dumps(email, salt="pw-reset-salt")


def verify_reset_token(app, token, max_age=3600):
    """Returns email string on success, None on failure/expiry."""
    s = URLSafeTimedSerializer(app.secret_key)
    try:
        email = s.loads(token, salt="pw-reset-salt", max_age=max_age)
        return email
    except Exception:
        return None


# ══════════════════════════════════════════
#  Shared e-mail wrapper / brand header
# ══════════════════════════════════════════
_BRAND_COLOR = "#2e7d32"   # AgroHub green

def _wrap(title, content_html):
    """Wraps content in a consistent branded e-mail layout."""
    year = datetime.now().year
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{{margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;}}
    .wrap{{max-width:600px;margin:30px auto;background:#fff;border-radius:10px;
           overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}}
    .hdr{{background:{_BRAND_COLOR};padding:24px 32px;text-align:center;}}
    .hdr h1{{margin:0;color:#fff;font-size:26px;letter-spacing:1px;}}
    .hdr p{{margin:4px 0 0;color:#c8e6c9;font-size:13px;}}
    .body{{padding:32px;color:#333;line-height:1.7;}}
    .btn{{display:inline-block;margin:20px 0;padding:13px 32px;
          background:{_BRAND_COLOR};color:#fff!important;border-radius:6px;
          text-decoration:none;font-weight:bold;font-size:15px;}}
    .info-box{{background:#f1f8f1;border-left:4px solid {_BRAND_COLOR};
               border-radius:4px;padding:14px 18px;margin:16px 0;}}
    .ftr{{background:#f9fafb;padding:16px 32px;text-align:center;
          font-size:12px;color:#888;border-top:1px solid #eee;}}
    table.order{{width:100%;border-collapse:collapse;margin:16px 0;}}
    table.order th{{background:#e8f5e9;padding:10px;text-align:left;font-size:13px;}}
    table.order td{{padding:10px;border-bottom:1px solid #f0f0f0;font-size:13px;}}
    .badge{{display:inline-block;padding:3px 10px;border-radius:12px;
            font-size:12px;font-weight:bold;}}
    .badge-success{{background:#e8f5e9;color:#2e7d32;}}
    .badge-error{{background:#ffebee;color:#c62828;}}
    .badge-info{{background:#e3f2fd;color:#1565c0;}}
    .badge-warn{{background:#fff8e1;color:#f57f17;}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>🌾 AgroHub</h1>
      <p>Connecting Farmers &amp; Customers</p>
    </div>
    <div class="body">
      <h2 style="margin-top:0;color:{_BRAND_COLOR};">{title}</h2>
      {content_html}
    </div>
    <div class="ftr">
      &copy; {year} AgroHub. All rights reserved.<br>
      This is an automated notification — please do not reply directly.
    </div>
  </div>
</body>
</html>
"""


# ══════════════════════════════════════════════════════════════════
#  1. FORGOT PASSWORD / RESET PASSWORD
# ══════════════════════════════════════════════════════════════════
def send_forgot_password_email(app, to_email, user_name, reset_token):
    base_url = os.getenv("APP_BASE_URL", "http://localhost:5000")
    link = f"{base_url}/reset-password?token={reset_token}"
    html = _wrap("Password Reset Request", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>We received a request to reset your AgroHub account password.</p>
        <div class="info-box">
            🔒 This link is valid for <strong>1 hour</strong> and can only be used once.
        </div>
        <p style="text-align:center;">
            <a class="btn" href="{link}">Reset My Password</a>
        </p>
        <p>If you didn't request a password reset, just ignore this email — your account is safe.</p>
        <p>Or copy this link into your browser:<br>
           <small style="color:#555;">{link}</small></p>
    """)
    return _send(app, "🔐 Reset Your AgroHub Password", [to_email], html)


def send_password_changed_email(app, to_email, user_name):
    html = _wrap("Password Changed Successfully", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your AgroHub account password has been <strong>successfully changed</strong>.</p>
        <div class="info-box">
            If you did not make this change, please contact our support team immediately.
        </div>
        <p>Stay safe and keep farming! 🌿</p>
    """)
    return _send(app, "✅ AgroHub Password Changed", [to_email], html)


def send_otp_email(app, to_email, user_name, otp):
    html = _wrap("Your Password-Change OTP 🔑", f'''
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>You requested a password change on AgroHub.
           Use the OTP below to complete the process.</p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#f1f8f1;border:2px dashed #2e7d32;
                      border-radius:12px;padding:18px 40px;">
            <div style="font-size:11px;letter-spacing:2px;color:#666;
                        text-transform:uppercase;margin-bottom:6px;">One-Time Password</div>
            <div style="font-size:42px;font-weight:900;letter-spacing:10px;
                        color:#2e7d32;font-family:monospace;">{otp}</div>
          </div>
        </div>
        <div class="info-box">
          ⏱️ This OTP is valid for <strong>10 minutes</strong> only.<br>
          🔒 Never share this code with anyone.
        </div>
        <p>If you did not request a password change, please ignore this email
           and your account will remain unchanged.</p>
    ''')
    return _send(app, "🔑 AgroHub — Password Change OTP", [to_email], html)



# ══════════════════════════════════════════════════════════════════
#  2. SIGNUP WELCOME
# ══════════════════════════════════════════════════════════════════
def send_welcome_email(app, to_email, user_name, role):
    role_desc = {
        "farmer": "sell your produce and manage your listings",
        "customer": "discover fresh produce directly from farmers",
        "service_provider": "offer your services to the farming community",
    }.get(role, "use all AgroHub features")
    html = _wrap(f"Welcome to AgroHub, {user_name}! 🎉", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your account has been created successfully! You can now <strong>{role_desc}</strong>.</p>
        <div class="info-box">
            👤 <strong>Account type:</strong> {role.replace("_"," ").title()}<br>
            📧 <strong>Email:</strong> {to_email}
        </div>
        <p>Head to your dashboard to get started.</p>
    """)
    return _send(app, "🌾 Welcome to AgroHub!", [to_email], html)


# ══════════════════════════════════════════════════════════════════
#  3. ORDER NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════
def send_order_placed_email(app, farmer_email, farmer_name,
                             customer_name, order_id, produce, quantity, total):
    html = _wrap(f"New Order #{order_id} Received 🛒", f"""
        <p>Hi <strong>{farmer_name}</strong>,</p>
        <p>You have received a new order on AgroHub!</p>
        <table class="order">
          <tr><th>Order #</th><td>#{order_id}</td></tr>
          <tr><th>Produce</th><td>{produce}</td></tr>
          <tr><th>Quantity</th><td>{quantity} kg</td></tr>
          <tr><th>Total Amount</th><td>₹{total:,.0f}</td></tr>
          <tr><th>Customer</th><td>{customer_name}</td></tr>
        </table>
        <p>Please log in to your dashboard to <strong>accept or reject</strong> this order.</p>
    """)
    return _send(app, f"🛒 New Order #{order_id} on AgroHub", [farmer_email], html)


def send_order_status_email(app, customer_email, customer_name,
                             order_id, produce, new_status, extra_note=""):
    status_info = {
        "accepted":       ("✅ Order Accepted",        "success", "Great news! Your order has been accepted by the farmer."),
        "rejected":       ("❌ Order Rejected",         "error",   "Unfortunately, the farmer could not fulfil your order at this time."),
        "ready_to_ship":  ("📦 Ready to Ship",          "info",    "Your order is packed and ready to be shipped!"),
        "shipped":        ("🚚 Order Shipped",           "info",    "Your order is on its way to you!"),
        "delivered":      ("🎉 Order Delivered",         "success", "Your order has been delivered successfully!"),
    }
    label, badge_cls, desc = status_info.get(
        new_status, ("📋 Order Updated", "info", f"Your order status changed to {new_status}.")
    )
    html = _wrap(f"Order #{order_id} — {label}", f"""
        <p>Hi <strong>{customer_name}</strong>,</p>
        <p>{desc}</p>
        <table class="order">
          <tr><th>Order #</th><td>#{order_id}</td></tr>
          <tr><th>Produce</th><td>{produce}</td></tr>
          <tr><th>Status</th><td><span class="badge badge-{badge_cls}">{new_status.replace("_"," ").title()}</span></td></tr>
        </table>
        {f'<div class="info-box">{extra_note}</div>' if extra_note else ""}
    """)
    return _send(app, f"AgroHub — {label} (Order #{order_id})", [customer_email], html)


# ══════════════════════════════════════════════════════════════════
#  4. SERVICE BOOKING NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════
def send_service_booking_request_email(app, provider_email, provider_name,
                                        booking_id, service_name, requester_name,
                                        booking_date, amount):
    html = _wrap(f"New Booking Request #{booking_id} 📋", f"""
        <p>Hi <strong>{provider_name}</strong>,</p>
        <p>You have a new service booking request on AgroHub.</p>
        <table class="order">
          <tr><th>Booking #</th><td>#{booking_id}</td></tr>
          <tr><th>Service</th><td>{service_name}</td></tr>
          <tr><th>Requested by</th><td>{requester_name}</td></tr>
          <tr><th>Date</th><td>{booking_date or 'Flexible'}</td></tr>
          <tr><th>Amount</th><td>₹{amount:,.0f}</td></tr>
        </table>
        <p>Log in to your dashboard to <strong>accept or reject</strong> this booking.</p>
    """)
    return _send(app, f"📋 New Booking #{booking_id} — AgroHub", [provider_email], html)


def send_service_booking_status_email(app, customer_email, customer_name,
                                       booking_id, service_name, new_status):
    status_info = {
        "accepted":  ("✅ Booking Accepted",  "success", "Your service booking has been accepted!"),
        "rejected":  ("❌ Booking Rejected",   "error",   "Unfortunately, your booking request was not accepted."),
        "active":    ("🚀 Service Active",     "info",    "Your service booking is now active and in progress."),
        "completed": ("🎉 Service Completed",  "success", "Your service has been completed successfully!"),
    }
    label, badge_cls, desc = status_info.get(
        new_status, ("📋 Booking Updated", "info", f"Booking status changed to {new_status}.")
    )
    html = _wrap(f"Booking #{booking_id} — {label}", f"""
        <p>Hi <strong>{customer_name}</strong>,</p>
        <p>{desc}</p>
        <table class="order">
          <tr><th>Booking #</th><td>#{booking_id}</td></tr>
          <tr><th>Service</th><td>{service_name}</td></tr>
          <tr><th>Status</th><td><span class="badge badge-{badge_cls}">{new_status.replace("_"," ").title()}</span></td></tr>
        </table>
    """)
    return _send(app, f"AgroHub — {label} (Booking #{booking_id})", [customer_email], html)


# ══════════════════════════════════════════════════════════════════
#  5. SUPPORT TICKET NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════
def send_ticket_created_email(app, to_email, user_name, ticket_id, subject, message):
    html = _wrap(f"Support Ticket #{ticket_id} Created 🎫", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your support ticket has been submitted. Our team will review it soon.</p>
        <table class="order">
          <tr><th>Ticket #</th><td>#{ticket_id}</td></tr>
          <tr><th>Subject</th><td>{subject}</td></tr>
          <tr><th>Status</th><td><span class="badge badge-info">Open</span></td></tr>
        </table>
        <div class="info-box"><strong>Your message:</strong><br>{message[:300]}{'...' if len(message) > 300 else ''}</div>
    """)
    return _send(app, f"🎫 Ticket #{ticket_id} Received — AgroHub Support", [to_email], html)


def send_ticket_reply_email(app, to_email, user_name, ticket_id, subject, status, reply):
    status_map = {
        "open": ("info", "Open"),
        "in_progress": ("warn", "In Progress"),
        "resolved": ("success", "Resolved ✅"),
        "closed": ("info", "Closed"),
    }
    badge_cls, label = status_map.get(status, ("info", status.title()))
    html = _wrap(f"Update on Ticket #{ticket_id}", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>There's an update on your support ticket.</p>
        <table class="order">
          <tr><th>Ticket #</th><td>#{ticket_id}</td></tr>
          <tr><th>Subject</th><td>{subject}</td></tr>
          <tr><th>Status</th><td><span class="badge badge-{badge_cls}">{label}</span></td></tr>
        </table>
        {f'<div class="info-box"><strong>Admin Reply:</strong><br>{reply}</div>' if reply else ""}
    """)
    return _send(app, f"🎫 Ticket #{ticket_id} Updated — AgroHub", [to_email], html)


def send_ticket_new_admin_email(app, admin_email, ticket_id, user_name, subject, message):
    """Notify admin when a new support ticket is created."""
    html = _wrap(f"New Support Ticket #{ticket_id} (Admin Alert)", f"""
        <p>A new support ticket has been submitted on AgroHub.</p>
        <table class="order">
          <tr><th>Ticket #</th><td>#{ticket_id}</td></tr>
          <tr><th>From</th><td>{user_name}</td></tr>
          <tr><th>Subject</th><td>{subject}</td></tr>
        </table>
        <div class="info-box">{message[:400]}{'...' if len(message) > 400 else ''}</div>
        <p>Log in to the admin panel to review and reply.</p>
    """)
    return _send(app, f"[Admin] New Ticket #{ticket_id}: {subject}", [admin_email], html)


# ══════════════════════════════════════════════════════════════════
#  6. CONTACT FORM (Get in Touch)
# ══════════════════════════════════════════════════════════════════
def send_contact_confirmation_email(app, to_email, name, message):
    html = _wrap("We Received Your Message! 📬", f"""
        <p>Hi <strong>{name}</strong>,</p>
        <p>Thank you for reaching out to AgroHub. We've received your message and will get back to you soon.</p>
        <div class="info-box"><strong>Your message:</strong><br>{message[:400]}{'...' if len(message) > 400 else ''}</div>
        <p>We aim to respond within <strong>1-2 business days</strong>.</p>
    """)
    return _send(app, "📬 We received your message — AgroHub", [to_email], html)


def send_contact_admin_email(app, admin_email, contact_id, name, email, role, message):
    """Notify admin of a new contact form submission."""
    html = _wrap(f"New Contact Form Submission #{contact_id}", f"""
        <p>A visitor submitted the "Get in Touch" form on AgroHub.</p>
        <table class="order">
          <tr><th>Name</th><td>{name}</td></tr>
          <tr><th>Email</th><td>{email}</td></tr>
          <tr><th>Role</th><td>{role}</td></tr>
        </table>
        <div class="info-box"><strong>Message:</strong><br>{message}</div>
        <p>Log in to the admin panel to mark it as read or reply.</p>
    """)
    return _send(app, f"[Admin] New Contact #{contact_id} from {name}", [admin_email], html)


# ══════════════════════════════════════════════════════════════════
#  7. PROFILE UPDATE
# ══════════════════════════════════════════════════════════════════
def send_profile_updated_email(app, to_email, user_name):
    html = _wrap("Profile Updated ✏️", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your AgroHub profile has been <strong>successfully updated</strong>.</p>
        <div class="info-box">
            If you did not make this change, please contact our support team immediately.
        </div>
    """)
    return _send(app, "✏️ AgroHub Profile Updated", [to_email], html)


# ══════════════════════════════════════════════════════════════════
#  8. ADMIN — USER MANAGEMENT
# ══════════════════════════════════════════════════════════════════
def send_admin_user_updated_email(app, to_email, user_name):
    html = _wrap("Your Account Was Updated (Admin)", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>An admin has updated your AgroHub account details.</p>
        <div class="info-box">
            If you believe this was done in error, please contact our support team.
        </div>
    """)
    return _send(app, "⚙️ AgroHub Account Updated by Admin", [to_email], html)


def send_admin_user_deleted_email(app, to_email, user_name):
    html = _wrap("Account Removed", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your AgroHub account has been removed by an administrator.</p>
        <p>If you believe this was done in error, please reply to this email or contact us.</p>
    """)
    return _send(app, "⚠️ AgroHub Account Removed", [to_email], html)


def send_admin_broadcast_email(app, to_emails, message, notif_type="info"):
    icons = {"info": "ℹ️", "success": "✅", "warn": "⚠️", "error": "❌"}
    icon = icons.get(notif_type, "📢")
    html = _wrap(f"{icon} Message from AgroHub Admin", f"""
        <p>You have received an important message from the AgroHub administration team:</p>
        <div class="info-box" style="font-size:15px;">{icon} {message}</div>
    """)
    # Send in batches to avoid spam filters
    success = True
    for email in to_emails:
        ok = _send(app, f"{icon} Important Message from AgroHub", [email], html)
        if not ok:
            success = False
    return success


# ══════════════════════════════════════════════════════════════════
#  9. ADMIN — LISTING ACTIONS
# ══════════════════════════════════════════════════════════════════
def send_listing_deleted_by_admin_email(app, to_email, user_name, produce):
    html = _wrap("Listing Removed by Admin", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your listing for <strong>{produce}</strong> has been removed by an AgroHub administrator.</p>
        <div class="info-box">
            If you believe this was done in error, please open a support ticket from your dashboard.
        </div>
    """)
    return _send(app, "🗑️ AgroHub Listing Removed", [to_email], html)



# ══════════════════════════════════════════════════════════════════
#  10. SIGNUP OTP VERIFICATION
# ══════════════════════════════════════════════════════════════════
def send_otp_email(app, to_email, user_name, otp):
    """Send a 6-digit OTP to verify email during signup."""
    html = _wrap("Verify Your Email — OTP 🔐", f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Thank you for signing up on AgroHub! Use the OTP below to verify your email address.</p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#e8f5e9;border:2px dashed {_BRAND_COLOR};
                      border-radius:12px;padding:18px 40px;">
            <span style="font-size:38px;font-weight:bold;letter-spacing:10px;
                         color:{_BRAND_COLOR};font-family:monospace;">{otp}</span>
          </div>
        </div>
        <div class="info-box">
            ⏱️ This OTP is valid for <strong>5 minutes</strong> only.<br>
            Do not share this OTP with anyone.
        </div>
        <p>If you did not request this, please ignore this email.</p>
    """)
    return _send(app, "🔐 Your AgroHub Signup OTP", [to_email], html)


# ══════════════════════════════════════════════════════════════════
#  INIT HELPER — call from app.py
# ══════════════════════════════════════════════════════════════════
def init_mail(app):
    """Configure and initialise Flask-Mail from environment variables."""
    app.config["MAIL_SERVER"]         = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"]           = int(os.getenv("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"]        = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    app.config["MAIL_USE_SSL"]        = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
    app.config["MAIL_USERNAME"]       = os.getenv("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"]       = os.getenv("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv(
        "MAIL_DEFAULT_SENDER",
        os.getenv("MAIL_USERNAME", "")
    )
    app.config["MAIL_MAX_EMAILS"]     = None
    app.config["MAIL_SUPPRESS_SEND"]  = os.getenv("MAIL_SUPPRESS_SEND", "false").lower() == "true"
    mail.init_app(app)
    return mail