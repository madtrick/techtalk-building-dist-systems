# Running

```
docker compose up
```

# Grafana

`http://localhost:3001`

- username: admin
- pasword: admin

Setup

- Set the influxdb token in the influxdb datasource
- Set the `organization` name in the influxdb datasource
- Set the `bucket` name in the influxdb datasource

# Influxdb

`http://localhost:8086`

- username: admin
- password: 12345678

# Telegraf

Setup:

- Set the influxdb token in the `telegraf.conf` file
- Set the `organization` name in the `telegraf.conf` file
- Set the `bucket` name in the `telegraf.conf` file
