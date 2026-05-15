import type { InstitutionalInterviewTemplate } from "./types";

export const defaultInstitutionalInterviewTemplates: InstitutionalInterviewTemplate[] = [
  {
    id: "school-health-survey",
    title: "Relevamiento sanitario escolar",
    description:
      "Para el caso donde Salud solicita a Modernizacion soporte para relevar informacion sanitaria de alumnos.",
    projectName: "Relevamiento sanitario escolar municipal",
    problem:
      "La Secretaria de Salud solicita soporte a Modernizacion para relevar informacion sanitaria de alumnos de escuelas municipales y organizar el proceso, la carga de datos, las autorizaciones y los reportes esperados.",
    institutionalRequest: {
      templateId: "school-health-survey",
      templateName: "Relevamiento sanitario escolar",
      requestingArea: "Secretaria de Salud",
      receivingArea: "Direccion de Modernizacion",
      contactPerson: "Referente de Salud",
      requestedAction: "Llevar a cabo una accion de relevamiento sanitario a alumnos de escuelas municipales.",
      targetPopulation: "Alumnos de escuelas municipales",
      urgency: "medium",
    },
    mediatorPrompt:
      "La Secretaria de Salud necesita describir a un Mediador IA una accion de relevamiento sanitario escolar. Guiar la conversacion para entender objetivo sanitario, alumnos alcanzados, escuelas, datos a relevar, autorizaciones, responsables de carga, cronograma, reportes esperados, restricciones de privacidad y criterios de exito.",
    confirmationArea: "Salud",
    active: true,
    blocks: [
      {
        id: "objective",
        title: "Objetivo sanitario",
        goal: "Entender para que se hace el relevamiento y que decision deberia habilitar.",
        prompt:
          "Mediador, ayudame a precisar el objetivo sanitario del relevamiento escolar. Preguntame que problema queremos detectar, que decision espera tomar Salud y como sabremos que el relevamiento fue util.",
        questions: [
          "Que problema sanitario o necesidad concreta motiva el relevamiento?",
          "Que decision espera tomar la Secretaria de Salud con los resultados?",
          "Hay indicadores minimos que el relevamiento debe producir?",
        ],
        summaryLabel: "Objetivo sanitario",
        pendingText: "Pendiente de precisar con Salud.",
        keywords: ["objetivo", "problema", "detectar", "decision", "indicador"],
      },
      {
        id: "population",
        title: "Alumnos y escuelas",
        goal: "Delimitar alcance, establecimientos, cursos, edades y criterios de inclusion.",
        prompt:
          "Mediador, guiame para delimitar poblacion y alcance: escuelas municipales, cursos, edades, criterios de inclusion/exclusion y volumen aproximado de alumnos.",
        questions: [
          "Que escuelas municipales entran en esta primera etapa?",
          "Que cursos, edades o grupos de alumnos deben relevarse?",
          "Hay casos que deban quedar fuera o tratarse por separado?",
        ],
        summaryLabel: "Alcance escolar",
        pendingText: "Pendiente de definir escuelas, cursos y volumen.",
        keywords: ["escuela", "alumno", "curso", "edad", "grado", "poblacion"],
      },
      {
        id: "data",
        title: "Datos a relevar",
        goal: "Separar datos necesarios, datos sensibles y evidencia que debe quedar respaldada.",
        prompt:
          "Mediador, ayudame a listar los datos que Salud necesita relevar, separando datos personales, datos sanitarios, observaciones, adjuntos y campos que no deberian pedirse por privacidad.",
        questions: [
          "Que datos identificatorios son indispensables?",
          "Que variables sanitarias se necesitan y cuales son opcionales?",
          "Se necesita adjuntar constancias, fotos, autorizaciones o documentos?",
        ],
        summaryLabel: "Datos a relevar",
        pendingText: "Pendiente de separar datos necesarios, sensibles y opcionales.",
        keywords: ["dato", "sanitario", "campo", "formulario", "autorizacion", "privacidad"],
      },
      {
        id: "operation",
        title: "Operacion en territorio",
        goal: "Aclarar responsables, autorizaciones, carga de datos y calendario operativo.",
        prompt:
          "Mediador, conversemos sobre la operacion: autorizaciones, responsables por escuela, quien carga datos, dispositivos disponibles, conectividad, cronograma y excepciones esperables.",
        questions: [
          "Quien autoriza y comunica el relevamiento a escuelas y familias?",
          "Quienes cargan los datos y con que dispositivos o conectividad?",
          "Que excepciones pueden ocurrir durante la jornada?",
        ],
        summaryLabel: "Operacion",
        pendingText: "Pendiente de definir responsables, autorizaciones y cronograma.",
        keywords: ["responsable", "cronograma", "carga", "dispositivo", "conectividad", "jornada"],
      },
      {
        id: "outputs",
        title: "Reportes y privacidad",
        goal: "Definir reportes esperados, accesos, resguardo de datos y criterios de exito.",
        prompt:
          "Mediador, ayudame a cerrar la ficha del pedido: reportes esperados, destinatarios, niveles de acceso, resguardo de datos sensibles, alertas y criterios de exito.",
        questions: [
          "Que reportes necesita Salud y con que nivel de detalle?",
          "Quien puede ver datos nominales y quien solo datos agregados?",
          "Que criterios indicarian que el operativo fue exitoso?",
        ],
        summaryLabel: "Reportes y privacidad",
        pendingText: "Pendiente de acordar reportes, accesos y resguardo.",
        keywords: ["reporte", "informe", "alerta", "resultado", "acceso", "exito"],
      },
    ],
  },
  {
    id: "public-works-claims",
    title: "Gestion de reclamos urbanos",
    description:
      "Para pedidos donde un area necesita ordenar reclamos, inspecciones, cuadrillas, prioridades y seguimiento ciudadano.",
    projectName: "Gestion municipal de reclamos urbanos",
    problem:
      "Un area municipal solicita soporte a Modernizacion para ordenar la recepcion, priorizacion, derivacion y seguimiento de reclamos urbanos.",
    institutionalRequest: {
      templateId: "public-works-claims",
      templateName: "Gestion de reclamos urbanos",
      requestingArea: "Secretaria de Obras Publicas",
      receivingArea: "Direccion de Modernizacion",
      contactPerson: "Referente de Obras Publicas",
      requestedAction: "Organizar la gestion de reclamos urbanos desde la recepcion hasta la resolucion y comunicacion del estado.",
      targetPopulation: "Vecinos, inspectores, operadores y cuadrillas municipales",
      urgency: "medium",
    },
    mediatorPrompt:
      "El area solicitante necesita describir a un Mediador IA como gestiona reclamos urbanos. Guiar la conversacion para entender canales de ingreso, tipos de reclamo, zonas, prioridades, inspecciones, cuadrillas, estados, evidencias, comunicacion al vecino, indicadores y excepciones operativas.",
    confirmationArea: "el area solicitante",
    active: true,
    blocks: [
      {
        id: "channels",
        title: "Ingreso del reclamo",
        goal: "Entender por donde entra el pedido, que datos trae y quien lo registra.",
        prompt:
          "Mediador, ayudame a precisar como ingresan los reclamos urbanos: canales, datos minimos, responsable de registro, duplicados y evidencia inicial.",
        questions: [
          "Por que canales ingresan los reclamos?",
          "Que datos minimos debe traer un reclamo para poder atenderse?",
          "Como se detectan reclamos duplicados o incompletos?",
        ],
        summaryLabel: "Ingreso del reclamo",
        pendingText: "Pendiente de definir canales, datos minimos y validaciones.",
        keywords: ["canal", "reclamo", "vecino", "registro", "duplicado", "evidencia"],
      },
      {
        id: "classification",
        title: "Clasificacion y prioridad",
        goal: "Definir tipos de reclamo, zonas, urgencias y criterios de priorizacion.",
        prompt:
          "Mediador, guiame para clasificar reclamos urbanos: tipos, zonas, criticidad, urgencias, criterios de prioridad y casos que requieren derivacion.",
        questions: [
          "Que tipos de reclamo se atienden y cuales se derivan?",
          "Que criterios hacen que un reclamo sea urgente?",
          "La zona, la escuela, hospital o transito cercano cambian la prioridad?",
        ],
        summaryLabel: "Clasificacion y prioridad",
        pendingText: "Pendiente de acordar categorias, zonas y criterios de urgencia.",
        keywords: ["tipo", "categoria", "prioridad", "urgente", "zona", "derivacion"],
      },
      {
        id: "fieldwork",
        title: "Inspeccion y cuadrillas",
        goal: "Aclarar como se asignan inspecciones, tareas, recursos y confirmacion de trabajo.",
        prompt:
          "Mediador, conversemos sobre inspecciones y cuadrillas: asignacion, agenda, recursos, evidencia de visita, estados de trabajo y confirmacion de cierre.",
        questions: [
          "Quien inspecciona y quien ejecuta la tarea?",
          "Como se agenda una cuadrilla y que recursos necesita?",
          "Que evidencia confirma que el trabajo se hizo?",
        ],
        summaryLabel: "Inspeccion y cuadrillas",
        pendingText: "Pendiente de definir asignacion, agenda, recursos y evidencia de cierre.",
        keywords: ["inspeccion", "cuadrilla", "agenda", "recurso", "evidencia", "cierre"],
      },
      {
        id: "tracking",
        title: "Seguimiento ciudadano",
        goal: "Definir estados, notificaciones, consultas y manejo de demoras o rechazos.",
        prompt:
          "Mediador, ayudame a describir el seguimiento ciudadano: estados, notificaciones, consultas, demoras, rechazos, reaperturas y responsables de comunicar.",
        questions: [
          "Que estados necesita ver el vecino?",
          "Cuando y por que canal se notifica un cambio?",
          "Que pasa si el reclamo se rechaza, demora o reabre?",
        ],
        summaryLabel: "Seguimiento ciudadano",
        pendingText: "Pendiente de definir estados, notificaciones y excepciones.",
        keywords: ["estado", "notificacion", "seguimiento", "demora", "rechazo", "reapertura"],
      },
      {
        id: "metrics",
        title: "Indicadores y control",
        goal: "Precisar reportes, tiempos, tableros, responsables y criterios de exito.",
        prompt:
          "Mediador, cerremos la ficha con indicadores: tiempos de respuesta, backlog, reclamos por zona, responsables, reportes y criterios de exito.",
        questions: [
          "Que indicadores necesita la direccion para gestionar?",
          "Que reportes o tableros deberian existir?",
          "Que criterio indica que el proceso mejoro?",
        ],
        summaryLabel: "Indicadores y control",
        pendingText: "Pendiente de definir reportes, metricas y criterios de mejora.",
        keywords: ["indicador", "reporte", "tablero", "tiempo", "backlog", "mejora"],
      },
    ],
  },
];

export function findInstitutionalInterviewTemplate(
  templates: InstitutionalInterviewTemplate[],
  templateId: string | undefined,
) {
  return templates.find((template) => template.id === templateId);
}
