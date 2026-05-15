import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import random
import string


def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


def send_otp_email(recipient_email, otp_code):
    """Send OTP email to user"""
    try:
        smtp_email = os.getenv('SMTP_EMAIL')
        smtp_password = os.getenv('SMTP_PASSWORD')
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', 587))

        if not smtp_email or not smtp_password:
            raise ValueError("SMTP credentials not configured")

        msg = MIMEMultipart('alternative')
        msg['From'] = smtp_email
        msg['To'] = recipient_email
        msg['Subject'] = 'Nulstil adgangskode - OTP-kode'

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .otp-box {{ background-color: #f4f4f4; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; }}
                .otp-code {{ font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 8px; text-align: center; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Nulstil din adgangskode</h2>
                <p>Hej,</p>
                <p>Du har anmodet om at nulstille din adgangskode. Brug følgende OTP-kode til at verificere din identitet:</p>
                
                <div class="otp-box">
                    <div class="otp-code">{otp_code}</div>
                </div>
                
                <p><strong>Denne kode udløber om 10 minutter.</strong></p>
                <p>Hvis du ikke har anmodet om denne ændring, kan du ignorere denne e-mail.</p>
                
                <div class="footer">
                    <p>Med venlig hilsen,<br>Dit team</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Nulstil din adgangskode
        
        Hej,
        
        Du har anmodet om at nulstille din adgangskode. Brug følgende OTP-kode:
        
        {otp_code}
        
        Denne kode udløber om 10 minutter.
        
        Hvis du ikke har anmodet om denne ændring, kan du ignorere denne e-mail.
        
        Med venlig hilsen,
        Dit team
        """

        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)

        return True, "OTP sent successfully"

    except Exception as e:
        print(f"Email sending error: {e}")
        return False, str(e)
