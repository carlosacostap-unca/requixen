# Vectorizacion y RAG en Requixen

## Objetivo

Los archivos adjuntos de cada proyecto no deben quedar solo como objetos en PocketBase Storage. Para que la IA pueda usarlos como evidencia durante la elicitacion, Requixen incorpora una capa de indexacion semantica con Qdrant.

## Flujo implementado

1. El usuario adjunta un archivo en la sala de elicitacion de un proyecto.
2. Next.js sube el archivo a PocketBase Storage.
3. Si el archivo contiene texto legible, Requixen extrae el contenido.
4. El texto se divide en fragmentos.
5. Cada fragmento se convierte en embedding con OpenAI.
6. Los vectores se guardan en Qdrant con metadatos de proyecto, sesion, archivo y trazabilidad.
7. Cuando un usuario conversa con el Mediator, Requixen busca en Qdrant fragmentos relevantes del proyecto.
8. El Mediator recibe esos fragmentos como contexto recuperado antes de responder.

## Variables requeridas

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

QDRANT_URL=https://qdrant.tu-dominio.com
QDRANT_API_KEY=...
QDRANT_COLLECTION=requixen_document_chunks
```

## Alcance actual

En este corte, la extraccion de texto funciona para:

- Archivos textuales como `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.yaml` y otros `text/*`.
- PDF con texto nativo.
- DOCX.

Los PDF escaneados y las imagenes quedan almacenados en PocketBase, pero se marcan como pendientes de OCR o con error de extraccion. Esto evita que el sistema simule conocimiento que todavia no puede leer.

## Proximo paso recomendado

Agregar extractores para:

- Imagenes: OCR para notas, formularios o capturas.
- PDF escaneados: OCR por pagina.
- Auditoria de indexacion por documento, con opcion de reintentar.

Cuando esos extractores esten incorporados, el flujo de Qdrant no cambia: solo se reemplaza la etapa de extraccion de texto.
