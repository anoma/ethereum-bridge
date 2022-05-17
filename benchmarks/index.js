const { runBenchmark } = require('./utils')
const { updateValidatorSetBenchmark, updateValidatorSetBenchmarkFixed } = require('./governance')
const { trasferToERC20 } = require('./bridge')

const benchmarks = [
    [updateValidatorSetBenchmark, {
        from: 120,
        to: 180,
        extra: { label: "Gas Used", name: "benchmarks/updateValidatorsSet-graph.png" }
    }],
    [trasferToERC20, {
        from: 1,
        to: 100,
        extra: { label: "Gas Used", name: "benchmarks/trasferToERC20-graph.png" }
    }],
    [updateValidatorSetBenchmarkFixed, {
        from: 1,
        to: 25,
        extra: { label: "Gas Used", name: "benchmarks/updateValidatorsSetFixed125-graph.png" }
    }],
]

benchmarks.forEach(function(run, index) {
    console.log(`Running benchmark: ${index + 1} of ${benchmarks.length}...`)
    const f = run[0]
    const data = run[1]
    runBenchmark(data.from, data.to, f, data.extra)
})