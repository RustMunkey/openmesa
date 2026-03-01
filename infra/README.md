# Infrastructure

Deimos backend runs on AWS. Frontend (web + www) deploys to Vercel automatically.

## Structure

```
infra/
  docker/     # Docker compose configs
  k8s/        # Kubernetes manifests (future)
  ecs/        # AWS ECS task definitions (fill in when ready)
  tf/         # Terraform (fill in when ready)
```

## Backend Deployment Options

### Option A — AWS ECS (Recommended for production)
1. Build and push Docker image to ECR
2. ECS Fargate runs the container
3. RDS Postgres (or Neon) for the database
4. ALB in front of ECS for HTTPS

### Option B — AWS Lambda (Good for low traffic)
- Use Mangum adapter to wrap FastAPI for Lambda
- API Gateway in front
- Aurora Serverless for database

### Option C — Single EC2 (Simplest, good for early)
- One EC2 instance, Docker Compose
- Nginx reverse proxy + SSL via certbot
- Cheapest option, no auto-scaling

## When Ready to Deploy

1. Add secrets to GitHub (see `.claude/GITHUB.md`)
2. Fill in `release.yml` backend deploy step
3. Push a `v*` tag to trigger release

## Domain Setup

- `deimos.app` or `openmesa.app` — point to Vercel (web + www)
- `api.deimos.app` — point to AWS backend
- Add CNAME records in your DNS provider
- Vercel handles SSL for frontend automatically
- AWS ACM handles SSL for backend (ALB)
