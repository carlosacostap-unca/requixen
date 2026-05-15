# Guia de uso de Requixen MVP

## 1. Abrir la aplicacion

La aplicacion corre en:

```txt
http://localhost:3000
```

Al abrirla vas a ver primero una pantalla de proyectos, no una landing page. Desde ahi podes:

- Ingresar con un perfil demo.
- Abrir un proyecto existente.
- Crear un nuevo proyecto mediante un intake asistido.
- Cambiar el idioma principal de la interfaz.

Cuando abris un proyecto, la primera pantalla es la sala de elicitacion de ese proyecto. La app evita el formato dashboard en esta etapa para que todos los roles trabajen desde una experiencia conversacional compartida.

## 2. Ingresar

La primera pantalla permite ingresar con usuarios reales de PocketBase si `C:\Proyectos\requixen\.env.local` esta configurado. Los perfiles demo quedan como apoyo para validar rapido como cambian permisos y experiencia segun rol.

Perfiles disponibles:

- `Administrador`: acceso completo, incluyendo configuracion futura de usuarios.
- `Analista RE`: rol principal del flujo; crea proyectos, genera artefactos y aprueba salidas.
- `Stakeholder`: participa como fuente de conocimiento y negociacion; puede ver riesgos, pero no aprobar artefactos.
- `Validador`: se enfoca en validacion temprana, trazabilidad y riesgos; no crea proyectos.

Una vez elegido el perfil, la app muestra el usuario actual y su rol en la barra superior.

Algunos usuarios pueden tener mas de un rol. En ese caso, la barra superior muestra un selector de rol activo para cambiar de experiencia sin cerrar sesion. Por ejemplo, una misma cuenta puede operar como `Administrador` para gestionar usuarios y luego cambiar a `Analista RE` para trabajar el flujo de requisitos.

Cada rol tiene una home distinta despues del login:

- `Administrador`: ve una vista de gobierno del prototipo, con foco en roles, permisos y preparacion para persistencia real.
- `Analista RE`: ve una mesa de trabajo orientada a crear proyectos, conducir intake y aprobar artefactos.
- `Stakeholder`: ve una sala de participacion enfocada en revisar contexto, aportar aclaraciones y observar negociacion.
- `Validador`: ve una cabina de validacion centrada en trazabilidad, riesgos y checks permitidos.

Estas pantallas no son solo cosmeticas: tambien muestran acciones recomendadas y permisos habilitados para cada rol.

## 3. Cambiar idioma

En la parte superior de la aplicacion hay un selector `ES / EN`.

El idioma por defecto es espanol porque el caso de validacion esta situado en un contexto municipal argentino. El selector cambia los textos principales de la interfaz; los artefactos de ejemplo se mantienen mayormente en ingles porque vienen del paper usado como caso base.

## 4. Elegir un proyecto existente

La pantalla inicial lista proyectos disponibles. Cada tarjeta muestra:

- Nombre del proyecto.
- Estado actual del flujo.
- Resumen del problema.
- Organismo o area.
- Cantidad de archivos asociados.
- Ultima actividad.

Presiona `Abrir proyecto` para entrar a la pantalla de fases del proyecto.

Por ahora, la pantalla de fases muestra las cuatro capas del modelo y habilita solamente la fase 1:

- `Elicitation: Mediator`

Desde esa tarjeta podes entrar a la sala de elicitacion del proyecto. Las fases de Analysis, Negotiation y Validation quedan visibles como proximas etapas, pero todavia no se abren en el flujo real.

## 5. Crear un nuevo proyecto

Presiona `Crear proyecto` para iniciar el intake asistido.

La creacion esta pensada para que la haga el analista. En esta etapa Requixen actua como `Mediator`: ayuda a capturar contexto inicial, no a decidir requisitos finales.

Si ingresaste como `Stakeholder` o `Validador`, la accion aparece restringida.

La pantalla de creacion ahora funciona como un flujo tipo Typeform:

- Una pregunta principal por paso.
- Barra de progreso.
- Navegacion `Anterior / Siguiente`.
- Paso propio para adjuntar archivos.
- Paso final de revision del brief.
- Chat del Mediator como acompanamiento lateral.

Los pasos son:

1. Nombre del proyecto.
2. Organismo o area participante.
3. Problema inicial.
4. Stakeholders o actores considerados.
5. Archivos iniciales.
6. Revision del brief.

### Adjuntar archivos

Podes adjuntar varios archivos desde el selector de archivos. En este MVP no se lee el contenido real de los archivos; se registra su nombre, tipo y tamano para simular que seran fuentes iniciales del proyecto.

En una version posterior, esos archivos deberian persistirse en PocketBase y pasar por extraccion de texto, clasificacion y analisis de trazabilidad.

### Usar el chat lateral

El chat lateral permite agregar contexto libre sin interrumpir el paso principal. Por ejemplo:

```txt
El area de habilitaciones comerciales recibe expedientes incompletos y no puede informar claramente el estado del tramite.
```

La respuesta del Mediator es simulada. Su funcion actual es mostrar como seria el acompanamiento conversacional antes de entrar al flujo por capas.

### Iniciar workspace

Cuando el brief este suficientemente claro, presiona `Iniciar workspace`.

La aplicacion crea el proyecto y abre la pantalla de fases. Desde ahi se ingresa a `Elicitation: Mediator`.

## 6. Entender el caso semilla

El MVP carga un caso fijo:

```txt
Citizen complaint management system
```

Representa la modernizacion de un proceso municipal manual para reclamos de infraestructura, por ejemplo baches o luminarias rotas.

El transcript fuente dice, en sintesis:

- Hoy se completa un formulario en papel.
- El formulario se lleva a Obras Publicas.
- A veces pasan semanas sin novedades.
- El ciudadano vuelve a llamar para preguntar el estado.
- El area de atencion no tiene forma clara de responder.

Este transcript es la fuente primaria para generar los primeros artefactos.

Tambien hay un segundo proyecto semilla para mostrar que la app ya soporta una lista de proyectos, aunque todavia sin persistencia real.

## 7. Recorrer el flujo principal

El flujo recomendado es avanzar de arriba hacia abajo por el sidebar:

1. `Elicitation: Mediator`
2. `Analysis: Co-creator`
3. `Negotiation: Facilitator`
4. `Early Validation: Assistant`

En cada capa:

1. Selecciona la capa en el sidebar.
2. Lee el rol, control humano, entrada y salida esperada.
3. Presiona `Generar artefactos`.
4. Revisa los artefactos generados.
5. Aprueba los artefactos que quieras conservar con `Aprobar`.
6. Mira el panel derecho para ver riesgos, trazabilidad y auditoria.

Los permisos afectan el flujo:

- Administrador y Analista RE pueden generar artefactos en todas las capas.
- Stakeholder puede navegar y revisar, pero no generar ni aprobar.
- Validador se restringe al foco de validacion; puede revisar riesgos y trazabilidad, pero no crear proyectos.

### Elicitation como sala colaborativa

La primera capa, `Elicitation: Mediator`, tiene una pantalla distinta al resto.

En vez de ser solo una lista de artefactos, funciona como una sala compartida:

- Cada usuario puede agregar aportes de elicitacion segun su rol.
- Los aportes quedan visibles para los demas usuarios del proyecto mientras no se recargue la pagina.
- La IA Mediator puede sintetizar lo aportado y sugerir candidatos o preguntas.
- Los artefactos generados siguen estando disponibles, pero pasan a ser una salida de la conversacion compartida.

La experiencia conserva permisos por rol, pero la pantalla de entrada al proyecto ahora es la misma sala enfocada para todos:

- `Analista RE`: conversa en la sala del proyecto y puede pedir sintesis al Mediator.
- `Stakeholder`: cuenta como funciona su proceso sin usar lenguaje tecnico.
- `Validador`: conversa o revisa el contexto de la sala con foco en fuentes e inferencias.
- `Administrador`: observa participacion e historial desde la misma sala.

La pantalla evita por completo el formato dashboard para todos los roles. Al abrir un proyecto solo se ve la sala de elicitacion del proyecto, con una experiencia parecida a ChatGPT:

- Historial de chats propio de ese proyecto.
- Boton `Nuevo chat`.
- Conversacion activa con mensajes del stakeholder y del Mediator.
- Adjuntos por conversacion.
- Boton de voz si el navegador soporta Web Speech API.
- Campo de mensaje simple para contar el proceso en lenguaje natural.
- Boton `Ponerme en contexto` para ver un resumen rapido del proyecto, participacion paralela, aportes recientes de otros usuarios y fuentes de la sala.
- Bandeja de contexto vivo dentro de la sala, con chats, aportes, fuentes y aportes detectados por la IA simulada.
- Acciones extra dentro de la sala cuando el rol tiene permiso, por ejemplo `Sintetizar con Mediator` o `Preparar candidatos`.

La bandeja lateral cambia segun el rol:

- `Stakeholder`: ve contexto util y aportes detectados sin controles tecnicos.
- `Analista RE`: ve aportes detectados, cola de atencion y acciones para preparar candidatos de requisito.
- `Validador`: ve preguntas abiertas, riesgos tempranos y fuentes que conviene confirmar.
- `Administrador`: ve cobertura de participacion, actividad y controles de supervision.

Cada proyecto tiene su propia sala e historial. Si abris otro proyecto, sus chats son distintos y no se mezclan.

Para probarlo: entra como `Stakeholder`, abre un proyecto, crea un chat o envia un mensaje en `Elicitation`, sal con `Salir`, entra como `Analista RE` y abre el mismo proyecto. Vas a ver el aporte en el tablero compartido y el historico de chats de esa sala.

## 8. Aprobar o revisar artefactos

Cada artefacto tiene un estado:

- `Borrador`: salida inicial, especialmente en elicitation.
- `Propuesto`: salida generada por la IA simulada para revision.
- `Aprobado`: el analista lo acepta como parte del flujo.
- `Requiere revision`: el artefacto fue reabierto o marcado para nueva revision.

El boton cambia segun el estado:

- `Aprobar`: acepta el artefacto.
- `Revisar`: reabre un artefacto aprobado.

Cada accion queda registrada en la auditoria.

## 9. Leer la capa de riesgo

El panel derecho muestra flags generados por la capa transversal de Risk Management.

Cada riesgo incluye:

- Tipo de riesgo: por ejemplo hallucination, domain-bias, context-loss o traceability.
- Severidad: low, medium o high.
- Detalle: por que se marco el riesgo.
- Score: confianza asociada al flag.

Ejemplo importante:

`REQ-04` se marca como posible inferencia porque el stakeholder dijo que los ciudadanos llaman para preguntar el estado, pero no pidio explicitamente una consulta self-service.

## 10. Leer la trazabilidad

La seccion de trazabilidad muestra relaciones entre artefactos.

Ejemplos:

- `REQ-01` se refina en una user story.
- `REQ-02` dispara una ambiguity flag.
- Un gap report puede disparar un conflicto de negociacion.
- Un acuerdo puede alimentar el validation report.

En esta version, la trazabilidad es una candidata generada por la simulacion. En una version productiva deberia ser revisada y aprobada por el analista.

## 11. Leer la auditoria

La auditoria registra acciones relevantes:

- Carga inicial del proyecto.
- Generacion de artefactos por capa.
- Flags agregados por la capa de riesgo.
- Aprobaciones y reaperturas hechas por el analista.

Sirve para mostrar la idea central del modelo: cada artefacto debe conservar proveniencia, capa de origen y decisiones humanas asociadas.

## 12. Volver a proyectos

Dentro del workspace, el boton `Volver a proyectos` te lleva nuevamente a la lista inicial sin perder el estado local de los proyectos mientras no recargues la pagina.

## 13. Reiniciar la demo

El boton `Reiniciar demo` limpia artefactos, riesgos, trazabilidad y auditoria del proyecto abierto, y vuelve a la primera capa.

Usalo si queres repetir el recorrido desde cero.

## 14. Limitaciones actuales

Este MVP no:

- Lee el contenido real de los archivos adjuntos.
- Persiste todavia todo el runtime de artefactos, riesgos, trazabilidad y auditoria.
- Persiste sesiones de chat de forma parcial: intenta guardar mensajes, pero la reconstruccion completa del historial desde PocketBase queda para el siguiente corte.
- Ejecuta analisis semantico completo sobre archivos adjuntos.
- Habilita todavia las fases 2, 3 y 4 como pantallas operativas reales.

Los proyectos, usuarios, asignaciones, archivos y mensajes pueden usar PocketBase cuando las colecciones estan configuradas. El estado fino de la sala y de los artefactos sigue dependiendo parcialmente de memoria local del navegador.
