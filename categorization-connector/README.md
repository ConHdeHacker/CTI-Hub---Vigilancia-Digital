# Categorization Connector

Microservicio asíncrono en Python 3.11 para la comprobación de dominios/IPs contra listas de categorización.

## Características
- **FastAPI** para alto rendimiento.
- **Async total** (SQLAlchemy, HTTPX, Redis, DNS).
- **Configuración por capas**: Vault -> DB -> YAML -> Env.
- **Recarga dinámica** de configuración sin reinicio.
- **Soporte multi-proveedor**: URLHaus, AbuseIPDB, OTX, Spamhaus.
- **Métricas Prometheus** integradas.

## Requisitos
- Python 3.11+
- PostgreSQL
- Redis
- Vault (opcional)

## Instalación Local
1. Clonar el repositorio.
2. Crear un entorno virtual: `python -m venv venv && source venv/bin/activate`.
3. Instalar dependencias: `pip install -r requirements.txt`.
4. Configurar variables de entorno en `.env` (ver `config.example.env`).
5. Ejecutar migraciones: `psql $DATABASE_URL -f migrations/001_initial.sql && psql $DATABASE_URL -f migrations/002_provider_configs.sql`.
6. Iniciar el servicio: `uvicorn src.main:app --reload`.

## Docker Compose
```bash
docker-compose up --build
```

## API Administrativa
La API requiere el header `x-admin-token` con el valor definido en `ADMIN_API_TOKEN`.

### Ejemplos de uso (cURL)

**1. Crear un proveedor (AbuseIPDB):**
```bash
curl -X POST http://localhost:8000/v1/admin/providers \
  -H "x-admin-token: changeme_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_key": "abuseipdb",
    "display_name": "AbuseIPDB API",
    "enabled": true,
    "provider_type": "api",
    "endpoint": "https://api.abuseipdb.com/api/v2/check",
    "auth_type": "api_key",
    "auth_payload": {"api_key": "TU_API_KEY_AQUI"}
  }'
```

**2. Recargar configuración:**
```bash
curl -X POST http://localhost:8000/v1/admin/reload \
  -H "x-admin-token: changeme_admin_token"
```

**3. Enriquecer un indicador:**
```bash
curl -X POST http://localhost:8000/v1/enrich \
  -H "Content-Type: application/json" \
  -d '{"value": "1.2.3.4", "type": "ip"}'
```

## Tests
Ejecutar tests con cobertura:
```bash
pytest --cov=src
```

## Advertencias Legales
Algunos proveedores como **Spamhaus** tienen restricciones de uso comercial. Asegúrese de tener la licencia adecuada antes de activar estos proveedores en producción.
