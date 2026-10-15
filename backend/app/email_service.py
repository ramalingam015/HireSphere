import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import (
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
    SMTP_FROM_EMAIL, SMTP_FROM_NAME
)

def send_verification_email(recipient_email: str, code: str, user_name: str = "") -> bool:
    """
    Dispatches a 6-digit verification code to the recipient.
    If SMTP_USER and SMTP_PASSWORD are provided, sends a real HTML email.
    Always logs the code to the server console for transparency.
    Returns True if successfully sent via SMTP, False otherwise.
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

    # Always log code to terminal/logs for monitoring
    print(f"\n=======================================================")
    print(f"[EMAIL SERVICE] Recipient: {recipient_email}")
    print(f"[EMAIL SERVICE] 6-Digit Code: {code}")
    if SMTP_USER and SMTP_PASSWORD:
        print(f"[EMAIL SERVICE] Attempting SMTP delivery via {SMTP_HOST}:{SMTP_PORT} as {SMTP_USER}...")
    else:
        print(f"[EMAIL SERVICE] Real SMTP not yet configured (SMTP_USER/SMTP_PASSWORD empty).")
    print(f"=======================================================\n")

    if not SMTP_USER or not SMTP_PASSWORD:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, [recipient_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, [recipient_email], msg.as_string())

        print(f"[EMAIL SERVICE SUCCESS] Real email delivered to {recipient_email} via SMTP!")
        return True
    except Exception as e:
        print(f"[EMAIL SERVICE ERROR] Failed to send email via SMTP to {recipient_email}: {e}")
        return False
