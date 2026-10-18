const { MongoClient, ObjectId } = require('mongodb');

let client;
async function db() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }
  return client.db(process.env.MONGODB_DB || 'planeador');
}

const FIELDS = {
  events: ['date', 'title', 'details', 'categoryId'],
  todos: ['text', 'done'],
  categories: ['name', 'color'],
};

module.exports = async (req, res) => {
  try {
    if (!process.env.PLANNER_PASSWORD || req.headers['x-auth'] !== process.env.PLANNER_PASSWORD)
      return res.status(401).json({ error: 'auth' });

    const { r, id, month } = req.query;
    if (!FIELDS[r]) return res.status(400).json({ error: 'recurso inválido' });

    const col = (await db()).collection(r);
    const pick = (o = {}) => Object.fromEntries(FIELDS[r].filter((k) => k in o).map((k) => [k, o[k]]));
    const oid = () => new ObjectId(id);

    if (req.method === 'GET') {
      const q = {};
      if (r === 'events' && /^\d{4}-\d{2}$/.test(month || '')) q.date = { $regex: '^' + month };
      return res.json(await col.find(q).sort({ _id: 1 }).toArray());
    }
    if (req.method === 'POST') {
      const doc = pick(req.body);
      if (r === 'todos') doc.done = false;
      const { insertedId } = await col.insertOne(doc);
      return res.json({ _id: insertedId, ...doc });
    }
    if (req.method === 'PUT') {
      await col.updateOne({ _id: oid() }, { $set: pick(req.body) });
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await col.deleteOne({ _id: oid() });
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'erro de servidor' });
  }
};
