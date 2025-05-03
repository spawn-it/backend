FROM fedora:latest

RUN dnf install -y python3-pip python3-devel git opentofu && \
    dnf clean all

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
