const QuickChart = require('quickchart-js');


const createGraph = async function(x, y, label, name, width=800, height=400) {
    const chart = new QuickChart();

    chart
    .setConfig({
        type: 'line',
        data: { 
            labels: y, 
            datasets: [
                { label: label, data: x }
            ] 
        },
    })
    .setWidth(width)
    .setHeight(height)
    .setBackgroundColor('white');

    chart.toFile(name);
}

const runBenchmark = async function(from, to, func, extra={}) {
    const xs = []
    const ys = []
    for (let step = from; step < to; step++) {
        try {
            const [x, y] = await func(step);
            xs.push(x)
            ys.push(y)
        } catch (e) {
            console.log(`Error: ${e}`)
            continue
        }
        if (step % 10 == 0 && step > from) {
            console.log(`Done step ${step - from} of ${to - from}`)
        }
    }
    
    createGraph(ys, xs, extra.label, extra.name)
}

exports.runBenchmark = runBenchmark;