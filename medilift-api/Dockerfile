FROM python:3.11-slim
WORKDIR /app
COPY requirements/base.txt /app/requirements/base.txt
RUN pip install --no-cache-dir -r requirements/base.txt
COPY . /app
ENV DJANGO_SETTINGS_MODULE=config.settings.development
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
