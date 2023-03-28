simple-k6:
	docker run \
		--name k6 \
		--rm \
		--platform linux/amd64 \
		-v /Users/farrucosanjurjo/repos/work/techtalk-building-dist-systems/k6-scenarios:/foo \
		--network=techtalk-building-dist-systems_systems \
		-p 6565:6565 \
		grafana/k6 run /foo/k6-scenario.js

status:
	docker exec $$(docker ps -aqf "name=k6") k6 status

# increase-vus-by-100:
# 	docker exec $$(docker ps -aqf="name=k6") k6 
