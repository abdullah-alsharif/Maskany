# Deployment Guide

This guide covers how to deploy Maskany to a production server using Docker Compose.

## Prerequisites

- Docker Engine ≥ 24 and Docker Compose v2
- A domain name pointing to your server
- A Twilio account for SMS OTP delivery
- A transactional email provider (Resend, SendGrid, Postmark, or AWS SES)

---

## 1. Set up Twilio for SMS

1. Sign up at [twilio.com](https://www.twilio.com) and verify your identity.
2. Go to **Console → Account Info** to find your:
   - **Account SID** — starts with `AC`.
   - **Auth Token** — treat this like a password.
3. Buy a phone number: **Phone Numbers → Manage → Buy a number**.
   - Pick a number with SMS capability in the appropriate country.
   - Note the number in E.164 format (e.g. `+14155551234`).
4. Set the three Twilio env vars in your `.env.production`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=<your auth token>
   TWILIO_PHONE_NUMBER=+14155551234
   ```

---

## 2. Set up SMTP email

Use a transactional email provider rather than a personal Gmail account.
Recommended options:

| Provider                            | Free tier                | Notes                                           |
| ----------------------------------- | ------------------------ | ----------------------------------------------- |
| [Resend](https://resend.com)        | 3 000 emails/month       | Simplest setup — SMTP with API key as password  |
| [SendGrid](https://sendgrid.com)    | 100 emails/day           | Requires domain authentication                  |
| [Postmark](https://postmarkapp.com) | 100 emails/month (trial) | Best deliverability                             |
| AWS SES                             | $0.10 per 1 000          | Cheapest at scale; requires domain + DKIM setup |

### Resend example

1. Create an account and verify your sending domain.
2. Go to **API Keys** and create a new key.
3. Configure SMTP in `.env.production`:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASS=re_xxxxxxxxxxxx
   SMTP_FROM=noreply@yourdomain.com
   ```

---

## 3. Configure environment variables

Copy the example file and fill in every value:

```bash
cp .env.production.example .env.production
nano .env.production
```

Key values to generate:

```bash
# Generate a secure JWT secret (64 random bytes, hex-encoded):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate a strong Postgres password:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The API will refuse to start if any production-required variable is missing.
Check `apps/api/src/config/require-env.ts` for the full list.

---

## 4. Deploy with Docker Compose

```bash
# Build images and start the full stack
docker compose -f docker-compose.deploy.yml --env-file .env.production up --build -d

# Follow logs
docker compose -f docker-compose.deploy.yml logs -f

# Verify the health endpoint is reachable
curl http://localhost/api/health
```

The stack starts in this order:

1. `postgres` — waits until healthy (pg_isready).
2. `api` — runs database migrations via `schema-flow run`, then starts the Express server.
3. `web` — starts the Next.js server.
4. `nginx` — begins accepting traffic on port 80 once the other services are up.

---

## 5. Database migrations

Migrations run automatically inside the `api` container on every startup via the
`docker-entrypoint.sh` script. To run them manually:

```bash
docker compose -f docker-compose.deploy.yml exec api sh -c "schema-flow run --dir /app/schema"
```

---

## 6. Persistent storage

The compose file defines two named volumes:

- `pgdata_prod` — PostgreSQL data files.
- `uploads_prod` — User-uploaded media files (images, videos).

Back up both volumes regularly. On a cloud VM you can snapshot the block device,
or use `pg_dump` for the database and `rsync` for uploads.

---

## 7. HTTPS / TLS

The nginx container listens on port 80. For production, front it with a TLS
terminator such as:

- **Caddy** — automatic HTTPS with Let's Encrypt, minimal config.
- **Certbot + nginx** — standard certbot setup; mount the certificate into the nginx container.
- **Cloud load balancer** — offload TLS at the cloud provider level (AWS ALB, GCP HTTPS LB).

---

## 8. Troubleshooting

| Symptom                                                                | Likely cause                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `startup aborted: Missing required production environment variable(s)` | A required env var is unset in `.env.production`. Check the error message for the variable name. |
| `[SMS] delivery failed` in API logs                                    | Twilio credentials are wrong or the Twilio number isn't SMS-capable.                             |
| `[EMAIL] delivery failed` in API logs                                  | SMTP credentials are wrong, or port 587/465 is blocked by a firewall.                            |
| `GET /api/health` returns 502                                          | The API container hasn't finished starting. Check `docker compose logs api`.                     |
| Database migration failure on startup                                  | `DATABASE_URL` is wrong, or the postgres container isn't healthy yet.                            |
