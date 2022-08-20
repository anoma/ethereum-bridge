//* Approves the bridge to spend the test ERC20 of the deployer, and makes a transfer to Namada from the deployer *//

const { ethers, network } = require("hardhat");
const fs = require('fs');

/// testErc20Address should be the address of the first contract deployed to Hardhat, which was TestERC20
const testErc20Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
/// address of sole validator from <https://github.com/anoma/namada/files/9299669/anoma-dev.c21a27c05f23fae3d2f5bac3ad.tar.gz>
const receiverNamadaAddress = 'atest1v4ehgw36xuunwd6989prwdfkxqmnvsfjxs6nvv6xxucrs3f3xcmns3fcxdzrvvz9xverzvzr56le8f';

async function main() {
    const [me] = await ethers.getSigners();
    console.log(`I am ${me.address}`);

    // testErc20Address should already have been deployed    ';
    let stateJson = readStateJson();
    let bridgeAddress = stateJson['bridge'];
    console.log(`Bridge at: ${bridgeAddress}`);


    let testErc20 = await ethers.getContractAt("TestERC20", testErc20Address);
    console.log(`TestERC20 at: ${testErc20Address}`);

    const transferAmount = 100;
    await testErc20.approve(bridgeAddress, transferAmount)
    console.log(`Approved ${transferAmount} tokens`);
    let bridgeAllowance = await testErc20.allowance(me.address, bridgeAddress);
    console.log(`Bridge allowance: ${bridgeAllowance}`);

    const bridge = await ethers.getContractAt("Bridge", bridgeAddress);
    console.log(`Transferring ${testErc20Address} to ${receiverNamadaAddress}`);
    let result = await bridge.transferToNamada(
        [testErc20Address],
        [transferAmount],
        [receiverNamadaAddress],
        0,
    );
    console.log(`Result: ${JSON.stringify(result)}`);


    let bridgeRemainingAllowance = await testErc20.allowance(me.address, bridgeAddress);
    console.log(`Bridge remaining allowance: ${bridgeRemainingAllowance}`);

    for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
        console.log(`Mined a block`);
    }
    // TODO: 

    // this gets the bridge's balance of wrapped NAM
    // {
    //     let wnamAddress = stateJson['token'];
    //     const token = await ethers.getContractAt("Token", wnamAddress);
    //     let balance = await token.balanceOf(bridgeAddress);
    //     console.log(balance);
    // }
}

function readStateJson() {
    let state = fs.readFileSync('scripts/state-localhost-31337.json', encoding = 'UTF-8');
    console.log(state);

    let stateJson = JSON.parse(state);
    return stateJson
}

function printMyBalance() {

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });