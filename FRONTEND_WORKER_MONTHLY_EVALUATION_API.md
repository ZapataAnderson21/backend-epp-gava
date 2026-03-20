# Guia Frontend React - API de Evaluaciones Mensuales

## 1. Resumen rapido
Esta API permite:
- Crear y listar plantillas de evaluacion flexibles (bloques + preguntas).
- Duplicar plantillas.
- Crear evaluaciones mensuales por trabajador.
- Ver evaluaciones.
- Editar respuestas solo si la evaluacion esta abierta.
- Abrir/Cerrar evaluaciones.

Roles permitidos para crear/ver/modificar/evaluar:
- GERENTE
- ADMINISTRADORA
- PREVENCIONISTA DE RIESGOS

Roles permitidos para abrir/cerrar evaluacion:
- GERENTE
- ADMINISTRADORA

## 2. Base URL
Ajusta segun tu entorno:
- Desarrollo: http://localhost:3001

Base de endpoints:
- /worker-monthly-evaluation

## 3. Contrato base de respuesta
Todas las rutas devuelven la estructura:

- statusCode: number
- message: string
- data: T

Esto ya encaja con tus hooks useFetch y useApiAction.

## 4. Endpoints disponibles

### 4.1 Plantillas

#### Crear plantilla
- Metodo: POST
- URL: /worker-monthly-evaluation/template

Body ejemplo:
{
  "name": "Reconocimiento al Trabajador - Marzo 2026",
  "description": "Plantilla base para evaluacion mensual",
  "observedMaxScore": 20,
  "regularMaxScore": 35,
  "sections": [
    {
      "title": "Seguridad y salud",
      "questions": [
        {
          "prompt": "Actitud hacia seguridad y salud",
          "questionType": "score",
          "isRequired": true
        },
        {
          "prompt": "Observacion del evaluador",
          "questionType": "text",
          "isRequired": false
        }
      ]
    }
  ]
}

Notas:
- Preguntas score usan escala fija 0-3.
- Preguntas text no suman puntaje.
- observedMaxScore y regularMaxScore definen la escala de desempeno.

#### Listar plantillas
- Metodo: GET
- URL: /worker-monthly-evaluation/template

#### Obtener plantilla por id
- Metodo: GET
- URL: /worker-monthly-evaluation/template/:templateId

#### Duplicar plantilla
- Metodo: POST
- URL: /worker-monthly-evaluation/template/:templateId/duplicate

---

### 4.2 Evaluaciones (instancias)

#### Crear evaluacion
- Metodo: POST
- URL: /worker-monthly-evaluation/instance

Body ejemplo:
{
  "workerId": 12,
  "monthlyEvaluationTemplateVersionId": 3,
  "year": 2026,
  "month": 3,
  "sequence": 1,
  "generalComment": "Buen desempeno general",
  "responses": [
    {
      "monthlyEvaluationQuestionId": 101,
      "score": 3
    },
    {
      "monthlyEvaluationQuestionId": 102,
      "textAnswer": "Mantiene buena comunicacion"
    }
  ]
}

Reglas:
- score solo en preguntas tipo score.
- textAnswer solo en preguntas tipo text.
- No mezclar score en preguntas text.

#### Listar evaluaciones
- Metodo: GET
- URL: /worker-monthly-evaluation/instance

Query params opcionales:
- workerId
- month
- year

Ejemplo:
- /worker-monthly-evaluation/instance?workerId=12&month=3&year=2026

#### Obtener evaluacion por id
- Metodo: GET
- URL: /worker-monthly-evaluation/instance/:workerMonthlyEvaluationId

#### Actualizar respuestas
- Metodo: PATCH
- URL: /worker-monthly-evaluation/instance/:workerMonthlyEvaluationId/responses

Body ejemplo:
{
  "generalComment": "Actualizado luego de revision",
  "responses": [
    {
      "monthlyEvaluationQuestionId": 101,
      "score": 2
    },
    {
      "monthlyEvaluationQuestionId": 102,
      "textAnswer": "Mejora en trabajo en equipo"
    }
  ]
}

Regla critica:
- Solo se puede editar si status = open.

#### Abrir evaluacion
- Metodo: PATCH
- URL: /worker-monthly-evaluation/instance/:workerMonthlyEvaluationId/open
- Solo GERENTE y ADMINISTRADORA.

#### Cerrar evaluacion
- Metodo: PATCH
- URL: /worker-monthly-evaluation/instance/:workerMonthlyEvaluationId/close
- Solo GERENTE y ADMINISTRADORA.

## 5. Campos utiles para UI
En la respuesta de una evaluacion vas a recibir, entre otros:
- totalScore
- maxScore
- performanceLabel
- status
- responses
- templateVersion.sections[].questions[]
- scoreLegend
- performanceScale

Uso recomendado:
- Mostrar scoreLegend como ayuda de escala 0-3 en UI.
- Mostrar performanceScale como leyenda de interpretacion final.

## 6. Integracion con tus hooks actuales

### 6.1 Lectura con useFetch
Ejemplo para listar evaluaciones:

import { useFetch } from "../hooks/useFetch";

export function useMonthlyEvaluations(workerId?: number, month?: number, year?: number) {
  const qs = new URLSearchParams();
  if (workerId) qs.append("workerId", String(workerId));
  if (month) qs.append("month", String(month));
  if (year) qs.append("year", String(year));

  const url = `${import.meta.env.VITE_API_URL}/worker-monthly-evaluation/instance?${qs.toString()}`;
  return useFetch<any[]>(url, [workerId, month, year]);
}

### 6.2 Escritura con useApiAction
Ejemplo crear evaluacion:

import { useApiAction } from "../hooks/useApiAction";

export function useCreateMonthlyEvaluation() {
  const { execute, loading, error, response } = useApiAction<any>();

  const createEvaluation = async (payload: any) => {
    return execute(
      `${import.meta.env.VITE_API_URL}/worker-monthly-evaluation/instance`,
      "POST",
      payload
    );
  };

  return { createEvaluation, loading, error, response };
}

Ejemplo actualizar respuestas:

import { useApiAction } from "../hooks/useApiAction";

export function useUpdateMonthlyEvaluationResponses() {
  const { execute, loading, error, response } = useApiAction<any>();

  const updateResponses = async (evaluationId: number, payload: any) => {
    return execute(
      `${import.meta.env.VITE_API_URL}/worker-monthly-evaluation/instance/${evaluationId}/responses`,
      "PATCH",
      payload
    );
  };

  return { updateResponses, loading, error, response };
}

Ejemplo abrir/cerrar:

import { useApiAction } from "../hooks/useApiAction";

export function useToggleMonthlyEvaluationStatus() {
  const { execute, loading, error, response } = useApiAction<any>();

  const openEvaluation = async (evaluationId: number) => {
    return execute(
      `${import.meta.env.VITE_API_URL}/worker-monthly-evaluation/instance/${evaluationId}/open`,
      "PATCH"
    );
  };

  const closeEvaluation = async (evaluationId: number) => {
    return execute(
      `${import.meta.env.VITE_API_URL}/worker-monthly-evaluation/instance/${evaluationId}/close`,
      "PATCH"
    );
  };

  return { openEvaluation, closeEvaluation, loading, error, response };
}

## 7. Flujo recomendado en pantalla

1. Seleccionar trabajador + periodo (mes/anio).
2. Consultar si ya existe evaluacion en ese periodo.
3. Si no existe, crear desde una version de plantilla.
4. Renderizar bloques y preguntas desde templateVersion.sections.
5. Guardar respuestas con PATCH /responses.
6. Mostrar totalScore, performanceLabel y performanceScale.
7. Permitir cerrar evaluacion (solo rol autorizado).
8. Si esta cerrada, bloquear formulario y mostrar solo lectura.

## 8. Validaciones frontend recomendadas
- score obligatorio solo para preguntas score.
- score en rango 0..3.
- textAnswer solo para preguntas text.
- No permitir submit de edicion si status = closed.
- Controlar visibilidad de botones Open/Close por rol.

## 9. Errores comunes
- 401: token vencido o invalido (tus hooks ya redirigen login).
- 403: usuario sin UserType permitido.
- 400: payload invalido o intento de editar evaluacion cerrada.
- 409: ya existe evaluacion para worker+year+month+sequence.

## 10. Checklist de implementacion frontend
- Pantalla de lista con filtros por trabajador/mes/anio.
- Pantalla de detalle con secciones/preguntas dinamicas.
- Formulario de respuestas score/text.
- Acciones de abrir/cerrar con control por rol.
- Visualizacion de score acumulado y etiqueta de desempeno.
