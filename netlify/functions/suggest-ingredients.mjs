// Netlify Function: POST /api/suggest-ingredients
// Secrets are read with Netlify.env (set in the Netlify dashboard), never from the browser.

const usage = new Map() // best-effort daily limit per user (resets when the function restarts)
const LIMIT = 40

const schema = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: 'string', enum: ['g', 'ml', 'pc'] },
          qty: { type: 'number' },
          cost: { type: 'number' }
        },
        required: ['name', 'unit', 'qty', 'cost'],
        additionalProperties: false
      }
    }
  },
  required: ['ingredients'],
  additionalProperties: false
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const env = k => Netlify.env.get(k)

  // 1. Check the Supabase login
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  if (!token) return json({ error: 'Please sign in' }, 401)
  const who = await fetch(env('SUPABASE_URL') + '/auth/v1/user', {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + token }
  })
  if (!who.ok) return json({ error: 'Please sign in' }, 401)
  const user = await who.json()

  // 2. Simple daily limit
  const key = user.id + new Date().toISOString().slice(0, 10)
  const n = (usage.get(key) || 0) + 1
  if (n > LIMIT) return json({ error: 'Daily AI limit reached. Try again tomorrow.' }, 429)
  usage.set(key, n)

  // 3. Validate input
  let body = {}
  try { body = await req.json() } catch {}
  const dish = String(body.dish || '').trim().slice(0, 80)
  const category = String(body.category || '').trim().slice(0, 40)
  const existing = Array.isArray(body.existing) ? body.existing.slice(0, 80).map(x => String(x).slice(0, 60)) : []
  if (!dish) return json({ error: 'Dish name required' }, 400)

  const prompt =
    `List at most 12 ingredients for ONE portion of "${dish}"${category ? ` (category: ${category})` : ''} as made in a restaurant kitchen in Dubai, UAE. ` +
    `unit is g, ml or pc. qty is the amount per portion in that unit. cost is a typical wholesale price in AED per kg (g), per litre (ml) or per piece (pc). ` +
    `Use simple generic names such as "Chicken breast". ` +
    (existing.length ? `Reuse these existing names when they fit: ${existing.join(', ')}.` : '')
  const messages = [
    { role: 'system', content: 'You are a restaurant recipe-costing assistant. Reply with JSON only.' },
    { role: 'user', content: prompt }
  ]
  const groq = extra =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env('GROQ_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env('GROQ_MODEL'), temperature: 0.3, ...extra })
    })

  // 4. Ask Groq (schema-enforced first, plain JSON mode as fallback)
  try {
    let r = await groq({ messages, response_format: { type: 'json_schema', json_schema: { name: 'ingredients', schema } } })
    if (!r.ok) {
      r = await groq({
        messages: [...messages, { role: 'user', content: 'Return {"ingredients":[{"name":string,"unit":"g"|"ml"|"pc","qty":number,"cost":number}]}.' }],
        response_format: { type: 'json_object' }
      })
    }
    if (!r.ok) throw new Error('Groq ' + r.status)
    const out = JSON.parse((await r.json()).choices[0].message.content)
    const ingredients = (out.ingredients || []).filter(x => x?.name && x.qty > 0 && ['g', 'ml', 'pc'].includes(x.unit)).slice(0, 12)
    return json({ ingredients })
  } catch (e) {
    return json({ error: 'The AI request failed. Check GROQ_API_KEY and GROQ_MODEL in Netlify.' }, 502)
  }
}

export const config = { path: '/api/suggest-ingredients', method: 'POST' }
