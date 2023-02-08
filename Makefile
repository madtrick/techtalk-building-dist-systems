simple-k6:
	docker run \
		--platform linux/amd64 \
		-v /Users/farrucosanjurjo/repos/work/techtalk-building-dist-systems/k6-scenarios:/foo \
		--network=techtalk-building-dist-systems_systems \
		grafana/k6 run --vus 50 --duration 30s --http-debug /foo/k6-scenario.js
