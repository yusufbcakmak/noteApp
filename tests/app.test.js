const request = require('supertest');
const app = require('../src/app');

describe('App', () => {
  test('GET / should return welcome message', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body).toMatchObject({
      message: 'Note Management App API',
      version: '1.0.0'
    });
    expect(response.body.endpoints).toBeDefined();
  });

  test('GET /health should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
  });
});