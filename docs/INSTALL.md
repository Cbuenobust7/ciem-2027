# Instalación

## 1. Preparar el proyecto

Extraiga el paquete y entre en su directorio:

```bash
cd marketplace-starter
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Edite los archivos `.env` con valores propios antes de continuar.

## 2. Servicios de datos

Inicie PostgreSQL y Redis con Compose:

```bash
docker compose up -d db redis
docker compose ps
```

No use nombres fijos de contenedor. Compose debe generar nombres aislados por
proyecto, lo que permite varias instalaciones en el mismo host.

## 3. Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py check
```

Inicie el backend de desarrollo según la configuración de su entorno.

## 4. Frontend

Desde `frontend/`:

```bash
npm install
npm run dev -- --port 5190 --host 0.0.0.0
```

El frontend queda disponible en `http://localhost:5190/`.

## 5. Verificación inicial

Compruebe que puede registrar un usuario, iniciar sesión, crear un listing y
consultarlo. Para los valores requeridos, vea [Environment Variables](ENVIRONMENT_VARIABLES.md).
