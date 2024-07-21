// src/components/GIPStats.jsx
import React, { useMemo } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css'; 

Chart.register(zoomPlugin);


const computeState = (scores, quorum, scores_state) => {
    if (scores_state !== 'final') return '';
    if (!scores || scores.length < 3) return 'invalid'; 

    const [firstScore, ...otherScores] = scores;
    const isHighest = otherScores.every(score => firstScore > score);
    const meetsQuorum = firstScore > quorum;
    return isHighest && meetsQuorum ? 'passed' : 'failed';
};

const computeStatuses = (gips) => {
    let passed = 0;
    let failed = 0;
    let open = 0;

    gips.forEach(gip => {
        const state = computeState(gip.scores, gip.quorum, gip.scores_state);
        if (state === 'passed') passed++;
        else if (state === 'failed') failed++;
        else open++;
    });

    return [passed, failed, open];
};

const GIPStats = ({ gips }) => {
    const votesByGIP = useMemo(() => {
        const votesData = gips.map(gip => ({
            x: parseInt(gip.gip_number, 10),
            y: gip.votes || 0
        }));
        return {
            labels: gips.map(gip =>  parseInt(gip.gip_number, 10)),
            datasets: [
                {
                    label: 'Votes',
                    data: votesData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                },
            ],
        };
    }, [gips]);

    const scoresTotalByGIP = useMemo(() => {
        const scoresData = gips.map(gip => ({
            x: parseInt(gip.gip_number, 10),
            y: gip.scores_total || 0
        }));

        return {
            labels: gips.map(gip => parseInt(gip.gip_number, 10)),
            datasets: [
                {
                    label: 'Amount',
                    data: scoresData,
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 2,
                },
            ],
        };
    }, [gips]);


    const [passed, failed, open] = useMemo(() => computeStatuses(gips), [gips]);

    const statusGIP = {
        labels: ['Passed', 'Failed', 'Open'],
        datasets: [{
            label: 'GIP Status',
            data: [passed, failed, open],
            backgroundColor: [
                'rgba(75, 192, 192, 0.6)',  // greenish
                'rgba(255, 99, 132, 0.6)',   // reddish
                'rgba(255, 206, 86, 0.6)'    // yellowish
            ],
            borderColor: [
                'rgba(75, 192, 192, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 206, 86, 1)'
            ],
            borderWidth: 1
        }]
    };

    const options = {
        plugins: {
            legend: {
                display: true,
                position: 'left'
            }
        }
    };

    
    
    const chartOptions = {
        scales: {
            x: {
                type: 'linear', // Treat x-axis as a continuous numeric scale
                position: 'bottom',
                ticks: {
                    stepSize: 1, // Ensure steps are in integers
                    callback: function(value, index, values) {
                        // Format ticks to be integers only
                        if (value % 1 === 0) {
                            return value;
                        }
                    }
                },
                min: 0, // Ensures the x-axis doesn't go below zero
            },
            y: {
                beginAtZero: true
            }
        },
        maintainAspectRatio: false,
        plugins: {
            zoom: {
                limits: {
                    x: {min: 0, max: 'original', minRange: 1}, // Adjust 'max' as necessary
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x',
                    onZoomComplete: function({chart}) {
                        // This function ensures that the x-axis does not go below zero after zoom
                        let minVal = chart.scales.x.min;
                        if (minVal < 0) {
                            chart.scales.x.min = 0;
                            chart.update();
                        }
                    }
                },
                pan: {
                    enabled: true,
                    mode: 'x',
                    onPanComplete: function({chart}) {
                        // This function ensures that the x-axis does not go below zero during pan
                        let minVal = chart.scales.x.min;
                        if (minVal < 0) {
                            chart.scales.x.min = 0;
                            chart.update();
                        }
                    }
                }
            }
        }
    };


    const authorChartData = useMemo(() => {
        const counts = {};

        // Count each author's GIPs
        gips.forEach(gip => {
            counts[gip.author] = (counts[gip.author] || 0) + 1;
        });

        // Convert to array and sort by count
        const sortedAuthors = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        // Slice to get top 10
        const topAuthors = sortedAuthors.slice(0, 10);

        // Separate into labels (authors) and data (counts)
        const labels = topAuthors.map(item => item[0]);
        const data = topAuthors.map(item => item[1]);

        return {
            labels,
            datasets: [{
                label: 'Number of GIPs',
                data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        };
    }, [gips]);

    const optionsAuthor = {
        indexAxis: 'y', // Set y-axis as the index axis to create a horizontal bar chart
        scales: {
            x: {
                beginAtZero: true
            }
        },
        plugins: {
            legend: {
                display: false // Set to true if you want to display the dataset label
            }
        }
    };
    

    return (
        <div className="container">
            <h3>GIP Stats</h3>
           
            <div className="flex-container">
                <div className="chart-container flex-ite pie-chart-container ">
                    <h3>GIPs Status</h3>
                    <Pie data={statusGIP} options={options} />
                </div>
                <div className="chart-container flex-item">
                    <h3>Top-10 GIPs Proposers</h3>
                    <Bar data={authorChartData} options={optionsAuthor} />
                </div>
            </div>



            <div className="flex-container">
                <div className="chart-container flex-item">
                    <h3>Votes by GIP</h3>
                    <Bar data={votesByGIP} options={chartOptions} />
                </div>
                <div className="chart-container flex-item">
                    <h3>Total Amount by GIP</h3>
                    <Bar data={scoresTotalByGIP} options={chartOptions} />
                </div>
            </div>
        </div>
    );
};

export default GIPStats;
