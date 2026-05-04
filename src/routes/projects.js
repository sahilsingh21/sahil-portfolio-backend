const express = require('express');
const router = express.Router();

const PROJECTS = [
  {
    _id: '1',
    name: 'Supply Chain Intelligence Dashboard',
    slug: 'supply-chain-dashboard',
    desc: 'Enterprise-grade planning dashboard for o9 Solutions serving Fortune 500 clients with real-time data.',
    problem: 'Legacy dashboards took 8s+ to load with 1M+ data points, blocking critical business decisions.',
    solution: 'Implemented GraphQL DataLoader for N+1 query batching, Redis caching layer, and React virtualization for large tables.',
    architecture: 'React → Apollo GraphQL → DataLoader → Redis Cache → MongoDB Atlas',
    challenges: 'N+1 query problem across nested supply chain data. Solved with DataLoader — reduced DB queries from 400 to 12 per page load.',
    techStack: ['react', 'graphql', 'node', 'mongodb', 'redis'],
    impact: '40% performance improvement',
    featured: true,
    order: 1,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
  {
    _id: '2',
    name: 'Real-Time Analytics Platform',
    slug: 'realtime-analytics',
    desc: 'WebSocket-powered analytics dashboard with live metric streaming and time-series visualization.',
    problem: 'Batch analytics gave stale data — business needed second-level visibility into KPIs.',
    solution: 'Node.js WebSocket server with Redis pub/sub, client-side delta updates, D3.js charts.',
    architecture: 'Client ↔ Socket.io ↔ Node.js ↔ Redis Pub/Sub ↔ MongoDB',
    challenges: 'Memory leaks at 10k events/sec. Solved with circular buffer pattern and canvas rendering.',
    techStack: ['react', 'node', 'mongodb', 'redis'],
    impact: 'Real-time at 10k events/sec',
    featured: true,
    order: 2,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
  {
    _id: '3',
    name: 'Developer Productivity Toolkit',
    slug: 'dev-productivity',
    desc: 'Internal CLI and web dashboard at Samsung automating dev workflows and environment setup.',
    problem: 'Onboarding a new engineer took 2 days of manual environment setup.',
    solution: 'Python CLI (Click) that auto-provisions environments + React dashboard for team metrics.',
    architecture: 'React UI → Node API → Python Worker → Docker Engine → GitHub API',
    challenges: 'Cross-platform compatibility. Solved by abstracting all provisioning behind Docker.',
    techStack: ['python', 'react', 'node'],
    impact: '70% setup time reduction',
    featured: false,
    order: 3,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
  {
    _id: '4',
    name: 'GraphQL Federation Layer',
    slug: 'graphql-federation',
    desc: 'Unified GraphQL API gateway federating 5 microservices into one coherent schema.',
    problem: 'Frontend had to call 5 separate REST APIs per page, causing waterfall requests.',
    solution: 'Apollo Federation with custom resolvers and schema stitching — one endpoint, one query.',
    architecture: 'Client → Apollo Router → [User, Orders, Inventory, Analytics, Notifications]',
    challenges: 'Schema conflicts between independently evolved services. Solved using federation directives.',
    techStack: ['graphql', 'node', 'mongodb'],
    impact: '5 services unified, 80% fewer requests',
    featured: false,
    order: 4,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
  {
    _id: '5',
    name: 'AI-Powered Semantic Search',
    slug: 'ai-semantic-search',
    desc: 'Full-text and semantic search over internal documentation using embeddings + MongoDB Atlas Vector Search.',
    problem: '1000+ internal docs with no intelligent search. Engineers wasted hours finding answers.',
    solution: 'Python embedding pipeline, MongoDB Atlas Vector Search, React UI with instant results.',
    architecture: 'React → Node API → OpenAI Embeddings → MongoDB Atlas Vector Search',
    challenges: 'Embedding latency for 1000+ docs. Solved with batch preprocessing and Celery task queue.',
    techStack: ['python', 'mongodb', 'react'],
    impact: '10x faster knowledge discovery',
    featured: false,
    order: 5,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
  {
    _id: '6',
    name: 'Django REST Microservice',
    slug: 'django-microservice',
    desc: 'Production-grade REST API with JWT auth, rate limiting, async tasks, and full OpenAPI docs.',
    problem: 'Monolith backend becoming a bottleneck; auth and user management needed extraction.',
    solution: 'Django REST Framework with JWT, Redis rate limiting, Celery for async tasks.',
    architecture: 'Client → Django API → PostgreSQL + Redis + Celery Workers',
    challenges: 'Zero-downtime migration from monolith. Solved using strangler fig pattern with feature flags.',
    techStack: ['python', 'node'],
    impact: '99.9% uptime SLA achieved',
    featured: false,
    order: 6,
    githubUrl: 'https://github.com/sahilsingh21',
    liveUrl: '#',
  },
];

// GET /api/projects
router.get('/', (req, res) => {
  const { stack } = req.query;
  let result = PROJECTS;
  if (stack && stack !== 'all') {
    result = PROJECTS.filter((p) => p.techStack.includes(stack.toLowerCase()));
  }
  res.json({ success: true, count: result.length, data: result });
});

// GET /api/projects/:slug
router.get('/:slug', (req, res) => {
  const project = PROJECTS.find((p) => p.slug === req.params.slug);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: project });
});

module.exports = router;