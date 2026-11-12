import os
import smtplib
import socket
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import app.config as config

TIMEOUT_HTTP = 3.5
TIMEOUT_SMTP = 3.5

def get_email_service_status() -> dict:
    """
    Returns diagnostic information about current email delivery configuration.
    """
    is_brevo = bool(config.BREVO_API_KEY or (config.SMTP_PASSWORD and config.SMTP_PASSWORD.startswith("xkeysib-")) or "brevo" in config.SMTP_HOST.lower())
    is_resend = bool(config.RESEND_API_KEY or (config.SMTP_PASSWORD and config.SMTP_PASSWORD.startswith("re_")))
    is_sendgrid = bool(config.SENDGRID_API_KEY or (config.SMTP_PASSWORD and config.SMTP_PASSWORD.startswith("SG.")))
    is_gmail = "gmail" in config.SMTP_HOST.lower()
    has_creds = bool((config.SMTP_USER and config.SMTP_PASSWORD) or config.BREVO_API_KEY or config.RESEND_API_KEY or config.SENDGRID_API_KEY)

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
    if is_sendgrid:
        provider = "SendGrid API (HTTPS Port 443 - Verified Sender)"
    elif is_brevo:
        provider = "Brevo API (HTTPS Port 443 - Verified Sender)"
    elif is_resend:
        provider = "Resend API (HTTPS Port 443)"
    elif is_gmail:
        provider = "Gmail SMTP (SSL, port 465)"
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
    Supports:
    1. Gmail Direct SSL (Port 465) - fast, reliable, Nodemailer equivalent
    2. Resend REST API (HTTPS Port 443)
    3. Brevo REST API (HTTPS Port 443)
    4. Custom SMTP
    Fast timeouts (3.5s) ensure requests never hang or slow down the application.
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
    print(f"[EMAIL SERVICE] Recipient: {recipient_email} | Provider: {status['provider']} | Configured: {status['configured']}")
    if config.APP_ENV != "production":
        # Dev convenience only: lets you verify an account without a mail provider. Never logged in production.
        print(f"[EMAIL SERVICE] (dev) 6-digit code for {recipient_email}: {code}")

    if not status["configured"]:
        hint = " In development the code is printed in the API server log." if config.APP_ENV != "production" else ""
        return False, "Email delivery is not configured on the server (set SMTP_*, BREVO_API_KEY, RESEND_API_KEY or SENDGRID_API_KEY in backend/.env)." + hint

    sender_email = config.SMTP_FROM_EMAIL or config.SMTP_USER
    if not sender_email or "@" not in sender_email:
        sender_email = "noreply@hiresphere.com"

    # 1. Attempt Resend REST API First (HTTPS port 443 - zero block on Render, 100% reliable, ~0.3s delivery)
    resend_key = config.RESEND_API_KEY or (config.SMTP_PASSWORD if config.SMTP_PASSWORD.startswith("re_") else "")
    if resend_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via Resend REST API (HTTPS Port 443)...")
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            # Resend requires 'onboarding@resend.dev' unless a custom domain with DNS is verified.
            # Free accounts CANNOT send from personal mailboxes like @gmail.com or unverified domains.
            from_resend = "onboarding@resend.dev"
            if config.SMTP_FROM_EMAIL and "@" in config.SMTP_FROM_EMAIL:
                dom = config.SMTP_FROM_EMAIL.split("@")[1].lower()
                if not any(pub in dom for pub in ["gmail.", "yahoo.", "hotmail.", "outlook.", "hiresphere.", "icloud."]):
                    from_resend = config.SMTP_FROM_EMAIL

            payload = {
                "from": f"{config.SMTP_FROM_NAME} <{from_resend}>",
                "to": [recipient_email],
                "subject": subject,
                "html": html_content,
                "text": text_content
            }
            res = requests.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=TIMEOUT_HTTP)
            if res.status_code in (200, 201):
                print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via Resend API!")
                return True, "Email successfully dispatched to your inbox via Resend API."
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message", res.text)
                print(f"[EMAIL SERVICE RESEND API ERROR] Status {res.status_code}: {err_msg}")
                if "testing emails" in err_msg.lower() or "verify a domain" in err_msg.lower():
                    return False, (
                        "Resend Sandbox Restriction: Resend's free default domain (onboarding@resend.dev) only allows sending to your own account email. "
                        "To send OTPs to ANY recipient in the world, verify your domain at resend.com/domains, OR use Brevo / SendGrid which let you send to any recipient for free."
                    )
                return False, f"Resend API error: {err_msg}"
        except Exception as e:
            print(f"[EMAIL SERVICE RESEND API EXCEPTION] {e}")

    # 2. Attempt SendGrid REST API (HTTPS port 443 - sends to ANY recipient worldwide)
    sendgrid_key = config.SENDGRID_API_KEY or (config.SMTP_PASSWORD if config.SMTP_PASSWORD.startswith("SG.") else "")
    if sendgrid_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via SendGrid REST API (HTTPS Port 443)...")
            sg_headers = {
                "Authorization": f"Bearer {sendgrid_key}",
                "Content-Type": "application/json"
            }
            sg_sender = sender_email
            sg_payload = {
                "personalizations": [{"to": [{"email": recipient_email}]}],
                "from": {"email": sg_sender, "name": config.SMTP_FROM_NAME or "HireSphere"},
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": text_content},
                    {"type": "text/html", "value": html_content}
                ]
            }
            res = requests.post("https://api.sendgrid.com/v3/mail/send", json=sg_payload, headers=sg_headers, timeout=TIMEOUT_HTTP)
            if res.status_code in (200, 202):
                print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via SendGrid API!")
                return True, "Email successfully dispatched to your inbox via SendGrid API."
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_list = err_data.get("errors", [])
                err_msg = err_list[0].get("message", res.text) if err_list else res.text
                print(f"[EMAIL SERVICE SENDGRID API ERROR] Status {res.status_code}: {err_msg}")
                return False, f"SendGrid error: {err_msg}"
        except Exception as e:
            print(f"[EMAIL SERVICE SENDGRID API EXCEPTION] {e}")
            return False, f"SendGrid exception: {str(e)}"

    # 3. Attempt Brevo REST API (HTTPS port 443 - sends to ANY recipient worldwide)
    brevo_key = (config.BREVO_API_KEY or (config.SMTP_PASSWORD if config.SMTP_PASSWORD.startswith("xkeysib-") else "")).strip().strip('"').strip("'")
    if brevo_key:
        try:
            print(f"[EMAIL SERVICE] Attempting delivery via Brevo REST API...")
            headers = {
                "accept": "application/json",
                "api-key": brevo_key,
                "content-type": "application/json"
            }
            # Brevo requires the sender to be an email address registered in the Brevo account
            brevo_sender = sender_email
            payload = {
                "sender": {
                    "name": config.SMTP_FROM_NAME or "HireSphere",
                    "email": brevo_sender
                },
                "to": [{"email": recipient_email, "name": user_name or recipient_email}],
                "subject": subject,
                "htmlContent": html_content,
                "textContent": text_content
            }
            res = requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers, timeout=TIMEOUT_HTTP)
            if res.status_code in (200, 201):
                print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via Brevo API!")
                return True, "Email successfully dispatched to your inbox via Brevo API."
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message", res.text)
                print(f"[EMAIL SERVICE BREVO API ERROR] Status {res.status_code}: {err_msg}")
                if "key not found" in err_msg.lower() or res.status_code == 401:
                    return False, (
                        "Brevo 401 (Key not found): The API key you entered was not recognized by Brevo. "
                        "Make sure you generate the key from the 'API Keys' tab (NOT the SMTP tab) at https://app.brevo.com/settings/keys/api. "
                        "Click 'Generate a new API key' and copy the full key starting with 'xkeysib-'."
                    )
                if "not verified" in err_msg.lower() or "sender" in err_msg.lower():
                    return False, f"Brevo Error: Sender email '{brevo_sender}' is not verified in Brevo. Set SMTP_FROM_EMAIL in backend/.env to your exact Brevo signup email."
                if "suspended" in err_msg.lower() or "not validated" in err_msg.lower() or "unauthorized" in err_msg.lower():
                    return False, f"Brevo Error: Your Brevo account requires profile validation before sending transactional emails."
                return False, f"Brevo API error ({res.status_code}): {err_msg}"
        except (requests.exceptions.Timeout, socket.timeout):
            return False, "Brevo API timed out. Network connection to Brevo is slow."
        except Exception as e:
            print(f"[EMAIL SERVICE BREVO API EXCEPTION] {e}")
            return False, f"Brevo API exception: {str(e)}"

    # 4. Attempt Gmail / SMTP Delivery if Gmail credentials are provided
    is_gmail = "gmail" in config.SMTP_HOST.lower() or (config.SMTP_USER and "gmail.com" in config.SMTP_USER.lower())
    if is_gmail and config.SMTP_USER and config.SMTP_PASSWORD:
        try:
            print(f"[EMAIL SERVICE] Attempting direct SSL delivery via smtp.gmail.com:465 as {config.SMTP_USER}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_USER}>"
            msg["To"] = recipient_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Direct SSL on Port 465
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=TIMEOUT_SMTP)
            clean_pass = config.SMTP_PASSWORD.replace(" ", "")
            server.login(config.SMTP_USER, clean_pass)
            server.sendmail(config.SMTP_USER, [recipient_email], msg.as_string())
            server.quit()

            print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via Gmail SSL!")
            return True, "Email successfully dispatched to your inbox via Gmail SSL."
        except smtplib.SMTPAuthenticationError:
            print(f"[EMAIL SERVICE ERROR] Gmail Authentication Failed.")
            return False, "Gmail authentication failed (535 Bad Credentials). You must use a 16-character Google App Password (not your normal Gmail password). In Google Account -> Security -> App passwords."
        except (socket.timeout, TimeoutError):
            print(f"[EMAIL SERVICE ERROR] Gmail SSL Connection timed out.")
            return False, "Gmail connection timed out. Port 465 may be blocked by your hosting firewall."
        except OSError as e:
            if getattr(e, "errno", None) == 101 or "network is unreachable" in str(e).lower():
                print(f"[EMAIL SERVICE ERROR] Render blocks outbound SMTP ports: {e}")
                return False, "Outbound SMTP appears to be blocked by the hosting network ([Errno 101] Network is unreachable). Use an HTTPS provider instead (RESEND_API_KEY, BREVO_API_KEY or SENDGRID_API_KEY in backend/.env)."
            return False, f"Gmail SMTP network error: {str(e)}"
        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] Gmail SMTP error: {e}")
            return False, f"Gmail SMTP error: {str(e)}"

    # 4. Standard Custom SMTP
    if config.SMTP_USER and config.SMTP_PASSWORD and not is_gmail:
        try:
            print(f"[EMAIL SERVICE] Attempting SMTP delivery via {config.SMTP_HOST}:{config.SMTP_PORT}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{sender_email}>"
            msg["To"] = recipient_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if config.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=TIMEOUT_SMTP)
            else:
                server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=TIMEOUT_SMTP)
                server.ehlo()
                server.starttls()
                server.ehlo()

            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(sender_email, [recipient_email], msg.as_string())
            server.quit()

            print(f"[EMAIL SERVICE SUCCESS] Real email delivered via Custom SMTP!")
            return True, "Email successfully dispatched via SMTP."
        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] Custom SMTP failed: {e}")
            return False, f"Custom SMTP error: {str(e)}"

    return False, "Failed to send email. Check credentials or use Gmail App Password."


def user_facing_detail(sent: bool, detail: str) -> str:
    """What an (unauthenticated) end user may see. Full provider/config detail is dev-only or admin-only."""
    if sent or config.APP_ENV != "production":
        return detail
    print(f"[EMAIL SERVICE] delivery failed (detail hidden from client): {detail}")
    return "We couldn't send the verification email right now. Please try again in a few minutes."
