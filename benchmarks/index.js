const { runBenchmark } = require('./utils')
const { updateValidatorSetBenchmark } = require('./governance')
const { trasferToERC20 } = require('./bridge')

const benchmarks = [
    [updateValidatorSetBenchmark, {
        from: 90,
        to: 140,
        extra: { label: "Gas Used", name: "benchmarks/updateValidatorsSet-graph.png" }
    }],
    [trasferToERC20, {
        from: 1,
        to: 70,
        extra: { label: "Gas Used", name: "benchmarks/trasferToERC20-graph.png" }
    }]
]

benchmarks.forEach(function(run, index) {
    console.log(`Running benchmark: ${index + 1} of ${benchmarks.length}...`)
    const f = run[0]
    const data = run[1]
    runBenchmark(data.from, data.to, f, data.extra)
})