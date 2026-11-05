import smtplib
import socket
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import (
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
    SMTP_FROM_EMAIL, SMTP_FROM_NAME, BREVO_API_KEY, RESEND_API_KEY
)

def get_email_service_status() -> dict:
    """
    Returns diagnostic information about current email delivery configuration.
    """
    is_brevo = bool(BREVO_API_KEY or (SMTP_PASSWORD and SMTP_PASSWORD.startswith("xkeysib-")) or "brevo" in SMTP_HOST.lower())
    is_resend = bool(RESEND_API_KEY or (SMTP_PASSWORD and SMTP_PASSWORD.startswith("re_")))
    is_gmail = "gmail" in SMTP_HOST.lower()
    has_creds = bool((SMTP_USER and SMTP_PASSWORD) or BREVO_API_KEY or RESEND_API_KEY)

    masked_user = ""
    if SMTP_USER:
        if "@" in SMTP_USER:
            parts = SMTP_USER.split("@")
            masked_user = f"{parts[0][:2]}***@{parts[1]}"
        else:
            masked_user = f"{SMTP_USER[:3]}***"

    provider = "Unconfigured"
    if is_brevo:
        provider = "Brevo (Sendinblue)"
    elif is_resend:
        provider = "Resend API"
    elif is_gmail:
        provider = "Gmail SMTP"
    elif has_creds:
        provider = f"Custom SMTP ({SMTP_HOST})"

    return {
        "configured": has_creds,
        "provider": provider,
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": masked_user,
        "from_email": SMTP_FROM_EMAIL,
        "from_name": SMTP_FROM_NAME,
        "using_api": bool(BREVO_API_KEY or RESEND_API_KEY or (SMTP_PASSWORD and (SMTP_PASSWORD.startswith("xkeysib-") or SMTP_PASSWORD.startswith("re_"))))
    }

def send_verification_email(recipient_email: str, code: str, user_name: str = "") -> tuple[bool, str]:
    """
    Dispatches a 6-digit verification code to the recipient.
    Supports Brevo REST API, Resend REST API, and Standard SMTP (Gmail, Brevo SMTP, etc.)
    Returns (success: bool, detail: str).
    """
    subject = f"{code} is your HireSphere Verification Code"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
        .header {{ background: #2563eb; padding: 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; }}
        .content {{ padding: 32px 24px; color: #334155; line-height: 1.6; }}
        .code-box {{ background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }}
        .code {{ font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }}
        .footer {{ padding: 18px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HireSphere Recruitment</h1>
        </div>
        <div class="content">
          <p>Hello {user_name or 'there'},</p>
          <p>Please enter the following 6-digit verification code to verify your HireSphere account:</p>
          
          <div class="code-box">
            <div class="code">{code}</div>
          </div>
          
          <p>This code will expire in <strong>24 hours</strong>. If you did not make this request, please disregard this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 HireSphere Recruitment Platform</p>
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
Hello {user_name or 'there'},

Your HireSphere 6-digit email verification code is: {code}

This code will expire in 24 hours. If you did not request this, please ignore this email.
"""

    status = get_email_service_status()
    print(f"\n=======================================================")
    print(f"[EMAIL SERVICE] Recipient: {recipient_email}")
    print(f"[EMAIL SERVICE] 6-Digit Code: {code}")
    print(f"[EMAIL SERVICE] Provider: {status['provider']} | Configured: {status['configured']}")
    print(f"=======================================================\n")

    if not status["configured"]:
        return False, "No email credentials configured. Please set SMTP_USER and SMTP_PASSWORD in Render Environment variables."

    sender_email = SMTP_FROM_EMAIL or SMTP_USER
    if not sender_email or "@" not in sender_email:
        sender_email = "noreply@hiresphere.com"

    # 1. Attempt Brevo REST API (HTTPS port 443 - immune to SMTP port blocks)
    brevo_key = BREVO_API_KEY or (SMTP_PASSWORD if SMTP_PASSWORD.startswith("xkeysib-") else "")
    if brevo_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via Brevo REST API...")
            headers = {
                "accept": "application/json",
                "api-key": brevo_key,
                "content-type": "application/json"
            }
            payload = {
                "sender": {
                    "name": SMTP_FROM_NAME or "HireSphere",
                    "email": sender_email
                },
                "to": [{"email": recipient_email, "name": user_name or recipient_email}],
                "subject": subject,
                "htmlContent": html_content,
                "textContent": text_content
            }
            res = requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers, timeout=12)
            if res.status_code in (200, 201):
                print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via Brevo API!")
                return True, "Email successfully dispatched to your inbox via Brevo API."
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message", res.text)
                print(f"[EMAIL SERVICE BREVO API ERROR] Status {res.status_code}: {err_msg}")
                # If error mentions sender verification, provide clear action
                if "sender" in err_msg.lower() or "not verified" in err_msg.lower():
                    return False, f"Brevo Error: Sender email '{sender_email}' is not verified in your Brevo account. In Brevo, go to Senders & IP -> add and verify '{sender_email}'."
                return False, f"Brevo API error ({res.status_code}): {err_msg}"
        except Exception as e:
            print(f"[EMAIL SERVICE BREVO API EXCEPTION] {e}")

    # 2. Attempt Resend REST API (HTTPS port 443)
    resend_key = RESEND_API_KEY or (SMTP_PASSWORD if SMTP_PASSWORD.startswith("re_") else "")
    if resend_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via Resend REST API...")
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            # For testing without a custom domain, Resend requires onboarding@resend.dev
            from_resend = sender_email if "@" in sender_email and not sender_email.endswith("hiresphere.com") else "onboarding@resend.dev"
            payload = {
                "from": f"{SMTP_FROM_NAME} <{from_resend}>",
                "to": [recipient_email],
                "subject": subject,
                "html": html_content,
                "text": text_content
            }
            res = requests.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=12)
            if res.status_code in (200, 201):
                print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via Resend API!")
                return True, "Email successfully dispatched to your inbox via Resend API."
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message", res.text)
                print(f"[EMAIL SERVICE RESEND API ERROR] Status {res.status_code}: {err_msg}")
                return False, f"Resend API error: {err_msg}"
        except Exception as e:
            print(f"[EMAIL SERVICE RESEND API EXCEPTION] {e}")

    # 3. Standard SMTP Delivery (Port 587 STARTTLS or Port 465 SSL)
    if SMTP_USER and SMTP_PASSWORD:
        try:
            print(f"[EMAIL SERVICE] Attempting SMTP delivery via {SMTP_HOST}:{SMTP_PORT} as {SMTP_USER}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{SMTP_FROM_NAME} <{sender_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=12)
            else:
                server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12)
                server.ehlo()
                server.starttls()
                server.ehlo()

            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(sender_email, [recipient_email], msg.as_string())
            server.quit()

            print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via SMTP!")
            return True, "Email successfully dispatched to your inbox via SMTP."

        except smtplib.SMTPAuthenticationError as e:
            err_code = e.smtp_code if hasattr(e, "smtp_code") else 535
            err_msg = e.smtp_error.decode() if hasattr(e, "smtp_error") and isinstance(e.smtp_error, bytes) else str(e)
            print(f"[EMAIL SERVICE ERROR] Authentication failed ({err_code}): {err_msg}")
            if "gmail" in SMTP_HOST.lower():
                return False, "Gmail authentication failed. You must use a 16-character Google App Password (not your personal Gmail password)."
            if "brevo" in SMTP_HOST.lower():
                return False, "Brevo authentication failed. In Brevo, go to SMTP & API -> create and copy a new Master SMTP key."
            return False, f"SMTP Authentication failed: {err_msg}"

        except smtplib.SMTPSenderRefused as e:
            print(f"[EMAIL SERVICE ERROR] Sender refused: {e}")
            return False, f"Sender address '{sender_email}' was rejected by SMTP server. In Brevo, the 'From' address must be a verified sender in your account."

        except smtplib.SMTPRecipientsRefused as e:
            print(f"[EMAIL SERVICE ERROR] Recipient refused: {e}")
            return False, f"Recipient email '{recipient_email}' was rejected by SMTP server."

        except (socket.timeout, TimeoutError):
            print(f"[EMAIL SERVICE ERROR] Connection timed out to {SMTP_HOST}:{SMTP_PORT}")
            return False, f"Connection timed out connecting to {SMTP_HOST}:{SMTP_PORT}. Outbound port {SMTP_PORT} may be blocked by cloud provider."

        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] {type(e).__name__}: {e}")
            return False, f"SMTP error ({type(e).__name__}): {str(e)}"

    return False, "Failed to send email. Check SMTP server settings."
