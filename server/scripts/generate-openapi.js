const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../src/api/routes');
const outputFile = path.resolve(__dirname, '../openapi.generated.json');

const mountMap = {
  'auth.routes.js': '/api/v1/auth',
  'payment.routes.js': '/api/v1/payment',
  'trading.routes.js': '/api/v1/trading',
  'market.routes.js': '/api/v1/market',
  'defi.routes.js': '/api/v1/defi',
  'wallet.routes.js': '/api/v1/wallet',
  'addressbook.routes.js': '/api/v1/addressbook',
  'transaction.routes.js': '/api/v1/transaction',
  'user.routes.js': '/api/v1/user',
  'notification.routes.js': '/api/v1/user/notifications',
  'portfolio.routes.js': '/api/v1/portfolio',
  'analytics.routes.js': '/api/v1/analytics',
  'ai.routes.js': '/api/v1/ai',
  'learning.routes.js': '/api/v1/learning',
  'security.routes.js': '/api/v1/security'
};

const files = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
const paths = {};

const methodRegex = /router\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]/g;

files.forEach(file => {
  const mountPrefix = mountMap[file] || '';
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    const fullRoute = route === '/' ? mountPrefix : `${mountPrefix}${route}`;
    const openapiRoute = fullRoute.replace(/:(\w+)/g, '{$1}');
    if (!paths[openapiRoute]) {
      paths[openapiRoute] = {};
    }

    const operation = {
      summary: `${method.toUpperCase()} ${openapiRoute}`,
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    };

    if (openapiRoute.includes('{')) {
      operation.parameters = [];
      const params = [...openapiRoute.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      params.forEach(name => operation.parameters.push({ name, in: 'path', required: true, schema: { type: 'string' } }));
    }

    if (['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    const protectedRouteGroups = ['user', 'wallet', 'trading', 'defi', 'portfolio', 'analytics', 'notification', 'payment', 'security', 'transaction'];
    if (protectedRouteGroups.some(group => file.startsWith(group))) {
      operation.security = [{ bearerAuth: [] }];
    }

    paths[openapiRoute][method] = operation;
  }
});

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'NeoFin API',
    version: '1.0.0',
    description: 'Automatically generated OpenAPI specification for NeoFin backend routes.'
  },
  servers: [{ url: 'http://localhost:3003', description: 'Local development server' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: { type: 'object' },
          meta: { type: 'object' }
        },
        required: ['status', 'data']
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string' },
          code: { type: 'integer' }
        },
        required: ['status', 'message']
      }
    }
  },
  paths
};

fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
console.log(`Generated ${outputFile}`);
