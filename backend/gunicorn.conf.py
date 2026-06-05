import os

worker_class = "uvicorn.workers.UvicornWorker"
bind = "0.0.0.0:8000"

# LLM-based evaluation can take >30s; default Gunicorn timeout is 30.
# Allow override via env.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "300"))
keepalive = 120
max_requests = 1000
max_requests_jitter = 50
accesslog = "-"
errorlog = "-"
