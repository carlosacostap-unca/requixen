# Flujos del modelo Requixen

Este documento explica que representa cada capa de la aplicacion y como se espera que se use.

## Vista general

Requixen implementa un pipeline de Early Requirements Engineering mediado por GenAI:

```txt
Elicitation -> Analysis -> Negotiation -> Early Validation
```

Sobre ese pipeline opera una capa transversal:

```txt
Risk Management
```

La idea central es que la IA no tiene el mismo rol en todas las fases. Su autonomia disminuye a medida que el proceso se acerca a decisiones mas comprometidas.

## Autenticacion y roles

El MVP incorpora autenticacion simulada mediante perfiles demo. No hay password ni backend real todavia.

Los roles contemplados son:

- `Administrador`: administra la herramienta y tiene acceso completo.
- `Analista RE`: responsable principal del proceso Early RE; crea proyectos, genera artefactos y aprueba salidas.
- `Stakeholder`: aporta conocimiento de dominio y participa en elicitation/negotiation, pero no aprueba artefactos.
- `Validador`: revisa validacion temprana, trazabilidad y riesgos.

La relacion con el modelo es intencional:

- Mediator requiere participacion de stakeholders, pero supervision del analista.
- Co-creator requiere control compartido y aprobacion del analista.
- Facilitator presenta opciones, pero las decisiones siguen siendo humanas.
- Assistant ejecuta validaciones bajo direccion y con foco en trazabilidad.

En esta version, los permisos se aplican sobre acciones principales: crear proyectos, generar artefactos, aprobar artefactos, ejecutar validacion, ver riesgos y gestionar usuarios.

Ademas, cada rol tiene una pantalla inicial diferente:

- El Administrador entra a un centro de gobierno del prototipo.
- El Analista RE entra a una mesa de trabajo para iniciar y conducir proyectos.
- El Stakeholder entra a una sala de participacion orientada a contexto y negociacion.
- El Validador entra a una cabina de validacion enfocada en trazabilidad y riesgos.

Esta diferenciacion de UX refuerza la idea del modelo: la herramienta no presenta la misma experiencia a todos los actores, porque cada actor interviene con responsabilidades distintas.

## Flujo previo: seleccion o creacion de proyecto

Antes de entrar al pipeline, el analista elige un proyecto existente o crea uno nuevo.

La creacion de proyecto funciona como un intake guiado:

- El analista define nombre, organismo, problema inicial y actores.
- Puede adjuntar archivos relacionados al proyecto.
- Avanza por una interfaz tipo Typeform, con una pregunta principal por paso.
- Puede conversar con un Mediator simulado en un panel lateral para agregar contexto.
- La app produce un brief inicial que luego alimenta `Elicitation`.

Este flujo todavia no pertenece a una fase clasica de Early RE como artefacto final. Es una preparacion del contexto de trabajo para que el pipeline arranque con fuentes, actores y problema inicial minimamente explicitados.

Al abrir un proyecto, Requixen muestra primero una pantalla de fases del modelo. En esta iteracion solamente esta habilitada la fase `Mediator - Elicitation`; las otras fases quedan visibles para mostrar el recorrido completo y preparar su activacion posterior.

## 1. Mediator - Elicitation

### Proposito

Ayudar a convertir lenguaje informal de stakeholders en candidatos iniciales de requisitos.

En el MVP, esta fase se representa como una sala colaborativa. La elicitacion no ocurre solamente entre analista e IA, sino entre los usuarios que deberian intervenir: analista, stakeholders, validadores y, de forma transversal, el Mediator AI.

### Entrada

- Entrevistas.
- Transcripciones.
- Documentos iniciales.
- Expresiones informales o burocraticas de actores no tecnicos.

### Salida esperada

- Raw requirements.
- Glosario de dominio.
- Preguntas de clarificacion.
- Necesidades implicitas detectadas.

### Control humano

Alto grado de autonomia de IA con revision posterior.

Esto significa que la IA puede proponer varios candidatos sin pedir aprobacion en cada microaccion, pero el analista debe revisarlos despues.

### En la demo

La pantalla de `Mediator` muestra una sala conversacional por proyecto:

- Historial de chats propio del proyecto.
- Conversacion activa con el Mediator AI.
- Adjuntos y entrada de voz.
- Contexto rapido para entender lo que otros usuarios aportaron en paralelo.
- Bandeja de contexto vivo con aportes detectados, fuentes, preguntas abiertas y confianza simulada.
- Acciones de curaduria solo para roles internos, como preparar candidatos o pedir aclaraciones.

Cada rol ve la sala con un foco distinto:

- El Analista RE usa la misma sala conversacional por proyecto, con permisos extra como sintetizar con Mediator.
- El Stakeholder usa la sala conversacional simple, asistida por IA, para contar necesidades, excepciones y vocabulario del dominio.
- Cada proyecto tiene su propia sala de elicitacion con multiples chats, historial, mensajes y adjuntos. Las conversaciones no se mezclan entre proyectos.
- Como varios usuarios pueden participar en paralelo, el stakeholder puede usar `Ponerme en contexto` para recuperar rapidamente el estado de la sala antes de aportar.
- El Validador revisa conversaciones, riesgos tempranos y trazabilidad insuficiente dentro de la misma sala.
- El Administrador observa cobertura de participacion e historial de la sala.

La deteccion de aportes sigue siendo deterministica en el MVP. Sirve para validar la UX antes de conectar un LLM real: el sistema toma contribuciones, las etiqueta como necesidad, restriccion, pregunta, sintesis o nota de riesgo, y les asigna una confianza simulada.

Al generar artefactos de esta capa aparecen:

- `REQ-01`: registrar reclamos de infraestructura.
- `REQ-02`: notificar a Obras Publicas.
- `REQ-03`: seguir estado de resolucion.
- `REQ-04`: permitir consulta de estado por ciudadanos.
- Entrada de glosario para `Complaint`.
- Pregunta sobre adjuntar fotografias.

El punto pedagogico clave es `REQ-04`: parece razonable, pero es una inferencia. Por eso la capa de riesgo lo marca.

## 2. Co-creator - Analysis

### Proposito

Construir artefactos mas estructurados junto con el analista.

### Entrada

- Raw requirements.
- Glosario.
- Preguntas y aclaraciones de elicitation.

### Salida esperada

- User stories.
- Acceptance criteria.
- Ambiguity flags.
- Gap reports.
- Candidatos de modelos de dominio.

### Control humano

Control compartido con aprobacion por artefacto.

La IA propone, pero el analista decide que aceptar.

### En la demo

Al generar esta capa aparecen:

- Una user story para el ciudadano que registra un reclamo.
- Criterios de aceptacion para el formulario y la notificacion.
- Una ambiguity flag sobre el canal de notificacion.
- Un gap report sobre priorizacion, tiempos de respuesta y escalamiento.

El punto pedagogico clave es que la IA empieza a estructurar, pero tambien debe dejar visibles las ambiguedades que descubre.

## 3. Facilitator - Negotiation

### Proposito

Ayudar a negociar conflictos sin tomar decisiones por los stakeholders.

### Entrada

- Artefactos aprobados.
- Prioridades de stakeholders.
- Conflictos o gaps detectados.

### Salida esperada

- Matriz de conflictos.
- Analisis de trade-offs.
- Opciones neutrales de resolucion.
- Propuestas de compromiso.
- Requisitos acordados.

### Control humano

Modo asesor: la IA no decide.

Los stakeholders y el analista conservan la decision final.

### En la demo

Se muestra un conflicto:

- Obras Publicas quiere priorizar por severidad.
- Atencion Ciudadana quiere procesar por orden cronologico.

La IA simulada presenta tres opciones:

- Severidad.
- Orden cronologico.
- Hibrido.

El acuerdo generado usa el enfoque hibrido: los casos criticos se priorizan y los demas siguen orden cronologico.

## 4. Assistant - Early Validation

### Proposito

Ejecutar verificaciones sistematicas bajo direccion explicita del analista.

### Entrada

- Requisitos acordados.
- User stories.
- Acceptance criteria.
- Gaps y decisiones previas.
- Metadatos de trazabilidad.

### Salida esperada

- Validation report.
- Traceability matrix.
- Issue list.
- Residual ambiguity flags.

### Control humano

Control humano completo.

La IA solo ejecuta checks solicitados; no deberia introducir nuevos compromisos funcionales por iniciativa propia.

### En la demo

La validacion detecta:

- `REQ-03` no tiene user story correspondiente.
- Los criterios de foto no definen tamano maximo ni formatos.
- El mecanismo de notificacion sigue indefinido.
- Faltan requisitos no funcionales como performance, disponibilidad y accesibilidad.

## Capa transversal: Risk Management

### Proposito

Monitorear riesgos introducidos por IA en todas las capas.

### Riesgos representados

- Hallucinated requirements: requisitos plausibles pero no expresados por stakeholders.
- Domain bias: supuestos genericos que pueden no aplicar al municipio real.
- Context loss: perdida de coherencia en sesiones largas.
- Traceability fabrication: relaciones de trazabilidad que parecen validas pero no estan justificadas.

### En la demo

Cada riesgo se adjunta a un artefacto concreto y conserva:

- Capa de origen.
- Tipo de riesgo.
- Severidad.
- Score de confianza.
- Explicacion breve.

## Flujo recomendado para una demostracion oral

1. Mostrar la pantalla de proyectos y explicar que el analista controla el inicio del trabajo.
2. Crear un proyecto nuevo con el chat de intake y adjuntar uno o dos archivos de ejemplo.
3. Abrir el workspace del proyecto creado.
4. Ejecutar Mediator y mostrar como aparecen requisitos crudos.
5. Detenerse en `REQ-04` para explicar riesgo de alucinacion o inferencia no confirmada.
6. Ejecutar Co-creator y mostrar user story, acceptance criteria, ambiguity flag y gap report.
7. Ejecutar Facilitator y explicar que la IA no decide, solo presenta opciones.
8. Ejecutar Assistant y mostrar que validacion es mas restrictiva y orientada a checks.
9. Cerrar mostrando trazabilidad y auditoria como base para futura persistencia en PocketBase.

## Relacion con futuras integraciones

La app ya separa:

- Tipos del dominio.
- Datos semilla.
- Diccionario bilingue.
- Adaptador de IA simulada.
- Seleccion local de proyectos.
- Intake conversacional simulado con adjuntos.
- Workspace interactivo.

En una version posterior, el adaptador simulado puede reemplazarse por llamadas a un proveedor LLM y los arrays locales pueden migrarse a colecciones PocketBase.
