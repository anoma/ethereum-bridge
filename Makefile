build:
	VIAIR=true npx hardhat compile

build-prod:
	npx hardhat clean
	RUNS=10000 VIAIR=true npx hardhat compile --force

test:
	RUNS=10 VIAIR=true npx hardhat test

test-gas:
	RUNS=10000 VIAIR=true REPORT_GAS=true npx hardhat test

test-coverage:
	VIAIR=false REPORT_GAS=false npx hardhat coverage

.PHONY: build build-prod test test-gas test-coverage