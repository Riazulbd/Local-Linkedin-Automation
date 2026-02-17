---
description: Always rebuild the Docker environment to ensure changes are synced
---

// turbo-all

1. Rebuild and restart the Docker containers in detached mode:

```powershell
docker compose up --build -d
```

2. Verify the status of the containers:

```powershell
docker compose ps
```
