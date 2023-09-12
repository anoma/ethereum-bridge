default:
    # drop into a chisel shell by default
    chisel

anvil:
    # start anvil producing blocks every 10s
    anvil -b 10

anvil-deploy BRIDGE_VALSET_JSON GOVERNANCE_VALSET_JSON:
    BRIDGE_VALSET_JSON="{{BRIDGE_VALSET_JSON}}" \
    GOVERNANCE_VALSET_JSON="{{GOVERNANCE_VALSET_JSON}}" \
    MNEMONIC="test test test test test test test test test test test junk" \
        forge script script/deploy.s.sol:Deploy \
            --fork-url http://localhost:8545 \
            --broadcast \
            --via-ir \
            --sender 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
