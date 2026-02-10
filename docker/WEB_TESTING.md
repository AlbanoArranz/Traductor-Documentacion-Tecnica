# Testing de Despliegue Web

## Pruebas de Health Check

### Backend Health Check
```bash
# Test de health endpoint
curl -f https://nb7x.tu-dominio.com/api/health

# Expected output:
{
  "status": "healthy",
  "version": "0.1.0"
}
```

### Frontend Health Check
```bash
# Test de frontend
curl -f https://nb7x.tu-dominio.com

# Expected: HTML de la aplicación
```

## Pruebas Funcionales

### 1. Crear Proyecto
1. Abrir https://nb7x.tu-dominio.com
2. Click en "Nuevo Proyecto"
3. Subir PDF de prueba
4. Verificar que se crea el proyecto
5. Verificar que aparece en lista de proyectos

### 2. Renderizar Página
1. Abrir proyecto creado
2. Click en "Renderizar" (DPI: 450)
3. Verificar que se genera imagen original
4. Verificar que aparece thumbnail

### 3. Ejecutar OCR
1. Click en "OCR"
2. Verificar que se detectan regiones de texto chino
3. Verificar que se muestran cajas de texto en la imagen
4. Verificar que se listan regiones en el panel lateral

### 4. Traducir con DeepL
1. Configurar DeepL API Key en Settings
2. Click en "Traducir" en una región
3. Verificar que se traduce el texto chino a español
4. Verificar que se actualiza la región en el panel

### 5. Componer Traducción
1. Click en "Componer"
2. Verificar que se genera imagen traducida
3. Verificar que se muestra en el visor
4. Verificar que el texto español reemplaza al chino

### 6. Exportar PDF
1. Click en "Exportar PDF"
2. Verificar que se genera PDF final
3. Descargar y abrir PDF
4. Verificar que contiene traducciones

### 7. Glosario
1. Abrir Settings → Glosario
2. Añadir entrada: "测试" → "Prueba"
3. Click en "Aplicar Glosario"
4. Verificar que se actualizan regiones con ese término

### 8. Persistencia de Datos
1. Reiniciar contenedores:
   ```bash
   docker-compose restart
   ```
2. Abrir https://nb7x.tu-dominio.com
3. Verificar que proyectos persisten
4. Verificar que traducciones persisten
5. Verificar que glosario persiste

## Pruebas de Rendimiento

### Carga de PDF Grande
1. Subir PDF de 10+ páginas
2. Verificar tiempo de renderizado
3. Verificar memoria usada (docker stats)
4. Verificar CPU usada (docker stats)

### Concurrencia
1. Abrir 2-3 proyectos en tabs diferentes
2. Renderizar páginas en paralelo
3. Verificar que no hay errores
4. Verificar rendimiento aceptable

### Memoria y CPU
```bash
# Verificar uso de recursos
docker stats

# Expected:
# Backend: < 2GB RAM, < 50% CPU
# Frontend: < 500MB RAM, < 10% CPU
```

## Pruebas de Error Handling

### Error de OCR
1. Subir PDF corrupto
2. Verificar mensaje de error
3. Verificar que no crashea la app

### Error de DeepL
1. Usar API key inválida
2. Verificar mensaje de error
3. Verificar que se puede reintentar

### Error de Archivo
1. Subir archivo no-PDF
2. Verificar mensaje de error
3. Verificar que se puede subir otro archivo

## Pruebas de Seguridad

### CORS
```bash
# Test de CORS
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://nb7x.tu-dominio.com/api/health

# Expected: 403 Forbidden
```

### Rate Limiting
1. Hacer 100+ requests en 1 segundo
2. Verificar que se bloquean después de cierto límite
3. Verificar mensaje de rate limit

### Autenticación (si se implementa)
1. Intentar acceder sin autenticación
2. Verificar que se redirige a login
3. Verificar que se puede autenticar

## Pruebas de UI

### Responsividad
1. Abrir en desktop (1920x1080)
2. Abrir en tablet (768x1024)
3. Abrir en móvil (375x667)
4. Verificar que UI se adapta

### Accesibilidad
1. Navegar con teclado (Tab)
2. Verificar focus visible
3. Verificar labels en inputs
4. Verificar alt text en imágenes

### Performance
1. Abrir DevTools → Performance
2. Grabar carga inicial
3. Verificar tiempo de First Contentful Paint < 2s
4. Verificar tiempo de Largest Contentful Paint < 4s

## Checklist de Verificación

### Funcionalidad
- [ ] Crear proyecto y subir PDF
- [ ] Renderizar página (450 DPI)
- [ ] Ejecutar OCR (PaddleOCR)
- [ ] Traducir con DeepL
- [ ] Componer traducción
- [ ] Exportar PDF final
- [ ] Glosario editable
- [ ] Persistencia de datos tras reinicio

### Rendimiento
- [ ] Carga de PDF grande < 30s
- [ ] OCR de página < 10s
- [ ] Traducción de página < 5s
- [ ] Composición de página < 5s
- [ ] Exportación de PDF < 10s
- [ ] Memoria < 2GB
- [ ] CPU < 50%

### Seguridad
- [ ] CORS configurado correctamente
- [ ] SSL habilitado
- [ ] Firewall configurado
- [ ] API keys en variables de entorno
- [ ] Rate limiting habilitado

### UI/UX
- [ ] Responsivo en desktop/tablet/móvil
- [ ] Accesible con teclado
- [ ] Performance aceptable
- [ ] Mensajes de error claros
- [ ] Loading states visibles

## Comandos Útiles

### Ver Logs
```bash
# Backend
docker logs -f nb7x-backend

# Frontend
docker logs -f nb7x-frontend

# Ambos
docker-compose logs -f
```

### Reiniciar Servicios
```bash
# Reiniciar backend
docker-compose restart backend

# Reiniciar frontend
docker-compose restart frontend

# Reiniciar ambos
docker-compose restart
```

### Ver Contenedores
```bash
# Ver contenedores activos
docker ps

# Ver recursos
docker stats

# Ver detalles
docker inspect nb7x-backend
```

### Debugging
```bash
# Entrar en contenedor backend
docker exec -it nb7x-backend bash

# Entrar en contenedor frontend
docker exec -it nb7x-frontend sh

# Ver archivos de datos
docker exec -it nb7x-backend ls -la /data
```

## Troubleshooting

### Backend no responde
```bash
# Ver logs
docker logs nb7x-backend

# Restart
docker-compose restart backend

# Ver health
docker exec -it nb7x-backend curl http://localhost:8000/health
```

### Frontend carga pero no funciona
```bash
# Ver logs
docker logs nb7x-frontend

# Ver archivos
docker exec -it nb7x-frontend ls -la /usr/share/nginx/html

# Ver nginx config
docker exec -it nb7x-frontend cat /etc/nginx/conf.d/default.conf
```

### Datos no persisten
```bash
# Ver volumen
docker volume inspect nb7x-data

# Ver contenido
docker run --rm -v nb7x-data:/data alpine ls -la /data

# Ver permisos
docker run --rm -v nb7x-data:/data alpine ls -la /data/projects
```

## Pruebas Automatizadas (Opcional)

### Script de Testing
```bash
#!/bin/bash
# test-deployment.sh

echo "Testing deployment..."

# Health check
curl -f https://nb7x.tu-dominio.com/api/health || exit 1

# Frontend
curl -f https://nb7x.tu-dominio.com || exit 1

# Contenedores
docker ps | grep nb7x-backend || exit 1
docker ps | grep nb7x-frontend || exit 1

echo "All tests passed!"
```

### Ejecutar
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```
