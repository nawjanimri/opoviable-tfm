import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { request as requestHttps } from 'node:https';
import { readFile } from 'node:fs/promises';

const numberFields = ['hours', 'months', 'available', 'middle', 'neededMonths', 'extraWeekly'];
const mimeTypes = {
  html: 'text/html; charset=utf-8',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

function reply(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function requestApi(url, { timeout, body, ...options }) {
  return new Promise((resolve, reject) => {
    const request = requestHttps(url, options, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({
        status: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 300,
        json: () => JSON.parse(text)
      }));
    });
    const timer = setTimeout(() => request.destroy(new Error('Tiempo de espera agotado')), timeout);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end(body);
  });
}

export function createApp({ apiKey, groqKey, model, requestModel = requestApi }) {
  const useGroq = Boolean(groqKey?.trim());
  const key = useGroq ? groqKey : apiKey;
  const provider = useGroq ? 'Groq' : 'OpenAI';
  model ??= useGroq ? 'openai/gpt-oss-20b' : 'gpt-4.1-mini';
  return createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET') {
      const file = path === '/' ? '/index.html' : path;
      if (!/^\/(?:index\.html|privacidad\.html|imagenes\/[\w.-]+\.(?:jpe?g|png|webp))$/i.test(file)) {
        return reply(response, 404, { error: 'Página no encontrada' });
      }
      try {
        const bytes = await readFile(new URL('.' + file, import.meta.url));
        response.writeHead(200, { 'Content-Type': mimeTypes[file.split('.').pop().toLowerCase()] });
        return response.end(bytes);
      } catch {
        return reply(response, 404, { error: 'Archivo no encontrado' });
      }
    }
    if (path !== '/api/explain' || request.method !== 'POST') {
      return reply(response, 404, { error: 'Ruta no encontrada' });
    }
    if (request.headers['content-type'] !== 'application/json') {
      return reply(response, 415, { error: 'Se requiere JSON' });
    }

    let scenario;
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 2048) return reply(response, 413, { error: 'Solicitud demasiado grande' });
      }
      const input = JSON.parse(body);
      if (!input || !['hours', 'deadline', 'both'].includes(input.constraint) ||
          !numberFields.every(field => Number.isSafeInteger(input[field]) && input[field] >= 0) ||
          !input.hours || !input.months || !input.middle || !input.neededMonths) {
        return reply(response, 400, { error: 'Escenario no válido' });
      }
      scenario = { constraint: input.constraint };
      for (const field of numberFields) scenario[field] = input[field];
    } catch {
      return reply(response, 400, { error: 'Escenario no válido' });
    }
    if (!key?.trim()) {
      console.error('[OpoViable] Falta GROQ_API_KEY u OPENAI_API_KEY en el servidor.');
      return reply(response, 503, { error: 'Modelo sin configurar' });
    }

    try {
      const instructions = 'Explica en español el balance orientativo de estudio en hasta 90 palabras. Usa solo cifras proporcionadas. available son las horas efectivas y middle es la referencia ilustrativa de preparación. hours son horas por semana, months es el plazo, neededMonths es el plazo total estimado al ritmo actual y extraWeekly son horas semanales adicionales estimadas con el plazo actual. Si available alcanza middle, sugiere mantener el plan y revisar el avance. Si faltan horas y constraint es hours, conserva las horas semanales y propone neededMonths. Si es deadline, conserva months y explica extraWeekly como aumento condicional. Si es both, conserva plazo y horas y sugiere un objetivo parcial. Evita pronósticos de aprobado. Devuelve texto sin formato.';
      const input = JSON.stringify(scenario);
      const url = useGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/responses';
      const payload = useGroq ? {
        model,
        max_completion_tokens: 800,
        reasoning_effort: 'low',
        messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }]
      } : { model, store: false, max_output_tokens: 300, instructions, input };
      const result = await requestModel(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key.trim(), 'Content-Type': 'application/json' },
        timeout: 20000,
        body: JSON.stringify(payload)
      });
      if (!result.ok) {
        console.error('[OpoViable] ' + provider + ' respondió con HTTP ' + result.status + '.');
        return reply(response, 502, { error: 'El proveedor rechazó la solicitud' });
      }
      const data = await result.json();
      const explanation = useGroq ? data.choices?.[0]?.message?.content?.trim() : (data.output ?? []).filter(item => item.type === 'message')
        .flatMap(item => item.content)
        .filter(part => part.type === 'output_text')
        .map(part => part.text).join('\n').trim();
      if (!explanation || (useGroq ? data.choices[0].finish_reason !== 'stop' : data.status !== 'completed')) {
        console.error('[OpoViable] El modelo devolvió una respuesta incompleta.');
        return reply(response, 502, { error: 'Respuesta incompleta' });
      }
      return reply(response, 200, { explanation });
    } catch {
      console.error('[OpoViable] Falló la conexión con ' + provider + ' o la lectura de la respuesta.');
      return reply(response, 502, { error: 'El modelo no está disponible' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createApp({ apiKey: process.env.OPENAI_API_KEY, groqKey: process.env.GROQ_API_KEY, model: process.env.GROQ_API_KEY?.trim() ? process.env.GROQ_MODEL : process.env.OPENAI_MODEL })
    .listen(8000, '127.0.0.1', () => console.log('OpoViable TFM disponible en http://127.0.0.1:8000/'));
}
