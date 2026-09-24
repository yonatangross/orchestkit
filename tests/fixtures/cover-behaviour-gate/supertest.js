const request = require('supertest');
it('creates a user', async () => { await request(app).post('/users').send({ name: 'a' }).expect(201); });
it('rejects bad input', () => request(app).post('/users').send({}).expect(400).expect('Content-Type', /json/));
