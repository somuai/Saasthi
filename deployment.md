# Production Deployment Guide (100% Free Stack)

This guide walks you through deploying the **Saasthi** Django backend to the cloud for free, allowing mobile APKs to sync online and administrators to access the dashboard.

---

## 1. Provision Free Cloud Database (Neon Postgres)
Neon offers a serverless PostgreSQL database with a permanent free tier.

1. Go to [Neon.tech](https://neon.tech/) and sign up.
2. Create a new project called `saasthi`.
3. Copy the **Connection String** from the dashboard. It will look like this:
   ```env
   postgresql://alex:abc123xyz@ep-cool-water-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this URL. You will use it as the `DATABASE_URL` in Django.

---

## 2. Provision Free Celery Queue / Cache (Upstash Redis)
Upstash offers serverless Redis with a permanent free tier (10,000 commands/day).

1. Go to [Upstash.com](https://upstash.com/) and sign up.
2. Click **Create Database**, select **Redis**, and choose a region close to your database.
3. Once created, copy the **Redis URL** (under the Node.js/Python or general connection properties). It will look like:
   ```env
   redis://default:somepassword@cool-puma-35323.upstash.io:6379
   ```
4. Save this URL. You will use it as the `REDIS_URL` and `CELERY_BROKER_URL` in Django.

---

## 3. Deploy Backend API to Render or Koyeb
We recommend **Koyeb** because it runs 24/7 on the free tier (no sleep mode), but **Render** is also extremely straightforward.

### Option A: Render Setup (Spins down on inactivity)
1. Sign up on [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the Saasthi codebase.
4. Configure the Web Service settings:
   - **Name**: `saasthi-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Branch**: `main`
   - **Plan**: `Free`
5. Under **Environment Variables**, add:
   - `DJANGO_SECRET_KEY` = *[Generate a long random secure key]*
   - `DATABASE_URL` = *[Your Neon Connection String]*
   - `REDIS_URL` = *[Your Upstash Redis URL]*
   - `CELERY_BROKER_URL` = *[Your Upstash Redis URL]*
   - `DJANGO_DEBUG` = `False`
   - `DJANGO_ALLOWED_HOSTS` = `your-render-app-url.onrender.com`
   - `GEMMA_API_KEY` = *[Your Google GenAI API Key]*
   - `SENTRY_DSN` = *[Your Sentry DSN]*
6. Click **Deploy Web Service**. Render will read the `backend/Dockerfile`, build the image, and host the Django application.

### Option B: Koyeb Setup (Runs 24/7 without spin-down)
1. Sign up on [Koyeb.com](https://www.koyeb.com/).
2. Click **Create Service** and connect your GitHub repository.
3. Set the configuration details:
   - **Work Directory**: `backend`
   - **Builder**: `Docker` (automatically uses `Dockerfile`)
   - **Instance Size**: `Nano` (Free Tier)
4. Add the same **Environment Variables** listed in the Render section above.
5. Set the port to `8000`.
6. Click **Deploy**. Koyeb will build the Docker container and deploy it with a public URL.

---

## 4. Run Django Migrations & Create Superuser in Production
Once the cloud backend is deployed:

### On Render:
1. Go to your Web Service dashboard on Render.
2. Click on the **Shell** tab on the left.
3. Run the migrations:
   ```bash
   python manage.py migrate
   ```
4. Create the admin user:
   ```bash
   python manage.py createsuperuser
   ```
   Follow the prompts to enter a phone number (e.g., `+919000000000`), password, and email.

### On Koyeb:
1. Go to your Koyeb service dashboard.
2. Click **Console** or use the Koyeb CLI.
3. Run `python manage.py migrate` and `python manage.py createsuperuser` just like above.

---

## 5. Update Mobile App Base URL & Build APK
Once your backend is live (e.g. at `https://saasthi-backend.onrender.com/`):

1. Update your environment configuration inside the mobile app:
   - In `mobile/.env`, set:
     ```env
     EXPO_PUBLIC_API_URL=https://your-deployed-backend-url.onrender.com/api/v1
     ```
2. Build the production release APK for the workers:
   ```bash
   cd mobile
   npm run native:android:apk
   ```
3. Copy the compiled APK from the build outputs and share it via WhatsApp. Any device installing this APK will now communicate directly with your cloud production database over the internet!
