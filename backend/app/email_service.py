import os
import smtplib
import socket
import requests
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import app.config as config

def update_email_configuration(
    brevo_api_key: str = "",
    smtp_user: str = "",
    smtp_password: str = "",
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
    from_email: str = ""
):
    """
    Updates email credentials at runtime and saves them into the root .env file.
    """
    if brevo_api_key is not None and brevo_api_key.strip():
        config.BREVO_API_KEY = brevo_api_key.strip()
        os.environ["BREVO_API_KEY"] = config.BREVO_API_KEY

    if smtp_user is not None:
        config.SMTP_USER = smtp_user.strip()
        os.environ["SMTP_USER"] = config.SMTP_USER

    if smtp_password is not None:
        config.SMTP_PASSWORD = smtp_password.strip()
        os.environ["SMTP_PASSWORD"] = config.SMTP_PASSWORD
        if config.SMTP_PASSWORD.startswith("xkeysib-") and not config.BREVO_API_KEY:
            config.BREVO_API_KEY = config.SMTP_PASSWORD
            os.environ["BREVO_API_KEY"] = config.BREVO_API_KEY

    if smtp_host is not None and smtp_host.strip():
        config.SMTP_HOST = smtp_host.strip()
        os.environ["SMTP_HOST"] = config.SMTP_HOST

    if smtp_port is not None:
        try:
            config.SMTP_PORT = int(smtp_port)
            os.environ["SMTP_PORT"] = str(config.SMTP_PORT)
        except Exception:
            pass

    if from_email is not None and from_email.strip():
        config.SMTP_FROM_EMAIL = from_email.strip()
        os.environ["SMTP_FROM_EMAIL"] = config.SMTP_FROM_EMAIL
    elif config.SMTP_USER and "@" in config.SMTP_USER:
        config.SMTP_FROM_EMAIL = config.SMTP_USER
        os.environ["SMTP_FROM_EMAIL"] = config.SMTP_FROM_EMAIL

    # Persist to .env in backend directory
    try:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        existing_lines = []
        if env_path.exists():
            existing_lines = env_path.read_text(encoding="utf-8").splitlines()

        env_map = {
            "BREVO_API_KEY": config.BREVO_API_KEY,
            "SMTP_USER": config.SMTP_USER,
            "SMTP_PASSWORD": config.SMTP_PASSWORD,
            "SMTP_HOST": config.SMTP_HOST,
            "SMTP_PORT": str(config.SMTP_PORT),
            "SMTP_FROM_EMAIL": config.SMTP_FROM_EMAIL
        }

        written_keys = set()
        new_lines = []
        for line in existing_lines:
            if "=" in line and not line.strip().startswith("#"):
                key = line.split("=")[0].strip()
                if key in env_map:
                    new_lines.append(f"{key}={env_map[key]}")
                    written_keys.add(key)
                    continue
            new_lines.append(line)

        for key, val in env_map.items():
            if key not in written_keys and val:
                new_lines.append(f"{key}={val}")

        env_path.write_text("\n".join(new_lines), encoding="utf-8")
        print(f"[CONFIG] Updated runtime email configuration and persisted to {env_path}")
    except Exception as e:
        print(f"[CONFIG WARNING] Could not persist to .env: {e}")

def get_email_service_status() -> dict:
    """
    Returns diagnostic information about current email delivery configuration.
    """
    is_brevo = bool(config.BREVO_API_KEY or (config.SMTP_PASSWORD and config.SMTP_PASSWORD.startswith("xkeysib-")) or "brevo" in config.SMTP_HOST.lower())
    is_resend = bool(config.RESEND_API_KEY or (config.SMTP_PASSWORD and config.SMTP_PASSWORD.startswith("re_")))
    is_gmail = "gmail" in config.SMTP_HOST.lower()
    has_creds = bool((config.SMTP_USER and config.SMTP_PASSWORD) or config.BREVO_API_KEY or config.RESEND_API_KEY)

    masked_user = ""
    if config.SMTP_USER:
        if "@" in config.SMTP_USER:
            parts = config.SMTP_USER.split("@")
            masked_user = f"{parts[0][:2]}***@{parts[1]}"
        else:
            masked_user = f"{config.SMTP_USER[:3]}***"
    elif config.SMTP_FROM_EMAIL:
        if "@" in config.SMTP_FROM_EMAIL:
            parts = config.SMTP_FROM_EMAIL.split("@")
            masked_user = f"{parts[0][:2]}***@{parts[1]}"

    provider = "Unconfigured"
    if is_brevo:
        provider = "Brevo (HTTPS API)"
    elif is_resend:
        provider = "Resend API"
    elif is_gmail:
        provider = "Gmail SMTP"
    elif has_creds:
        provider = f"Custom SMTP ({config.SMTP_HOST})"

    return {
        "configured": has_creds,
        "provider": provider,
        "smtp_host": config.SMTP_HOST,
        "smtp_port": config.SMTP_PORT,
        "smtp_user": masked_user,
        "from_email": config.SMTP_FROM_EMAIL or config.SMTP_USER or "",
        "from_name": config.SMTP_FROM_NAME,
        "using_api": bool(config.BREVO_API_KEY or config.RESEND_API_KEY or (config.SMTP_PASSWORD and (config.SMTP_PASSWORD.startswith("xkeysib-") or config.SMTP_PASSWORD.startswith("re_"))))
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
        return False, "No email credentials configured. Click 'Configure Real Email Delivery' to link Brevo or Gmail."

    sender_email = config.SMTP_FROM_EMAIL or config.SMTP_USER
    if not sender_email or "@" not in sender_email:
        sender_email = "noreply@hiresphere.com"

    # 1. Attempt Brevo REST API (HTTPS port 443 - immune to SMTP port blocks)
    brevo_key = config.BREVO_API_KEY or (config.SMTP_PASSWORD if config.SMTP_PASSWORD.startswith("xkeysib-") else "")
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
                    "name": config.SMTP_FROM_NAME or "HireSphere",
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
                if "sender" in err_msg.lower() or "not verified" in err_msg.lower():
                    return False, f"Brevo Error: Sender email '{sender_email}' is not verified in your Brevo account. In Brevo, go to Senders & IP -> add and verify '{sender_email}'."
                return False, f"Brevo API error ({res.status_code}): {err_msg}"
        except Exception as e:
            print(f"[EMAIL SERVICE BREVO API EXCEPTION] {e}")

    # 2. Attempt Resend REST API (HTTPS port 443)
    resend_key = config.RESEND_API_KEY or (config.SMTP_PASSWORD if config.SMTP_PASSWORD.startswith("re_") else "")
    if resend_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via Resend REST API...")
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            from_resend = sender_email if "@" in sender_email and not sender_email.endswith("hiresphere.com") else "onboarding@resend.dev"
            payload = {
                "from": f"{config.SMTP_FROM_NAME} <{from_resend}>",
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
    if config.SMTP_USER and config.SMTP_PASSWORD:
        try:
            print(f"[EMAIL SERVICE] Attempting SMTP delivery via {config.SMTP_HOST}:{config.SMTP_PORT} as {config.SMTP_USER}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{sender_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if config.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=12)
            else:
                server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=12)
                server.ehlo()
                server.starttls()
                server.ehlo()

            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(sender_email, [recipient_email], msg.as_string())
            server.quit()

            print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via SMTP!")
            return True, "Email successfully dispatched to your inbox via SMTP."

        except smtplib.SMTPAuthenticationError as e:
            err_code = e.smtp_code if hasattr(e, "smtp_code") else 535
            err_msg = e.smtp_error.decode() if hasattr(e, "smtp_error") and isinstance(e.smtp_error, bytes) else str(e)
            print(f"[EMAIL SERVICE ERROR] Authentication failed ({err_code}): {err_msg}")
            if "gmail" in config.SMTP_HOST.lower():
                return False, "Gmail authentication failed. You must use a 16-character Google App Password (not your personal Gmail password)."
            if "brevo" in config.SMTP_HOST.lower():
                return False, "Brevo authentication failed. In Brevo, go to SMTP & API -> create and copy a new Master SMTP key."
            return False, f"SMTP Authentication failed: {err_msg}"

        except smtplib.SMTPSenderRefused as e:
            print(f"[EMAIL SERVICE ERROR] Sender refused: {e}")
            return False, f"Sender address '{sender_email}' was rejected by SMTP server. In Brevo, the 'From' address must be a verified sender in your account."

        except smtplib.SMTPRecipientsRefused as e:
            print(f"[EMAIL SERVICE ERROR] Recipient refused: {e}")
            return False, f"Recipient email '{recipient_email}' was rejected by SMTP server."

        except (socket.timeout, TimeoutError):
            print(f"[EMAIL SERVICE ERROR] Connection timed out to {config.SMTP_HOST}:{config.SMTP_PORT}")
            return False, f"Connection timed out connecting to {config.SMTP_HOST}:{config.SMTP_PORT}. Outbound port {config.SMTP_PORT} may be blocked by cloud provider."

        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] {type(e).__name__}: {e}")
            return False, f"SMTP error ({type(e).__name__}): {str(e)}"

    return False, "Failed to send email. Check SMTP server settings."
