FROM python:3.9-slim

WORKDIR /app

# Instala git e gcc (necessários para instalar algumas libs python)
RUN apt-get update && apt-get install -y git gcc

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]