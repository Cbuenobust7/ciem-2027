# Marketplace Starter Buyer Setup Guide

This guide explains how to configure, run, use, and deploy Marketplace
Starter from the delivered source package. Follow the steps in order for a
new installation.

## 1. Requirements

The following versions were used to verify this package:

- Python 3.12
- Node.js 20.19 or later, or Node.js 22.12 or later
- PostgreSQL 15
- Redis 7
- Docker Engine and Docker Compose (optional, recommended for PostgreSQL and
  Redis)

The package uses Django 5.2, Django REST Framework, React 19, Vite 8, and
Tailwind CSS 3. Docker Compose starts PostgreSQL and Redis only; run the
Django application and React development server on the host as described
below.

## 2. Package layout

```text
marketplace-starter/
├── manage.py                 Django management command
├── requirements.txt          Python dependencies
├── .env.example              Backend environment template
├── docker-compose.yml        PostgreSQL and Redis services
├── core/                     Django settings and project configuration
├── creatorhub_core/          Shared application services
├── marketplace/              Marketplace domain applications
├── frontend/                 React and Vite application
│   ├── .env.example          Frontend environment template
│   └── package.json          Node scripts and dependencies
└── docs/                     Buyer documentation
```

## 3. Create the environment files

From the extracted package directory, copy both templates:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Edit the root `.env` file. For a local development setup, use values in this
form and replace placeholder secrets before exposing an environment:

```dotenv
SECRET_KEY=your-custom-secure-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DB_NAME=marketplace_starter
DB_USER=marketplace_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:5190,http://127.0.0.1:5190
```

The rest of `.env.example` contains optional host-port, public URL, platform,
and payment settings. Keep payment credentials empty unless you intentionally
configure an account that you own. Never commit `.env` files.

The frontend template should contain the backend API URL:

```dotenv
VITE_API_URL=http://localhost:8078
```

Restart Vite after changing a `VITE_` variable. Vite embeds these public
variables when it starts or builds the application.

## 4. Start PostgreSQL and Redis

The supplied Compose file starts isolated PostgreSQL 15 and Redis 7 services.
It reads the database values from the root `.env` file:

```bash
docker compose up -d db redis
docker compose ps
```

If ports 5432 or 6379 are already in use, set `POSTGRES_HOST_PORT` and
`REDIS_HOST_PORT` in `.env` to available host ports, and set `DB_PORT` and
`REDIS_PORT` to those same host ports for a host-run Django process.

You may use locally installed PostgreSQL and Redis instead of Compose. In that
case, create the database and user specified by `DB_NAME`, `DB_USER`, and
`DB_PASSWORD`, then ensure both services accept local connections.

## 5. Install and prepare the backend

From the package root, create a virtual environment, install dependencies,
run migrations, and validate the Django configuration:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py check
```

Create an administrator account when you need access to the Django admin:

```bash
python manage.py createsuperuser
```

Start the backend development server on port 8078:

```bash
python manage.py runserver 0.0.0.0:8078
```

The API is available at `http://127.0.0.1:8078/api/` and the Django admin is
available at `http://127.0.0.1:8078/admin/`.

## 6. Install and run the frontend

Open a second terminal, then install the locked frontend dependencies and run
Vite on port 5190:

```bash
cd frontend
npm ci
npm run dev -- --port 5190 --host 0.0.0.0
```

Open `http://localhost:5190/` in a browser. The `--host 0.0.0.0` option allows
connections from another machine when firewall rules permit it. For a
production frontend build, run:

```bash
npm run build
```

The compiled files are written to `frontend/dist/`.

## 7. Basic application usage

1. Open `/register` and create a user account.
2. Sign in at `/login`.
3. Open **My Listings** and create a listing. A new listing starts as a draft.
4. Edit the listing as required, then use **Publish** to make it active and
   visible in public listings.
5. From **My Listings**, you can edit, mark a listing as sold, or delete a
   listing that you own.
6. Use `/admin/` with the superuser created above to manage users, listings,
   categories, visibility records, and related data.

Listing statuses are `draft`, `active`, `paused`, `sold`, and `expired`.
Public listing feeds show active listings. Visibility features are managed from
the visibility pages after sign-in.

## 8. Production deployment overview

Before deploying, create production-specific environment files and set at
least the following:

```dotenv
DEBUG=False
ALLOWED_HOSTS=your-domain.example
CORS_ALLOWED_ORIGINS=https://your-domain.example
FRONTEND_URL=https://your-domain.example
BACKEND_URL=https://your-domain.example
```

Use unique production secrets and separate PostgreSQL, Redis, and payment
credentials. Apply migrations and collect static files before starting the
application:

```bash
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
cd frontend
npm ci
npm run build
```

Run Django with a production process manager, for example:

```bash
gunicorn core.wsgi:application --bind 0.0.0.0:8078
```

Place a reverse proxy and TLS termination in front of Gunicorn. Configure it to
serve the built frontend files, forward API and admin requests to Gunicorn, and
serve Django static and media files according to your infrastructure. Validate
the public site, login, API, admin, and static files after deployment.

## 9. Payments and security

Payment configuration is optional. The package ships without payment
credentials. If you enable it, supply credentials and webhook URLs for your
own payment account and test them in a non-production environment first.

Use a unique `SECRET_KEY` for every environment. Do not publish `.env` files,
database dumps, customer data, access tokens, or webhook secrets. Review
`SECURITY.md` and `LICENSE` before deployment.

## 10. Troubleshooting

- **Database connection error:** confirm PostgreSQL is running, then check
  `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT`.
- **Redis connection error:** confirm Redis is running and that `REDIS_HOST`
  and `REDIS_PORT` match the reachable service.
- **Frontend cannot reach the API:** confirm the backend is on port 8078,
  `VITE_API_URL` matches it, and restart Vite after changing the value.
- **Frontend is inaccessible from another machine:** start Vite with
  `npm run dev -- --port 5190 --host 0.0.0.0` and allow the port in the host
  firewall if appropriate.
- **Static files missing in production:** run `python manage.py
  collectstatic --noinput` and confirm your reverse proxy serves the resulting
  static-file location.

For a support request, include the command used, its complete error output,
your operating system, and the relevant service logs. Do not include secrets.
