DEFAULT-SIGNER := "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

default:
    # drop into a chisel shell by default, with {{DEFAULT-SIGNER}}
    # as the default tx signer, and some imported utils
    @./script/ptypipe script/repl.s.sol chisel \
        --fork-url http://localhost:8545 \
        --sender {{DEFAULT-SIGNER}} \
        --tx-origin {{DEFAULT-SIGNER}}

anvil:
    # start anvil, producing blocks every 10s
    @anvil -b 10

anvil-deploy BRIDGE_VALSET_JSON GOVERNANCE_VALSET_JSON NATIVE_TOKEN_NAME="Wrapped NAM" NATIVE_TOKEN_SYMBOL="wNAM":
    @\
    BRIDGE_VALSET_JSON="{{BRIDGE_VALSET_JSON}}" \
    GOVERNANCE_VALSET_JSON="{{GOVERNANCE_VALSET_JSON}}" \
    NATIVE_TOKEN_NAME="{{NATIVE_TOKEN_NAME}}" \
    NATIVE_TOKEN_SYMBOL="{{NATIVE_TOKEN_SYMBOL}}" \
    MNEMONIC="test test test test test test test test test test test junk" \
        forge script script/deploy.s.sol:Deploy \
            --fork-url http://localhost:8545 \
            --broadcast \
            --via-ir \
            --sender {{DEFAULT-SIGNER}}
