#!/bin/bash

# ==============================================================================
# Script de Despliegue Automático para Ubuntu AWS (Versión Pruebas)
# ==============================================================================

echo "🚀 Iniciando despliegue de Saint App (AWS Pruebas)..."

# 1. Obtener última versión desde Git
echo "📦 Actualizando código desde Git..."
git pull origin main --rebase

# 2. Instalar dependencias si es necesario
echo "🔧 Instalando dependencias..."
npm install --legacy-peer-deps

# 3. Compilar la aplicación Angular para entorno AWS
echo "🏗️ Compilando Angular con configuración AWS..."
npm run build:aws

echo "✅ Compilación exitosa. Archivos generados en dist/saint-app/"
echo "💡 Recuerda configurar Nginx para apuntar a la carpeta dist/saint-app/browser (o dist/saint-app)."
