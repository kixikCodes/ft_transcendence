#!/bin/sh
set -e

# Substitute SLACK_WEBHOOK_URL in the config
sed "s|\${SLACK_WEBHOOK_URL}|${SLACK_WEBHOOK_URL}|g" /etc/alertmanager/alertmanager.yml > /tmp/alertmanager.yml

# Start Alertmanager with the substituted config
exec /bin/alertmanager --config.file=/tmp/alertmanager.yml "$@"
