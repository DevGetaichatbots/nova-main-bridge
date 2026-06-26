#!/bin/bash
apt-get install -y --no-install-recommends \
    libgobject-2.0-0 \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi8

playwright install --with-deps chromium

gunicorn --bind=0.0.0.0 --timeout 600 app:app
