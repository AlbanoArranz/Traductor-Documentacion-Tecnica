# Instalación de Dokploy en VPS Hostinger

## Requisitos previos
- VPS Hostinger con Ubuntu 20.04+ o Debian 11+
- Acceso SSH al servidor
- Dominio o subdominio configurado (ej. nb7x.tu-dominio.com)
- Mínimo 2GB RAM, 20GB disco

## Paso 1: Instalar Docker y Docker Compose

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Añadir usuario al grupo docker
sudo usermod -aG docker $USER

# Habilitar Docker al inicio
sudo systemctl enable docker
sudo systemctl start docker
```

## Paso 2: Instalar Dokploy

```bash
# Crear directorio para Dokploy
sudo mkdir -p /opt/dokploy
cd /opt/dokploy

# Descargar docker-compose de Dokploy
curl -fsSL https://dokploy.com/install.sh -o install.sh
sudo bash install.sh

# Iniciar Dokploy
sudo docker-compose up -d
```

## Paso 3: Configurar Dokploy

1. Acceder a https://tu-vps-ip:3000
2. Crear cuenta de administrador
3. Configurar dominio:
   - Dominio principal: nb7x.tu-dominio.com
   - Habilitar SSL (Let's Encrypt)

## Paso 4: Configurar Firewall

```bash
# Permitir puertos necesarios
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Dokploy UI (opcional, solo para admin)
sudo ufw enable
```

## Paso 5: Crear Proyecto en Dokploy

1. En Dokploy UI → Projects → Create Project
2. Nombre: nb7x-translator
3. Tipo: Docker Compose
4. Conectar a repositorio (GitHub/GitLab):
   - Añadir access token de GitHub/GitLab
   - Seleccionar repositorio
   - Configurar rama: main

## Paso 6: Configurar Variables de Entorno

En Dokploy → Project → Settings → Environment Variables:

```bash
FRONTEND_URL=https://nb7x.tu-dominio.com
API_URL=https://nb7x.tu-dominio.com/api
DEEPL_API_KEY=tu_api_key_aqui
```

## Paso 7: Configurar Volumen Persistente

En Dokploy → Project → Settings → Volumes:
- Nombre: nb7x-data
- Ruta: /data
- Driver: local

## Paso 8: Desplegar

1. En Dokploy → Project → Deploy
2. Dokploy detecta docker-compose.yml
3. Inicia build y despliegue
4. Verificar logs en Dokploy UI

## Paso 9: Verificar Despliegue

```bash
# Verificar contenedores
docker ps

# Verificar logs
docker logs nb7x-backend
docker logs nb7x-frontend

# Test de backend
curl https://nb7x.tu-dominio.com/api/health

# Test de frontend
curl https://nb7x.tu-dominio.com
```

## Paso 10: Configurar SSL Automático

Dokploy configura automáticamente SSL con Let's Encrypt. Verificar:
- Certificado válido en https://nb7x.tu-dominio.com
- Redirección HTTP → HTTPS
- Certificado renovándose automáticamente

## Troubleshooting

### Contenedor no inicia
```bash
docker logs nb7x-backend
docker logs nb7x-frontend
```

### Error de permisos en volumen
```bash
sudo chown -R 1000:1000 /var/lib/docker/volumes/nb7x-data/_data
```

### Backend no responde
```bash
docker exec -it nb7x-backend curl http://localhost:8000/health
```

### Frontend no carga
```bash
docker exec -it nb7x-frontend ls -la /usr/share/nginx/html
```

## Recursos Adicionales

- Dokploy docs: https://dokploy.com/docs
- Docker docs: https://docs.docker.com
- Let's Encrypt: https://letsencrypt.org
