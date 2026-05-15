# Sistema de diseno Requixen

Este sistema de diseno define la identidad visual operativa de Requixen. La app debe sentirse como una herramienta profesional de ingenieria de requisitos para gobierno digital: sobria, densa, clara y preparada para trabajo colaborativo.

## Principios

- `Operativo antes que promocional`: la primera pantalla debe permitir trabajar, no vender la herramienta.
- `Confianza visible`: estados, roles, fuentes, riesgos y trazabilidad deben ser faciles de reconocer.
- `Densidad amable`: mostrar bastante informacion sin caer en dashboard complejo cuando el usuario necesita conversar.
- `IA mediada`: la interfaz debe diferenciar aportes humanos, respuesta del Mediator y artefactos derivados.
- `Gobierno digital`: tono institucional moderno, con contraste alto, pocos adornos y controles previsibles.

## Tokens

Los tokens viven en `app/globals.css`.

- `--rx-bg`: fondo general de la aplicacion.
- `--rx-surface`: superficie principal para cards, panels y formularios.
- `--rx-surface-soft`: superficie secundaria para areas de trabajo.
- `--rx-surface-muted`: chips, badges y estados neutros.
- `--rx-ink`: texto principal.
- `--rx-muted`: texto secundario.
- `--rx-border`: borde estandar.
- `--rx-primary`: accion primaria y mensajes del usuario.
- `--rx-accent`: foco, seleccion y detalles interactivos.
- `--rx-success`, `--rx-warning`, `--rx-danger`: estados semanticos.

## Componentes base

Clases globales disponibles:

- `requixen-app`: fondo general con textura sutil y paleta del producto.
- `rx-topbar`: barra superior persistente con efecto translucido.
- `rx-brand` y `rx-brand-mark`: identificacion compacta de Requixen.
- `rx-card`: contenedor de superficie.
- `rx-card-interactive`: card clickeable o seleccionable.
- `rx-room-shell`: contenedor principal de salas conversacionales.
- `rx-message-author`: burbuja de mensaje humano.
- `rx-message-ai`: burbuja de mensaje del Mediator.

## Reglas de uso

- Usar `rx-card` para items repetidos, formularios, paneles y modales.
- Evitar cards dentro de cards salvo elementos realmente repetidos.
- Usar botones primarios oscuros para acciones principales: ingresar, crear, enviar, abrir fase.
- Usar botones secundarios con borde para navegacion, volver, adjuntar, voz y acciones auxiliares.
- Mantener radios de 8px o menos.
- Mantener encabezados compactos en herramientas; reservar texto grande para pantallas de entrada o intake.
- En la sala de elicitacion, priorizar conversacion y contexto vivo sobre tableros administrativos.

## Accesibilidad

- Todos los controles heredan foco visible mediante `--rx-ring`.
- El contraste principal usa texto `--rx-ink` sobre `--rx-surface`.
- Los estados no deben depender solo de color; cuando sea posible, acompanar con texto de estado.

## Extension

Cuando se agreguen fases 2, 3 y 4 como pantallas reales, reutilizar:

- `rx-room-shell` si la fase ocurre como conversacion mediada.
- `rx-card` para matrices, reportes, criterios, flags y artefactos.
- Tokens semanticos para riesgos y validacion.

No crear paletas por pantalla. Cada rol puede tener acentos sutiles, pero la identidad principal debe seguir siendo Requixen.
