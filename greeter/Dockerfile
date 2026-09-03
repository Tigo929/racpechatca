# Воркер первого сообщения клиенту. Отдельный контейнер, а не часть CRM:
# внутри лежит сессия личного аккаунта Telegram, и она не должна оказаться
# в образе, который собирается в CI и хранится в реестре.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY tg_greeter.py greeting_text.py proxy_config.py signing.py login.py message.txt ./

# Сессия монтируется томом снаружи и в образ не попадает.
VOLUME ["/session"]

CMD ["python", "-u", "tg_greeter.py"]
