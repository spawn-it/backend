FROM python:3.11-slim

RUN apt-get update && apt-get install -y git wget unzip && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/opentofu/opentofu/releases/latest/download/tofu_Linux_x86_64.zip && \
    unzip tofu_Linux_x86_64.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/tofu && \
    rm tofu_Linux_x86_64.zip

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
