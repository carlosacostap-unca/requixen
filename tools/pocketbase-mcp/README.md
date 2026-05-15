# PocketBase MCP para Requixen

Servidor MCP local para inspeccionar y administrar PocketBase durante el desarrollo de Requixen.

La app Next.js sigue usando API routes en runtime. Este MCP es para Codex/desarrollo: revisar colecciones, records, proyectos, usuarios y asignaciones.

## Instalacion

```powershell
cd C:\Proyectos\requixen\tools\pocketbase-mcp
npm install
```

## Variables

Configura estas variables en el cliente MCP/Codex:

```txt
POCKETBASE_URL=https://tu-pocketbase.example.com
POCKETBASE_ADMIN_EMAIL=admin@email.com
POCKETBASE_ADMIN_PASSWORD=tu_password
```

Tambien podes usar un token:

```txt
POCKETBASE_URL=https://tu-pocketbase.example.com
POCKETBASE_ADMIN_TOKEN=...
```

## Comando

```powershell
node C:\Proyectos\requixen\tools\pocketbase-mcp\server.js
```

## Tools

- `health`
- `list_collections`
- `get_collection`
- `list_records`
- `get_record`
- `create_record`
- `update_record`
- `list_requixen_projects`
- `assign_user_to_project`
- `check_project_visibility`

## Ejemplos

Revisar proyectos:

```txt
list_requixen_projects
```

Ver si un usuario puede ver un proyecto:

```txt
check_project_visibility(projectId, userId)
```

Asignar usuario:

```txt
assign_user_to_project(projectId, userId)
```
