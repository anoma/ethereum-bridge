const { runBenchmark } = require('./utils')
const { updateValidatorSetBenchmark } = require('./bridge')

const benchmarks = [
    updateValidatorSetBenchmark
]

benchmarks.forEach(function(f, index) {
    console.log(`Running benchmark: ${index} of ${benchmarks.length}...`)
    runBenchmark(90, 140, f, { label: "Gas Used", name: "benchmarks/updateValidatorsSet-graph.png" })
})