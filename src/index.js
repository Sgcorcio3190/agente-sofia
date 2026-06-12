// src/index.js
// Agente de monitoreo de licitaciones COMPRASAL para Sigmart Group.
// Disenado para correr como cron job en Railway (1-2 veces al dia).
// Flujo: fetch por tags -> dedup contra Supabase -> clasificar con Claude -> alertar a Google Chat.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAllProcesos, normalizar } = require('./comprasal');
const { clasificar } = require('./classifier');
const { notificarLicitacion, notificarResumen } = require('./notifier');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('=== Monitor COMPRASAL — Sigmart Group ===');
  console.log('Inicio:', new Date().toISOString());

  // 1. Consultar COMPRASAL por todos los tags
  const { procesos, errores } = await fetchAllProcesos();
  console.log(`Procesos encontrados (unicos): ${procesos.length}`);

  if (procesos.length === 0 && errores.length > 0) {
    // Posible cambio en el API: alertar para revisar el scraper
    await notificarResumen({
      revisados: 0,
      nuevos: 0,
      relevantes: 0,
      errores: errores.length,
    });
    throw new Error('Cero resultados con errores: revisar si COMPRASAL cambio su API');
  }

  // 2. Filtrar los que ya conocemos (dedup por proceso_id)
  const ids = procesos.map((p) => p.id);
  const { data: existentes, error: errSelect } = await supabase
    .from('licitaciones_publicas')
    .select('proceso_id')
    .in('proceso_id', ids);

  if (errSelect) throw new Error(`Supabase select fallo: ${errSelect.message}`);

  const idsConocidos = new Set((existentes || []).map((e) => e.proceso_id));
  const nuevos = procesos.filter((p) => !idsConocidos.has(p.id));
  console.log(`Nuevos (no vistos antes): ${nuevos.length}`);

  // 3. Clasificar y guardar cada nuevo proceso
  let relevantes = 0;

  for (const raw of nuevos) {
    const lic = normalizar(raw);
    const clasificacion = await clasificar(lic);

    const { error: errInsert } = await supabase
      .from('licitaciones_publicas')
      .insert({
        proceso_id: lic.proceso_id,
        codigo_proceso: lic.codigo_proceso,
        nombre_proceso: lic.nombre_proceso,
        institucion: lic.institucion,
        forma_contratacion: lic.forma_contratacion,
        estado_actual: lic.estado_actual,
        fecha_limite_ofertas: lic.fecha_limite_ofertas,
        tags_detectados: lic.tags_detectados,
        relevante: clasificacion.relevante,
        division: clasificacion.division,
        prioridad: clasificacion.prioridad,
        razon_clasificacion: clasificacion.razon,
        raw: lic.raw,
      });

    if (errInsert) {
      console.error(`[main] Insert fallo para ${lic.codigo_proceso}:`, errInsert.message);
      continue;
    }

    // 4. Notificar solo lo relevante
    if (clasificacion.relevante) {
      relevantes++;
      await notificarLicitacion(lic, clasificacion);
      console.log(`✅ Notificado: ${lic.codigo_proceso} (${clasificacion.division})`);
    } else {
      console.log(`— Descartado: ${lic.codigo_proceso} (${clasificacion.razon})`);
    }
  }

  // 5. Resumen (solo si hubo algo que reportar o errores)
  if (nuevos.length > 0 || errores.length > 0) {
    await notificarResumen({
      revisados: procesos.length,
      nuevos: nuevos.length,
      relevantes,
      errores: errores.length,
    });
  }

  console.log('Fin:', new Date().toISOString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FALLO CRITICO:', err.message);
    process.exit(1);
  });
