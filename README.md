# Agente de Licitaciones COMPRASAL — Sigmart Group

Monitorea el API publico de COMPRASAL, filtra con Claude las licitaciones
relevantes para las divisiones de Sigmart (calderas, lavanderia, quimicos/plagas),
las guarda en el CRM (Supabase) y alerta por Google Chat.

## Arquitectura

```
COMPRASAL API publico
  /api/v1/publico/obtener/procesos/disponibles?tags[]=...
        |
        v
  src/comprasal.js  -- consulta por palabras clave, deduplica
        |
        v
  Supabase (licitaciones_publicas)  -- dedup: solo procesa lo nuevo
        |
        v
  src/classifier.js (Claude)  -- relevante? division? prioridad?
        |
        v
  src/notifier.js  -- alerta a Google Chat solo lo relevante
```

## Instalacion local (prueba)

1. `npm install`
2. Ejecutar `schema.sql` en el SQL Editor de Supabase (proyecto industrial)
3. Copiar `.env.example` a `.env` y completar las 4 variables
4. `npm start`

La primera corrida insertara todo lo que encuentre (baseline) y notificara
lo relevante. Las siguientes solo procesan procesos nuevos.

## Despliegue en Railway (cron job)

1. Subir este repo a GitHub y conectarlo a un nuevo servicio en Railway
2. Cargar las variables de entorno del `.env.example`
3. En Settings del servicio, configurar **Cron Schedule**: `0 13 * * 1-5`
   (7:00 AM hora El Salvador, lunes a viernes — UTC-6)
4. El script corre, termina y sale (exit 0). Railway lo despierta en cada cron.

## Ajustar palabras clave

Editar el array `TAGS` en `src/comprasal.js`. Recomendacion: revisar las
primeras 2-3 semanas que esta detectando Claude como relevante/irrelevante
y afinar tags y prompt del clasificador segun resultados reales.

## Costos estimados

- Railway: dentro del plan actual (el cron corre ~2 min/dia)
- Claude API: solo clasifica procesos NUEVOS (~300 tokens c/u).
  Con 10-30 procesos nuevos/dia: centavos al mes.

## Si deja de funcionar

El script alerta a Google Chat si obtiene cero resultados con errores
(senal de que COMPRASAL cambio su API). En ese caso: repetir el ejercicio
de DevTools > Network para capturar el endpoint nuevo y actualizar
`BASE_URL` en `src/comprasal.js`.
