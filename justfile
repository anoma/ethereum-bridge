default:
    # drop into a chisel shell by default
    chisel

test-deploy:
    MNEMONIC="test test test test test test test test test test test junk" \
        forge script script/deploy.s.sol:Deploy \
            --fork-url http://localhost:8545 \
            --broadcast \
            --via-ir \
            --sender 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
