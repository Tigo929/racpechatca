# Воркер первого сообщения клиенту. Отдельный контейнер, а не часть CRM:
# внутри лежит сессия личного аккаунта Telegram, и она не должна оказаться
# в образе, который собирается в CI и хранится в реестре.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все модули воркера, а не перечисляем их руками: забытый в этом
# списке файл роняет контейнер при старте — «No module named reply_queue»
# на живом сервере, и приветствия не уходят вовсе. Что в образ не попадает
# (сессия Telegram, тесты, кэш) — сказано в .dockerignore.
COPY *.py ./
COPY message*.txt ./

# Сессия монтируется томом снаружи и в образ не попадает.
VOLUME ["/session"]

CMD ["python", "-u", "tg_greeter.py"]
