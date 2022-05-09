check:
	VIAIR=true npx hardhat check

size:
	VIAIR=true npx hardhat check

lint:
	npx solhint 'contracts/**/*.sol'
	npx prettier --check 'contracts/**/*.sol'

lint-fix:
	npx prettier --write 'contracts/**/*.sol'

build-prod:
	npx hardhat clean
	RUNS=10000 VIAIR=true npx hardhat compile --force

build-size:
	npx hardhat clean
	RUNS=10000 VIAIR=true npx hardhat compile --force
	npx hardhat size-contracts

clean:
	npx hardhat clean

test:
	RUNS=10 VIAIR=true npx hardhat test

test-gas:
	RUNS=10000 VIAIR=true REPORT_GAS=true npx hardhat test

test-coverage:
	VIAIR=false REPORT_GAS=false npx hardhat coverage

deps:
	npm ci

.PHONY: build build-prod clean test test-gas test-coverage lint lint-fix deps build-size check size