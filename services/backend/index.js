import Fastify from 'fastify';
import sqlite3 from 'sqlite3';

const fastify = Fastify({ logger: true });
const db = new sqlite3.Database('./database.sqlite');


//Crude Adding and getting people from the database 
const initDb = () => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
};
initDb();

fastify.get('/users', (request, reply) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send(rows);
    }
  });
});

// Add user via POST
fastify.post('/users', (request, reply) => {
  const { name } = request.body;
  if (!name) {
    reply.code(400).send({ error: 'Name is required' });
    return;
  }
  db.run('INSERT INTO users (name) VALUES (?)', [name], function(err) {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send({ id: this.lastID, name });
    }
  });
});

// Database inspection endpoint
fastify.get('/db/info', (request, reply) => {
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send({ 
        table: 'users',
        userCount: row.count,
        timestamp: new Date().toISOString()
      });
    }
  });
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info('Backend running on port 3000');
});
