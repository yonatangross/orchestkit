import http from 'supertest';
import { app } from '../src/app.js';

let agent;
beforeEach(() => {
  agent = http.agent(app);
});

it('keeps the session cookie', async () => {
  await agent.post('/login').send({ user: 'a', pass: 'b' }).expect(302);
  await agent
    .get('/me')
    .expect(200)
    .expect('Content-Type', /json/);
});

const api = http(app);
it('lists users', () => api.get('/users').expect(200, [{ id: 1 }]));
