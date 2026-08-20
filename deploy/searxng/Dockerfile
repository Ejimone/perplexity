FROM searxng/searxng:latest

# The image's entrypoint reads /etc/searxng/settings.yml and substitutes
# SEARXNG_SECRET into it at start-up.
COPY settings.yml /etc/searxng/settings.yml

EXPOSE 8080
