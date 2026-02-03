# Deploy en VPS con Docker

## Requisitos del VPS

- **OS**: Ubuntu 22.04 LTS o similar
- **CPU**: 2+ vCPU (OCR es intensivo)
- **RAM**: 4GB mínimo (8GB recomendado)
- **Disco**: 20GB+ (modelos OCR + proyectos)
- **Docker**: 20.10+ y docker-compose

## Instalación rápida

```bash
# 1. Clonar repositorio
git clone <tu-repo>
cd Traducir\ PDF\ CHN-ESP

# 2. Configurar variables (opcional)
cp docker/.env.example docker/.env
# Editar docker/.env con tu configuración

# 3. Levantar servicios
cd docker
docker-compose up -d

# 4. Verificar
 curl http://localhost:8000/health
```

## Configuración

### Variables de entorno (backend)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Interface de red (usar `0.0.0.0` para VPS) |
| `PORT` | `8000` | Puerto del API |
| `ALLOWED_ORIGINS` | `""` | Orígenes CORS separados por coma |
| `APP_DATA_DIR` | `/data` | Directorio de datos persistentes |

### Ejemplo para VPS público

```bash
# docker/.env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com
```

## Estructura de datos

Los datos se almacenan en el volumen Docker `nb7x-data`:

```
/data/
├── projects/          # Proyectos y PDFs
├── jobs/             # Jobs en proceso
├── logs/             # Logs del backend
└── config.json       # Configuración global
```

## Backup

```bash
# Backup de datos
docker run --rm -v nb7x-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/nb7x-backup.tar.gz -C /data .

# Restore
docker run --rm -v nb7x-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/nb7x-backup.tar.gz -C /data
```

## SSL/HTTPS (opcional)

Usar nginx reverse proxy o traefik:

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  frontend:
    environment:
      - API_URL=https://api.tudominio.com
  backend:
    environment:
      - ALLOWED_ORIGINS=https://tudominio.com
```

## Troubleshooting

### El frontend no conecta al backend
- Verificar `ALLOWED_ORIGINS` incluye el dominio del frontend
- Revisar logs: `docker-compose logs backend`

### OCR muy lento
- El VPS no tiene GPU → OCR usa CPU
- Considerar upgrade a VPS con GPU o más vCPU

### Espacio en disco
```bash
# Limpiar proyectos antiguos
docker exec -it nb7x-backend rm -rf /data/projects/<project_id>
```

## Diferencias con versión Desktop

| Aspecto | Desktop | VPS Docker |
|---------|---------|------------|
| Backend | `127.0.0.1:8000` | `0.0.0.0:8000` |
| Frontend | Electron | Nginx + React |
| CORS | localhost loopback | Dominio específico |
| Persistencia | `%APPDATA%` | Volumen Docker `/data` |
| GPU | Opcional | No (sin config extra) |
