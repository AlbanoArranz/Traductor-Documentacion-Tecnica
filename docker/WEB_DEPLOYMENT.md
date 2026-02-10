# Despliegue Web en VPS con Dokploy

Este documento describe cómo desplegar NB7X Translator en un VPS Hostinger usando Dokploy.

## Arquitectura

```
┌─────────────────────────────────────────┐
│           VPS Hostinger                  │
│  ┌───────────────────────────────────┐  │
│  │  Frontend (nginx:80)              │  │
│  │  - React + Vite build             │  │
│  │  - Servido por nginx              │  │
│  └───────────────────────────────────┘  │
│           ↓                              │
│  ┌───────────────────────────────────┐  │
│  │  Backend (FastAPI:8000)           │  │
│  │  - Python 3.11 + FastAPI          │  │
│  │  - PaddleOCR + DeepL             │  │
│  │  - Datos en volumen persistente   │  │
│  └───────────────────────────────────┘  │
│           ↓                              │
│  ┌───────────────────────────────────┐  │
│  │  Volumen Persistente              │  │
│  │  - /data/projects/               │  │
│  │  - /data/jobs/                   │  │
│  │  - /data/logs/                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Pasos de Despliegue

### 1. Preparar Repositorio

```bash
# Asegurar que el código está en GitHub/GitLab
git add .
git commit -m "feat: add web deployment support"
git push origin main
```

### 2. Instalar Dokploy en VPS

Ver instrucciones detalladas en `docker/DOKPLOY_INSTALL.md`

### 3. Configurar Proyecto en Dokploy

1. Crear proyecto "nb7x-translator"
2. Conectar a repositorio
3. Configurar variables de entorno
4. Desplegar con docker-compose

### 4. Configurar Dominio y SSL

- Dominio: nb7x.tu-dominio.com
- SSL: Let's Encrypt (automático vía Dokploy)
- Puertos: 80 (HTTP), 443 (HTTPS)

### 5. Verificar Despliegue

```bash
# Test de health
curl https://nb7x.tu-dominio.com/api/health

# Test de frontend
curl https://nb7x.tu-dominio.com

# Ver logs en Dokploy UI
```

## Variables de Entorno

### Backend
```bash
HOST=0.0.0.0
PORT=8000
APP_DATA_DIR=/data
ALLOWED_ORIGINS=https://nb7x.tu-dominio.com
DEEPL_API_KEY=tu_api_key
```

### Frontend
```bash
VITE_API_URL=https://nb7x.tu-dominio.com/api
VITE_APP_MODE=web
```

## Persistencia de Datos

Los datos se almacenan en volumen Docker `nb7x-data`:

```
/data/
├── projects/
│   └── {project_id}/
│       ├── src.pdf
│       ├── meta.json
│       ├── pages/
│       ├── thumbs/
│       └── export/
├── jobs/
│   └── {job_id}.json
└── logs/
    ├── backend.log
    └── desktop.log
```

## Diferencias vs Versión Escritorio

| Escritorio | Web (Dokploy) |
|------------|---------------|
| Electron | React web-only |
| PyInstaller onefolder | Docker container |
| `%APPDATA%\NB7XTranslator\` | `/data/` en volumen |
| Loopback `127.0.0.1` | Externo via HTTPS |
| Instalación local | Acceso web |

## Mantenimiento

### Actualizar aplicación
```bash
# Push cambios a GitHub
git push origin main

# Dokploy detecta y despliega automáticamente
```

### Backup de datos
```bash
# Backup del volumen
docker run --rm -v nb7x-data:/data -v $(pwd):/backup alpine tar czf /backup/nb7x-backup-$(date +%Y%m%d).tar.gz /data
```

### Ver logs
```bash
# Backend
docker logs -f nb7x-backend

# Frontend
docker logs -f nb7x-frontend
```

### Reiniciar servicios
```bash
docker-compose restart
```

## Troubleshooting

### Contenedor no inicia
```bash
docker logs nb7x-backend
docker logs nb7x-frontend
```

### Error de permisos
```bash
sudo chown -R 1000:1000 /var/lib/docker/volumes/nb7x-data/_data
```

### Backend no responde
```bash
docker exec -it nb7x-backend curl http://localhost:8000/health
```

## Seguridad

- Firewall configurado (puertos 80, 443, 22)
- SSL con Let's Encrypt
- CORS restringido a dominio del VPS
- API keys en variables de entorno
- Rate limiting recomendado en backend

## Recursos

- Dokploy: https://dokploy.com/docs
- Docker: https://docs.docker.com
- FastAPI: https://fastapi.tiangolo.com
