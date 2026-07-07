# Auto OSS Contributor

Automated open source contribution system powered by AI. Discovers contribution opportunities on GitHub, generates fixes, and submits PRs — all on autopilot.

## How It Works

```
[Discover] → [Analyze] → [Generate Fix] → [Submit PR] → [Track Status]
```

1. **Discover** — Scans GitHub for trending repos and issues labeled `good first issue`, `help wanted`
2. **Analyze** — Evaluates feasibility, classifies contribution type, scores confidence
3. **Generate** — Uses AI (OpenAI + HuggingFace) to generate minimal, targeted fixes
4. **Submit** — Forks repos, creates branches, submits PRs with clear descriptions
5. **Track** — Monitors PR statuses, responds to reviews, updates dashboard

## Setup

### 1. Clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/auto-oss-contributor.git
cd auto-oss-contributor
npm install
```

### 2. Configure secrets

Add these secrets to your GitHub repo settings (`Settings > Secrets > Actions`):

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_PAT` | Yes | Personal Access Token with `repo` + `workflow` scopes |
| `OPENAI_API_KEY` | Yes | OpenAI API key (free tier) |
| `HF_API_KEY` | Yes | HuggingFace API key (free tier) |

### 3. Customize settings

Edit `src/config/settings.json` to configure:
- Target languages
- Quality confidence threshold
- Max PRs per day
- Scan limits

### 4. Enable GitHub Actions

The pipeline runs automatically:
- **Daily at 8 AM UTC** — Main contribution pipeline
- **Daily at noon UTC** — PR review responder
- **Manual trigger** — Via `workflow_dispatch`

## Configuration

See [`src/config/settings.json`](src/config/settings.json) for all options.

## Local Development

```bash
# Copy env template
cp .env.example .env
# Edit .env with your API keys

# Run discovery only
npm run discover

# Run full pipeline
npm start
```

<!-- DASHBOARD:START -->
## Contribution Dashboard

*Last updated: 2026-07-07*

### Overview

| Metric | Count |
|--------|-------|
| Total PRs | 0 |
| Merged | 0 |
| Open | 0 |
| Closed | 0 |
| **Merge Rate** | **0%** |

### By Language

| Language | PRs |
|----------|-----|

### By Contribution Type

| Type | PRs |
|------|-----|

<!-- DASHBOARD:END -->
