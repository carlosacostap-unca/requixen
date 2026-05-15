# Requixen - Documentacion de uso

Esta carpeta explica como usar el MVP actual de Requixen.

La aplicacion es una demo funcional basada en el modelo por capas del paper. Ya puede conectarse con PocketBase y OpenAI cuando `.env.local` esta configurado; en ausencia de esas integraciones conserva un modo demo para validar la experiencia.

## Documentos

- [Guia de uso](./guia-de-uso.md): recorrido paso a paso por la interfaz.
- [Flujos del modelo](./flujos-del-modelo.md): explicacion de cada capa, sus entradas, salidas y decisiones esperadas.
- [Integraciones](./integraciones.md): configuracion de `.env.local`, PocketBase y OpenAI.
- [Sistema de diseno](./sistema-de-diseno.md): tokens, principios visuales y componentes base.
- [Vision de flujos y pantallas](./vision-flujos-y-pantallas.md): propuesta de producto para pantallas, roles y evolucion del MVP.
- [Caso de uso ejemplo](./caso-de-uso-ejemplo.md): recorrido narrativo completo para un sistema municipal de reclamos ciudadanos.

## Objetivo del MVP

El objetivo de esta version es validar la experiencia de uso del modelo Requixen:

- Diferenciar el rol de GenAI por fase de Early Requirements Engineering.
- Permitir al analista elegir proyectos existentes o crear uno nuevo mediante un intake guiado tipo chat.
- Registrar archivos iniciales como fuentes de contexto para el proyecto.
- Usar autenticacion real con PocketBase y roles por usuario, con modo demo como respaldo.
- Probar una sala de elicitacion por proyecto con historiales, contexto vivo y aportes detectados por IA simulada.
- Mostrar como los artefactos fluyen entre elicitation, analysis, negotiation y early validation.
- Hacer visible la capa transversal de riesgo, confianza, trazabilidad y auditoria.
- Dejar contratos internos preparados para profundizar la integracion con PocketBase, storage y proveedores LLM.
