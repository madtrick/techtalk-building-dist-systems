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
- Set the `bucket` name in the `telegraf.conf` file

# Influxdb

`http://localhost:8086`

- username: admin
- password: 12345678

# Telegraf

Setup:

- Set the influxdb token in the `telegraf.conf` file
- Set the `organization` name in the `telegraf.conf` file
- Set the `bucket` name in the `telegraf.conf` file

# K6

- Increase the number of vus

```shell
docker exec $(docker ps -aqf="name=k6") k6 scale -u <number>
```
