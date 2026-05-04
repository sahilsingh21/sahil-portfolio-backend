const express = require('express');
const router = express.Router();

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'sahilsingh21';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const githubFetch = async (path) => {
  const headers = {
    'User-Agent': 'sahil-portfolio',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (GITHUB_TOKEN && GITHUB_TOKEN.length > 10) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
};

// GET /api/github/stats
router.get('/stats', async (req, res) => {
  try {
    const [user, repos] = await Promise.all([
      githubFetch(`/users/${GITHUB_USERNAME}`),
      githubFetch(`/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=30&type=public`),
    ]);
    const langMap = {};
    for (const repo of repos) {
      if (repo.language) langMap[repo.language] = (langMap[repo.language] || 0) + 1;
    }
    const languages = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([lang, count]) => ({ lang, count }));
    const pinnedRepos = repos.filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6)
      .map((r) => ({
        name: r.name, description: r.description || '',
        url: r.html_url, stars: r.stargazers_count,
        forks: r.forks_count, language: r.language || 'Unknown',
        updatedAt: r.updated_at,
      }));
    res.json({ success: true, data: { followers: user.followers, publicRepos: user.public_repos, totalStars: repos.reduce((acc, r) => acc + r.stargazers_count, 0), languages, pinnedRepos } });
  } catch (err) {
    console.error('[GitHub] Error:', err.message);
    res.json({ success: false, error: err.message, data: { followers: 0, publicRepos: 0, totalStars: 0, languages: [], pinnedRepos: [] } });
  }
});

// GET /api/github/repos — fetch all repos as portfolio projects
router.get('/repos', async (req, res) => {
  try {
    const repos = await githubFetch(
      `/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100&type=public`
    );

    const projects = repos
      .filter((r) => !r.fork && r.description) // skip forks and repos with no description
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .map((r) => ({
        _id: String(r.id),
        name: r.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug: r.name,
        desc: r.description || 'No description provided.',
        problem: 'See GitHub repository for details.',
        solution: r.description || '',
        architecture: r.language ? `Built with ${r.language}` : 'See repository',
        challenges: 'See GitHub repository for details.',
        techStack: [
          r.language ? r.language.toLowerCase() : null,
          ...(r.topics || []),
        ].filter(Boolean).slice(0, 5),
        impact: `⭐ ${r.stargazers_count} stars · 🍴 ${r.forks_count} forks`,
        featured: r.stargazers_count > 0,
        githubUrl: r.html_url,
        liveUrl: r.homepage || '#',
        order: 0,
        fromGitHub: true,
      }));

    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    console.error('[GitHub] repos error:', err.message);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

module.exports = router;