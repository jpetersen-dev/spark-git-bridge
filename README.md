# Spark MCP Router ⚡🤖

Servidor **MCP (Model Context Protocol) Multi-Servicio Serverless** diseñado para ejecutarse en **Vercel** y conectarse de forma privada y segura con **Gemini Spark**.

Permite que Gemini Spark actúe como un agente inteligente capaz de consultar y modificar tus repositorios en **GitHub**, al mismo tiempo que envía notificaciones, reportes o interactúa en chats y canales de **Telegram**.

---

## 🌟 Servicios y Herramientas Soportadas (31 en total)

### 🐙 GitHub (26 herramientas oficiales)
- **Repositorios**: `create_repository`, `search_repositories`, `fork_repository`
- **Archivos**: `create_or_update_file`, `get_file_contents`, `push_files`
- **Ramas y Commits**: `create_branch`, `list_commits`
- **Issues**: `create_issue`, `get_issue`, `list_issues`, `update_issue`, `add_issue_comment`, `search_issues`
- **Pull Requests**: `create_pull_request`, `get_pull_request`, `list_pull_requests`, `merge_pull_request`, `get_pull_request_files`, `get_pull_request_status`, `update_pull_request_branch`, `get_pull_request_comments`, `get_pull_request_reviews`, `create_pull_request_review`
- **Búsquedas**: `search_code`, `search_users`

### ✈️ Telegram (5 herramientas)
- `telegram_send_message`: Envía mensajes de texto, alertas o informes formateados (Markdown o HTML) a un chat o canal.
- `telegram_get_messages`: Obtiene los últimos mensajes o interacciones recibidas por tu bot.
- `telegram_send_photo`: Envía imágenes por URL con pie de foto opcional.
- `telegram_get_me`: Consulta información básica y estado del bot.
- `telegram_get_chat`: Obtiene detalles sobre un chat o usuario específico.

---

## 🔒 Seguridad y Enrutamiento Dinámico

El servidor exige autenticación obligatoria mediante una clave secreta (`BRIDGE_AUTH_TOKEN`). Cualquier petición no autorizada es bloqueada con `401 Unauthorized`.

Para cumplir con las especificaciones de **Gemini Spark**, la clave se envía en la ruta URL:

| Endpoint | Servicios Habilitados | URL de Conexión en Spark |
| :--- | :--- | :--- |
| **Router Completo** | GitHub + Telegram (31 tools) | `https://tu-proyecto.vercel.app/api/mcp/TU_TOKEN` |
| **Solo Telegram** | Telegram (5 tools) | `https://tu-proyecto.vercel.app/api/mcp/telegram/TU_TOKEN` |
| **Solo GitHub** | GitHub (26 tools) | `https://tu-proyecto.vercel.app/api/mcp/github/TU_TOKEN` |

> ℹ️ **Transporte**: Utiliza **Streamable HTTP (Stateless)**, optimizado para funciones serverless de Vercel con respuesta instantánea a healthchecks (`GET`/`HEAD`) para evitar timeouts.

---

## ⚙️ Variables de Entorno en Vercel

Configura estas variables en Vercel (**Project Settings > Environment Variables**):

| Variable | Requerida | Descripción |
| :--- | :---: | :--- |
| `BRIDGE_AUTH_TOKEN` | **Sí** | Token secreto que protege el acceso a tu servidor MCP. |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Para GitHub | Personal Access Token con permisos de repositorio (`repo`). |
| `TELEGRAM_BOT_TOKEN` | Para Telegram | Token generado con `@BotFather` al crear tu bot. |
| `TELEGRAM_DEFAULT_CHAT_ID` | Opcional | Tu Chat ID personal para no tener que especificarlo en cada comando. |

---

## 🤖 Cómo configurar Telegram

1. **Crear tu bot**:
   - Abre Telegram y busca a [@BotFather](https://t.me/BotFather).
   - Envía `/newbot`, dale un nombre y un username (ej. `MiAsistenteSparkBot`).
   - Copia el token HTTP API generado (ej. `7123456789:ABCdef...`) y colócalo en Vercel como `TELEGRAM_BOT_TOKEN`.
2. **Obtener tu Chat ID**:
   - Inicia conversación con tu nuevo bot en Telegram (haz clic en **Start**).
   - Abre el bot [@userinfobot](https://t.me/userinfobot) y pulsa iniciar. Te responderá con tu `Id` numérico.
   - Configúralo en Vercel como `TELEGRAM_DEFAULT_CHAT_ID`.

---

## 🔄 Cambiar el Nombre del Repositorio en GitHub

Si deseas renombrar este repositorio en GitHub (por ejemplo de `spark-git-bridge` a `spark-mcp-router`):

1. Ve a tu repositorio en **GitHub > Settings > General > Repository name**.
2. Escribe el nuevo nombre (ej: `spark-mcp-router`) y pulsa **Rename**.
3. En tu terminal local, actualiza la dirección del repositorio remoto:
   ```bash
   git remote set-url origin https://github.com/jpetersen-dev/spark-mcp-router.git
   ```
4. **Vercel** reconoce automáticamente el nuevo nombre de GitHub mediante su ID interno, por lo que tus despliegues seguirán funcionando sin ninguna configuración adicional.
