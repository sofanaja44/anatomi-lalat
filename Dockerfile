# Wadah untuk menjalankan seluruh pipeline data + menyajikan viewer.
#
#   docker build -t anatomi-lalat .
#   docker run --rm -p 5173:5173 -v "$PWD/data:/app/data" anatomi-lalat
#
# Membangun ulang data di dalam wadah (butuh RAM lapang & waktu):
#   docker run --rm -v "$PWD/data:/app/data" anatomi-lalat bash tools/pipeline.sh

FROM python:3.12-slim

# nodejs hanya dipakai serve.js; wget untuk unduhan besar yang bisa dilanjutkan
RUN apt-get update && apt-get install -y --no-install-recommends \
        nodejs wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5173
ENV PORT=5173
CMD ["node", "serve.js"]
