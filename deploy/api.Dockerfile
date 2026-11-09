FROM python:3.12-slim-bookworm
WORKDIR /srv/backend
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unixodbc \
 && curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o /tmp/msprod.deb \
 && dpkg -i /tmp/msprod.deb && rm /tmp/msprod.deb && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app app
COPY backend/main.py .
COPY database/sqlserver/00[1-4]_*.sql /srv/sql/
COPY deploy/install.py deploy/serve.py deploy/manifest.json /srv/
ENV SHADOWPRINT_MODE=hosted PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
CMD ["python","/srv/serve.py"]
