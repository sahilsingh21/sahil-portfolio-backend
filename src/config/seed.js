// require('dotenv').config({ path: '../../../.env' });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Project = require('../models/Project');

const PROJECTS = [
  {
    name: 'Supply Chain Intelligence Dashboard',
    slug: 'supply-chain-dashboard',
    desc: 'Enterprise-grade planning dashboard for o9 Solutions serving Fortune 500 clients with real-time data.',
    problem: 'Legacy dashboards took 8s+ to load with 1M+ data points, blocking critical business decisions for supply chain managers.',
    solution: 'Implemented GraphQL DataLoader for N+1 query batching, Redis caching layer with TTL strategies, and React virtualization (react-window) for large data tables.',
    architecture: 'React → Apollo GraphQL → DataLoader → Redis Cache → MongoDB Atlas → AWS S3 (exports)',
    challenges: 'N+1 query problem across deeply nested supply chain data. Solved with DataLoader batching — reduced DB queries from 400 to 12 per page load.',
    techStack: ['react', 'graphql', 'node', 'mongodb', 'redis'],
    impact: '40% performance improvement',
    featured: true,
    order: 1,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
  {
    name: 'Real-Time Analytics Platform',
    slug: 'realtime-analytics',
    desc: 'WebSocket-powered analytics dashboard with live metric streaming and time-series visualization.',
    problem: 'Batch analytics jobs gave stale data — business needed second-level visibility into KPIs and operational metrics.',
    solution: 'Node.js WebSocket server with Redis pub/sub for fan-out, client-side delta updates to minimize re-renders, D3.js for high-performance canvas charts.',
    architecture: 'Client ↔ Socket.io ↔ Node.js ↔ Redis Pub/Sub ↔ Time-Series Aggregator ↔ MongoDB',
    challenges: 'Memory leaks on client at high-frequency updates (10k/sec). Solved with circular buffer pattern and canvas rendering instead of SVG.',
    techStack: ['react', 'node', 'mongodb', 'redis'],
    impact: 'Real-time at 10k events/sec',
    featured: true,
    order: 2,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
  {
    name: 'Developer Productivity Toolkit',
    slug: 'dev-productivity',
    desc: 'Internal CLI and web dashboard at Samsung automating dev workflows and environment setup.',
    problem: 'Onboarding a new engineer took 2 days of manual environment setup, causing frustration and inconsistency across machines.',
    solution: 'Python CLI (Click) that auto-provisions dev environments + React dashboard for real-time team metric monitoring.',
    architecture: 'React UI → Node API → Python Worker → Docker Engine → GitHub API',
    challenges: 'Cross-platform compatibility (Mac/Linux/Windows). Solved by abstracting all provisioning behind Docker, with platform detection for edge cases.',
    techStack: ['python', 'react', 'node'],
    impact: '70% setup time reduction',
    featured: false,
    order: 3,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
  {
    name: 'GraphQL Federation Layer',
    slug: 'graphql-federation',
    desc: 'Unified GraphQL API gateway federating 5 microservices into one coherent schema.',
    problem: 'Frontend had to call 5 separate REST APIs per page, causing waterfall requests and inconsistent error handling.',
    solution: 'Apollo Federation with custom resolvers and schema stitching — one endpoint, one query, intelligent caching.',
    architecture: 'Client → Apollo Router → [User, Orders, Inventory, Analytics, Notifications Services]',
    challenges: 'Schema conflicts between independently evolved services. Solved using federation directives (@key, @external, @provides) and a schema registry.',
    techStack: ['graphql', 'node', 'mongodb'],
    impact: '5 services unified, 80% fewer requests',
    featured: false,
    order: 4,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
  {
    name: 'AI-Powered Semantic Search',
    slug: 'ai-semantic-search',
    desc: 'Full-text and semantic search over internal documentation using embeddings + MongoDB Atlas Vector Search.',
    problem: '1000+ internal docs with no intelligent search. Engineers wasted hours finding answers — killing productivity.',
    solution: 'Python embedding pipeline (OpenAI text-embedding-3-small), MongoDB Atlas Vector Search, React UI with instant results and relevance scoring.',
    architecture: 'React → Node API → OpenAI Embeddings → MongoDB Atlas Vector Search → Result Reranking',
    challenges: 'Embedding latency for 1000+ docs. Solved with batch preprocessing pipeline and incremental updates via a Celery task queue.',
    techStack: ['python', 'mongodb', 'react'],
    impact: '10x faster knowledge discovery',
    featured: false,
    order: 5,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
  {
    name: 'Django REST Microservice',
    slug: 'django-microservice',
    desc: 'Production-grade REST API microservice with JWT auth, rate limiting, async tasks, and full OpenAPI documentation.',
    problem: 'Monolith backend becoming a bottleneck; auth and user management needed extraction for independent scaling.',
    solution: 'Django REST Framework with JWT auth, Redis rate limiting, Celery + Redis for async task processing, auto-generated OpenAPI docs.',
    architecture: 'Client → Django API → PostgreSQL + Redis + Celery Workers → SendGrid (email)',
    challenges: 'Zero-downtime migration from monolith. Solved using the strangler fig pattern with feature flags to route traffic progressively.',
    techStack: ['python', 'node'],
    impact: '99.9% uptime SLA achieved',
    featured: false,
    order: 6,
    githubUrl: 'https://github.com/sahilsingh',
    liveUrl: '#',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'sahil-portfolio' });
    await Project.deleteMany({});
    const inserted = await Project.insertMany(PROJECTS);
    console.log(`✅ Seeded ${inserted.length} projects successfully`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
