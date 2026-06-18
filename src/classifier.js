// src/classifier.js
// Clasifica cada proceso con Claude: relevante o no, division y prioridad.
// El filtro por tags trae falsos positivos (ej. "vapor" en otro contexto);
// Claude es el segundo filtro, el que entiende el negocio.

const Anthropic = require('@anthropic-ai/sdk');

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta variable de entorno: ANTHROPIC_API_KEY');
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYSTEM_PROMPT = `Eres el analista de licitaciones publicas de Sigmart Group, empresa industrial B2B de El Salvador con mas de 30 anos en Centroamerica.

Divisiones de Sigmart:
1. CALDERAS: calderas de vapor HURST, quemadores industriales CIB Unigas, repuestos, mantenimiento de casas de maquinas, sistemas termicos, generadores de vapor.
2. LAVANDERIA: equipo de lavanderia industrial Tecnitramo (lavadoras, secadoras, planchadores industriales), tipico en hospitales y hoteles.
3. QUIMICOS_PLAGAS: quimicos para tratamiento de agua de calderas, control de plagas, fumigacion.
4. OTRAS_OPORTUNIDADES: oportunidades de importancia estrategica para Sigmart Group fuera de las divisiones anteriores, incluyendo marchamos, CEPA, aduanas, puertos, aeropuertos, permisos, tramites o servicios institucionales relevantes para operaciones/importaciones.

Tu tarea: dado un proceso de licitacion, decidir si es una oportunidad REAL para alguna division.

Reglas:
- Se estricto. "Vapor" en un nombre de calle o "caldera" como apellido NO es relevante.
- Hospitales con calderas, lavanderia o quimicos = prioridad alta (cliente objetivo principal).
- Mantenimiento o repuestos de equipos que Sigmart representa = relevante.
- Servicios de lavado de ropa, alquiler de ropa hospitalaria o lavanderia domestica = NO relevante salvo que pidan equipo industrial.
- Quimicos genericos, reactivos de laboratorio, medicamentos, limpieza general, desinfectantes comunes o insumos de aseo = NO relevante.
- Tratamiento de agua solo es relevante si se relaciona con calderas, sistemas termicos, torres, equipos industriales u operacion hospitalaria/industrial.
- Fumigacion/control de plagas/control de vectores si es servicio institucional recurrente o equipo relacionado = relevante.
- Procesos detectados por marchamos o CEPA deben clasificarse como OTRAS_OPORTUNIDADES si representan una oportunidad o tramite relevante para Sigmart Group.
- Suministros genericos sin relacion termica/lavanderia industrial/quimicos de caldera/plagas = NO relevante.

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{"relevante": true|false, "division": "CALDERAS"|"LAVANDERIA"|"QUIMICOS_PLAGAS"|"OTRAS_OPORTUNIDADES"|null, "prioridad": "alta"|"media"|"baja"|null, "razon": "una frase corta"}`;

async function clasificar(proceso) {
  const client = getAnthropicClient();
  const resumen = {
    nombre: proceso.nombre_proceso,
    institucion: proceso.institucion,
    forma_contratacion: proceso.forma_contratacion,
    actividades: proceso.actividades,
    tags_que_lo_detectaron: proceso.tags_detectados,
  };

  const msg = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Clasifica este proceso:\n${JSON.stringify(resumen, null, 2)}`,
      },
    ],
  });

  const texto = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  try {
    const json = JSON.parse(texto);
    return {
      relevante: Boolean(json.relevante),
      division: json.division || null,
      prioridad: json.prioridad || null,
      razon: json.razon || '',
    };
  } catch (err) {
    console.error('[classifier] Respuesta no parseable:', texto);
    // Ante la duda, marcar para revision humana en lugar de descartar.
    return {
      relevante: true,
      division: null,
      prioridad: 'media',
      razon: 'Clasificacion fallida, revisar manualmente',
    };
  }
}

module.exports = { clasificar };
