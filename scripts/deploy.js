const hre = require("hardhat");
const deploy = require("../tasks/deploy.js")

async function main() {
    await deploy.main(hre)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });