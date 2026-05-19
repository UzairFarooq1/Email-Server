# Mailer Deployment

This service is intended to run on the VPS behind nginx as:

```text
mailer.halaleventbrite.co.ke -> 127.0.0.1:5000
```

Deploy from the VPS:

```bash
cd /opt/halaleventbrite/mailer
git pull
docker compose up -d --build
```

Required production environment:

```env
NODE_ENV=production
PORT=5000

SMTP_HOST=mail.halaleventbrite.co.ke
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tickets@halaleventbrite.co.ke
SMTP_PASSWORD=replace-with-cpanel-mailbox-password
SMTP_FROM=tickets@halaleventbrite.co.ke

EMAIL_API_KEY=replace-with-long-random-secret
ALLOWED_ORIGINS=https://ticketing.halaleventbrite.co.ke,https://halal-eventbrite.vercel.app

FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account"}
REQUIRE_TICKET_STORAGE=true
```

The frontend or API caller must send the API key as either:

```text
x-api-key: your-secret
```

or:

```text
Authorization: Bearer your-secret
```
