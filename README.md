# GitHub MCP Serverless Bridge (para Gemini Spark en Vercel)

Servidor MCP (Model Context Protocol) oficial de GitHub adaptado para ejecutarse como **Serverless Functions en Vercel**. Actúa como un puente privado, seguro y protegido por autenticación que permite a **Gemini Spark** interactuar directamente con tus repositorios, ramas, pull requests, issues y código en GitHub.

---

## 🔒 Capa de Seguridad y Autenticación

El servidor cuenta con protección contra accesos no autorizados mediante una clave secreta (`BRIDGE_AUTH_TOKEN`):

- **Sin esta clave**, cualquier intento de conexión (incluso teniendo la URL pública de Vercel) es rechazado de inmediato con un código `401 Unauthorized`.
- **Doble soporte de autenticación**:
  1. **Query Param** (Recomendado para SSE): `https://tu-proyecto.vercel.app/api/sse?token=TU_CLAVE_SECRETA`
  2. **Encabezado HTTP**: `Authorization: Bearer TU_CLAVE_SECRETA` o `x-bridge-token: TU_CLAVE_SECRETA`

---

## 📁 Estructura del Proyecto

```text
spark-git-bridge/
├── api/
│   ├── sse.js          # Endpoint SSE (GET /api/sse) - Valida acceso e inicia el stream
│   └── messages.js     # Endpoint POST (/api/messages) - Valida acceso y procesa mensajes
├── lib/
│   ├── auth.js         # Middleware de validación de tokens de seguridad
│   └── server.js       # Registro de las 26 herramientas oficiales y almacén de sesiones
├── .env.example        # Plantilla con las variables requeridas
├── .gitignore          # Exclusiones estándar de Git y Vercel
├── package.json        # Configuración ESM ("type": "module") y dependencias oficiales
├── vercel.json         # Configuración de tiempo de ejecución (maxDuration: 60)
└── README.md           # Guía de configuración
```

---

## ⚙️ Variables de Entorno Requeridas

En tu entorno local (`.env.local`) y en Vercel (**Project Settings > Environment Variables**), configura:

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `BRIDGE_AUTH_TOKEN` | Token secreto que tú eliges para autorizar el acceso al servidor MCP. | `mi_clave_secreta_super_robusta_99` |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Token de acceso personal generado en GitHub con permisos de repositorio (`repo`). | `ghp_xxxxxxxxxxxxxxxxxxxx` |

> 💡 **Tip para generar una clave segura**: En tu terminal puedes ejecutar:
> ```bash
> openssl rand -hex 24
> ```

---

## 🚀 Despliegue en Vercel

1. **Mediante CLI de Vercel**:
   ```bash
   # 1. Configurar variables de entorno en Vercel
   vercel env add BRIDGE_AUTH_TOKEN
   vercel env add GITHUB_PERSONAL_ACCESS_TOKEN

   # 2. Desplegar a producción
   vercel --prod
   ```

2. **Mediante GitHub y Dashboard de Vercel**:
   - Sube este repositorio a GitHub como privado.
   - Conéctalo en [Vercel](https://vercel.com/new).
   - En la sección **Environment Variables**, añade `BRIDGE_AUTH_TOKEN` y `GITHUB_PERSONAL_ACCESS_TOKEN`.
   - Haz clic en **Deploy**.

---

## 🔗 Conexión con Gemini Spark

En la configuración de MCP de **Gemini Spark**:

1. **Tipo de Transporte**: `SSE`
2. **Server URL**:
   ```text
   https://tu-proyecto.vercel.app/api/sse?token=TU_CLAVE_SECRETA
   ```
3. Si la herramienta te permite ingresar encabezados (*Headers*):
   - **URL**: `https://tu-proyecto.vercel.app/api/sse`
   - **Header**: `Authorization: Bearer TU_CLAVE_SECRETA` (o `x-bridge-token: TU_CLAVE_SECRETA`)

El servidor validará la clave al momento del apretón de manos inicial y mantendrá la conexión segura en cada consulta posterior.
