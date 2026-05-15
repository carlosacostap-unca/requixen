# Integraciones: PocketBase y OpenAI

Este corte permite usar integraciones reales sin perder la demo local. Si las variables no estan configuradas, Requixen sigue funcionando con datos semilla.

## Variables de entorno

Configura manualmente `C:\Proyectos\requixen\.env.local`:

```txt
POCKETBASE_URL=https://tu-pocketbase.example.com
POCKETBASE_ADMIN_EMAIL=admin@tu-pocketbase.example.com
POCKETBASE_ADMIN_PASSWORD=...
POCKETBASE_USERS_COLLECTION=users
POCKETBASE_PROJECTS_COLLECTION=requixen_projects
POCKETBASE_AREAS_COLLECTION=requixen_areas
POCKETBASE_FILES_COLLECTION=requixen_files
POCKETBASE_ELICITATION_SESSIONS_COLLECTION=requixen_elicitation_sessions
POCKETBASE_ELICITATION_MESSAGES_COLLECTION=requixen_elicitation_messages
POCKETBASE_ELICITATION_CONTRIBUTIONS_COLLECTION=requixen_elicitation_contributions
POCKETBASE_CLARIFICATIONS_COLLECTION=requixen_clarifications
POCKETBASE_ARTIFACTS_COLLECTION=requixen_artifacts
POCKETBASE_RISKS_COLLECTION=requixen_risks
POCKETBASE_TRACES_COLLECTION=requixen_traces
POCKETBASE_AUDIT_COLLECTION=requixen_audit

OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_API_KEY` nunca se expone al cliente. La sala llama a `/api/elicitation/respond`, y esa ruta invoca OpenAI desde el servidor.

Despues de editar `.env.local`, reinicia el servidor de Next.js para que tome los cambios.

## Usuarios en PocketBase

El login usa la coleccion configurada en `POCKETBASE_USERS_COLLECTION`, por defecto `users`, y llama a:

```txt
/api/collections/users/auth-with-password
```

Campos recomendados en cada usuario:

- `email`
- `name`
- `role`: rol primario o activo inicial, uno de `admin`, `analyst`, `stakeholder`, `validator`
- `roles`: JSON array con todos los roles habilitados para ese usuario, por ejemplo `["admin", "analyst"]`
- `areaId`: id del area municipal a la que pertenece el usuario
- `organization`

Si `roles` no existe, la app usa `role` como fallback para mantener compatibilidad con usuarios ya creados. Para crear o editar usuarios multi-rol desde Requixen, agrega el campo `roles` en la coleccion `users`; si falta, PocketBase rechazara las operaciones que intenten guardar mas de un rol.

Para asignar areas a usuarios desde Requixen, agrega tambien `areaId` como campo texto en `users`. El nombre del area se resuelve desde la coleccion `requixen_areas`.

Cuando un usuario tiene mas de un rol, la barra superior muestra un selector de `Rol activo`. Ese selector cambia la experiencia y los permisos visibles de la interfaz sin cerrar sesion. El campo `role` queda como rol primario para compatibilidad y como valor inicial cuando el usuario inicia sesion.

## Coleccion de proyectos

La app espera una coleccion por defecto llamada `requixen_projects`.

Campos sugeridos:

- `name`: texto
- `domain`: texto
- `municipality`: texto
- `summary`: texto largo
- `transcript`: texto largo
- `stakeholders`: JSON o texto
- `status`: texto, con valores como `elicitation`, `analysis`, `negotiation`, `validation`
- `documents`: JSON
- `participants`: JSON
- `institutionalRequest`: JSON opcional con area solicitante, area receptora, accion solicitada, poblacion objetivo, referente, urgencia y plantilla.

Reglas sugeridas para empezar:

- List/View/Create: usuarios autenticados.
- Update/Delete: restringir luego por rol.

## OpenAI

La integracion usa la Responses API con el modelo definido en `OPENAI_MODEL`.

En la sala de elicitacion:

- El usuario envia un aporte.
- La ruta `/api/elicitation/respond` arma contexto del proyecto, rol, mensajes recientes y mensaje nuevo.
- OpenAI responde como `Mediator AI`.
- Si OpenAI no esta configurado o falla, la sala usa una respuesta local de respaldo.

## Estado actual

Ya esta implementado:

- Estado de integraciones visible en la pantalla de acceso.
- Login real contra PocketBase.
- Listado de proyectos desde PocketBase tras login real.
- Creacion de proyectos en PocketBase desde el intake.
- Respuesta real del Mediator con OpenAI en la sala de elicitacion.
- Fallback demo para seguir probando sin servicios externos.

## Modo real vs modo demo

Cuando `POCKETBASE_URL` esta configurado y el usuario ingresa con PocketBase, Requixen no mezcla datos semilla:

- La lista de proyectos sale solo de `requixen_projects`.
- La API filtra proyectos por `participants`: los usuarios no administradores solo ven proyectos donde esten asignados.
- Los administradores ven todos los proyectos para poder asignar equipos.
- Si PocketBase no devuelve proyectos asignados, la pantalla muestra estado vacio.
- Los runtimes de proyectos reales empiezan sin artefactos, riesgos, trazas, auditoria ni mensajes semilla.
- Las acciones que generan artefactos producen candidatos revisables y los persisten en las colecciones de workspace cuando el usuario tiene permisos.
- El Mediator solo responde si OpenAI esta configurado y la llamada funciona.
- Los archivos se suben a `requixen_files`.
- Los mensajes de elicitacion se intentan persistir en `requixen_elicitation_messages`.

El modo demo con datos artificiales queda disponible solamente cuando PocketBase no esta configurado.

## Asignacion de usuarios a proyectos

Cada proyecto debe tener un campo JSON llamado `participants`.

Formato esperado:

```json
[
  {
    "userId": "pb_user_id",
    "name": "Nombre Apellido",
    "email": "usuario@municipio.gob.ar",
    "role": "analyst"
  }
]
```

Roles validos:

```txt
admin
analyst
stakeholder
validator
```

Comportamiento actual:

- Al crear un proyecto desde Requixen, el usuario creador queda asignado automaticamente.
- Si el creador es `admin`, el intake incluye un paso para seleccionar usuarios del proyecto antes de crearlo.
- `admin` puede asignar o quitar usuarios desde la tarjeta de proyectos ya creados.
- `admin` puede abrir una pantalla separada de gestion de usuarios para crear, editar roles/nombre/email y eliminar cuentas.
- `stakeholder` y `validator` solo ven proyectos donde aparecen en `participants`.
- La ruta `/api/projects` filtra la visibilidad en el servidor.
- La ruta `/api/projects/{projectId}/participants` actualiza la asignacion.
- Las rutas `/api/users` y `/api/users/{userId}` usan credenciales admin de PocketBase del lado servidor, pero primero verifican que el usuario autenticado sea `admin`.

Para proyectos que ya existen en PocketBase, agregales `participants` desde el panel de PocketBase o entra como `admin` para asignarlos desde la app.

## Coleccion de areas municipales

La gestion de organigrama usa una Base collection llamada por defecto:

```txt
requixen_areas
```

Campos sugeridos:

- `name`: texto
- `code`: texto
- `description`: texto largo o texto
- `parentAreaId`: texto con el id del area padre, vacio si es area raiz

Reglas iniciales:

```txt
List/Search rule: @request.auth.id != ""
View rule:        @request.auth.id != ""
Create rule:      @request.auth.role = "admin"
Update rule:      @request.auth.role = "admin"
Delete rule:      @request.auth.role = "admin"
```

La relacion jerarquica se modela con `parentAreaId`. Esto permite representar direcciones, secretarias, departamentos o unidades operativas sin acoplar todavia el esquema a una implementacion especifica de organigrama.

En Requixen:

- `admin` puede abrir `Gestionar areas`.
- Puede crear areas raiz o areas hijas.
- En `Gestionar usuarios`, cada usuario puede quedar asociado a un area municipal.

## Solicitud institucional y plantillas

El intake de proyecto permite modelar como nace el pedido real dentro del municipio. Para el caso de Salud, el flujo esperado es:

```txt
Secretaria de Salud -> Direccion de Modernizacion -> Mediador IA -> Analista -> artefactos de requisitos
```

La ficha de solicitud se guarda en `project.institutionalRequest` y puede usar la plantilla `Relevamiento sanitario escolar`, pensada para describir una accion de relevamiento sanitario a alumnos de escuelas municipales. Esa metadata se incluye en el mensaje inicial del Mediador para que la conversacion arranque con el contexto institucional correcto.

Las plantillas se leen desde la coleccion configurable:

```txt
POCKETBASE_INSTITUTIONAL_TEMPLATES_COLLECTION=requixen_institutional_templates
```

Campos esperados:

- `templateId`: texto estable, por ejemplo `school-health-survey`
- `title`: texto
- `description`: texto largo
- `projectName`: texto
- `problem`: texto largo
- `institutionalRequest`: JSON
- `mediatorPrompt`: texto largo
- `blocks`: JSON con los bloques de entrevista
- `confirmationArea`: texto
- `active`: booleano

Para crear o actualizar la coleccion y sembrar las plantillas iniciales:

```bash
npm run seed:institutional-templates
```

El script hace upsert por `templateId`. Si la coleccion no existe todavia, ejecuta primero:

```bash
node tools/ensure-pocketbase-schema.mjs
```

Si PocketBase no tiene plantillas cargadas o la coleccion no esta disponible, Requixen usa las plantillas semilla locales como fallback.

Pendiente para el siguiente corte:

- Reglas de PocketBase mas finas por rol.
- Acciones de cierre de aclaraciones.
- Edicion manual de candidatos de requisitos antes de aprobar.

## Coleccion de mensajes de elicitacion

La ruta `/api/elicitation/messages` intenta guardar cada mensaje enviado y cada respuesta del Mediator en la coleccion configurada en `POCKETBASE_ELICITATION_MESSAGES_COLLECTION`.

Campos sugeridos:

- `projectId`: texto o relacion al proyecto
- `sessionId`: texto
- `authorName`: texto
- `authorRole`: texto
- `body`: texto largo
- `kind`: texto
- `timestamp`: texto

Si esta coleccion todavia no existe, la sala sigue funcionando en memoria local.

## Coleccion de sesiones de elicitacion

La sala usa una coleccion opcional llamada por defecto:

```txt
requixen_elicitation_sessions
```

Campos sugeridos:

- `projectId`: texto
- `sessionId`: texto
- `title`: texto
- `createdBy`: texto
- `deleted`: booleano
- `createdAt`: texto
- `updatedAt`: texto

Si esta coleccion no existe, Requixen reconstruye sesiones desde mensajes persistidos y conserva compatibilidad con eventos legacy `session-meta`.

## Coleccion de aportes detectados

Los aportes detectados en la sala pueden persistirse en:

```txt
requixen_elicitation_contributions
```

Campos sugeridos:

- `projectId`: texto
- `sessionId`: texto
- `sourceMessageId`: texto
- `authorName`: texto
- `authorRole`: texto
- `body`: texto largo
- `kind`: texto, con valores `need`, `constraint`, `question`, `synthesis`, `risk-note`
- `confidence`: numero
- `timestamp_`: texto

Si la coleccion no existe, la UI sigue mostrando aportes reconstruidos de forma deterministica desde los mensajes.

## Coleccion de aclaraciones

Las preguntas de aclaracion y sus respuestas pueden persistirse en:

```txt
requixen_clarifications
```

Campos sugeridos:

- `projectId`: texto
- `sessionId`: texto
- `question`: texto largo
- `targetUserId`: texto
- `targetName`: texto
- `requestedBy`: texto
- `requestedByName`: texto
- `status`: texto, con valores `draft`, `sent`, `answered`, `closed`
- `response`: texto largo
- `respondedBy`: texto
- `respondedByName`: texto
- `sentAt`: texto
- `respondedAt`: texto

Si esta coleccion no existe, Requixen conserva compatibilidad con eventos legacy `clarification-request` y `clarification-response` guardados como mensajes.

En la sala del analista, las aclaraciones respondidas pueden cerrarse (`status: closed`) o convertirse en un candidato de requisito editable. Al convertir una respuesta, Requixen crea un artefacto de la capa `mediator` con la respuesta como fuente y trazabilidad hacia la aclaracion.

## Colecciones de artefactos, riesgos, trazas y auditoria

Los productos de las capas de Requixen se cargan desde `/api/workspace/runtime` y se guardan por capa cuando un usuario con permisos genera candidatos o cambia estados de aprobacion.

Colecciones por defecto:

```txt
requixen_artifacts
requixen_risks
requixen_traces
requixen_audit
```

Campos sugeridos para `requixen_artifacts`:

- `projectId`: texto
- `artifactId`: texto
- `layerId`: texto, con valores `mediator`, `cocreator`, `facilitator`, `assistant`
- `title`: texto
- `type`: texto
- `body`: texto largo
- `status`: texto, con valores `draft`, `proposed`, `approved`, `needs-review`
- `confidence`: numero
- `source`: texto largo
- `generatedBy`: texto
- `assumptions`: texto largo

Campos sugeridos para `requixen_risks`:

- `projectId`: texto
- `riskId`: texto
- `artifactId`: texto
- `layerId`: texto
- `kind`: texto
- `label`: texto
- `detail`: texto largo
- `severity`: texto
- `confidence`: numero

Campos sugeridos para `requixen_traces`:

- `projectId`: texto
- `traceId`: texto
- `layerId`: texto
- `fromArtifactId`: texto
- `fromEvidenceId`: texto
- `fromLabel`: texto
- `toArtifactId`: texto
- `relation`: texto

Campos sugeridos para `requixen_audit`:

- `projectId`: texto
- `auditId`: texto
- `layerId`: texto
- `timestamp`: texto
- `action`: texto largo
- `actor`: texto

El servidor verifica acceso al proyecto antes de leer o escribir runtime de workspace. Para reemplazar una capa, borra los records anteriores de esa capa con credenciales administrativas del servidor y vuelve a insertar el corte actual.

## Coleccion de archivos

La subida de archivos usa PocketBase Storage mediante records con `multipart/form-data`. Crea una Base collection:

```txt
requixen_files
```

Campos sugeridos:

- `name`: texto
- `mimeType`: texto
- `size`: numero
- `projectId`: texto
- `sessionId`: texto
- `origin`: texto
- `uploadedBy`: texto
- `file`: file

Configura el campo `file` con el tamano maximo que necesites. Para documentos municipales, conviene empezar con un limite moderado y subirlo cuando tengas claro el peso de PDFs, audios o imagenes.

Reglas iniciales:

```txt
List/Search rule: @request.auth.id != ""
View rule:        @request.auth.id != ""
Create rule:      @request.auth.id != ""
Update rule:      @request.auth.role = "admin" || @request.auth.role = "analyst"
Delete rule:      @request.auth.role = "admin"
```

En la version actual:

- Los archivos del intake se suben a esta coleccion antes de crear el proyecto.
- Los adjuntos de la sala se suben con `projectId` y `sessionId`.
- Requixen guarda en memoria local la URL devuelta por PocketBase para usarla como fuente.
- Si PocketBase Storage falla, la UI conserva un fallback local con nombre, tipo y tamano.

PocketBase indica que los archivos se suben desde la Records API usando `multipart/form-data`, y que las URLs siguen el formato `/api/files/{collection}/{recordId}/{filename}`.
