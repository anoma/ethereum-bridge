# Benchmarks

Measuring gas consumpations of the most critical functions.

# How to run

```
make node
make benchmark
```

# Benchmark

![updateValidatorsSet gas consumptions](images/updateValidatorsSet-graph.png "updateValidatorsSet gas consumptions")

Gas consumption when executing the `updateValidatorsSet` function of the governance contract with different size validator set.

![trasferToERC20 gas consumptions](images/trasferToERC20-graph.png "trasferToERC20 gas consumptions")

Gas consumption when executing the `trasferToERC20` function of the bridge contract with different batch size.