// src/notifier.js
// Envia alertas de nuevas licitaciones al espacio de Google Chat de Sigmart.
// Reutiliza el mismo patron de webhook que ya usa Laura.

const WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL;

const PRIORIDAD_EMOJI = { alta: '🔴', media: '🟡', baja: '🟢' };
const DIVISION_LABEL = {
  CALDERAS: 'Calderas / Vapor',
  LAVANDERIA: 'Lavanderia industrial',
  QUIMICOS_PLAGAS: 'Quimicos / Plagas',
  OTRAS_OPORTUNIDADES: 'Otras - Oportunidades de Importancia para Sigmart Group',
};

function formatFecha(iso) {
  if (!iso) return 'No especificada';
  return new Date(iso).toLocaleString('es-SV', {
    timeZone: 'America/El_Salvador',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function notificarLicitacion(lic, clasificacion) {
  if (!WEBHOOK_URL) {
    console.warn('[notifier] GOOGLE_CHAT_WEBHOOK_URL no configurado, omitiendo.');
    return;
  }

  const emoji = PRIORIDAD_EMOJI[clasificacion.prioridad] || '⚪';
  const division = DIVISION_LABEL[clasificacion.division] || 'Por clasificar';

  const texto = [
    `${emoji} *Nueva licitacion detectada — ${division}*`,
    '',
    `*${lic.nombre_proceso}*`,
    `Institucion: ${lic.institucion}`,
    `Codigo: ${lic.codigo_proceso}`,
    `Metodo: ${lic.forma_contratacion}`,
    `Estado: ${lic.estado_actual}`,
    `*Limite de ofertas: ${formatFecha(lic.fecha_limite_ofertas)}*`,
    `Prioridad: ${clasificacion.prioridad || 'n/d'} — ${clasificacion.razon}`,
    '',
    `Ver en COMPRASAL: https://www.comprasal.gob.sv/procesos-oportunidades (buscar codigo ${lic.codigo_proceso})`,
  ].join('\n');

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto }),
  });

  if (!res.ok) {
    console.error('[notifier] Google Chat respondio', res.status);
  }
}

async function notificarResumen(stats) {
  if (!WEBHOOK_URL) return;
  const texto = [
    '📊 *Monitor COMPRASAL — corrida completada*',
    `Procesos revisados: ${stats.revisados}`,
    `Nuevos detectados: ${stats.nuevos}`,
    `Relevantes notificados: ${stats.relevantes}`,
    stats.errores > 0 ? `ℹ️ ${stats.errores} palabras clave sin resultados en COMPRASAL (normal si no hay procesos activos)` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto }),
  }).catch((e) => console.error('[notifier] resumen fallo:', e.message));
}

module.exports = { notificarLicitacion, notificarResumen };
