FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy scripts first and set permissions
COPY wait-for-it.sh entrypoint.sh ./
RUN chmod +x wait-for-it.sh entrypoint.sh \
    && chown -R root:root /app/*.sh \
    && chmod 755 /app/*.sh

# Copy the rest of the application
COPY . .

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"] 