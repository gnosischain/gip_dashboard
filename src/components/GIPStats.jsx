import React from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css'; 
import ENSAuthorDisplay from './ENSAuthorDisplay';

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
    const [passed, failed, open] = React.useMemo(() => computeStatuses(gips), [gips]);

    const votesByGIP = React.useMemo(() => {
        const votesData = gips.map(gip => ({
            x: parseInt(gip.gip_number, 10),
            y: gip.votes || 0
        }));
        return {
            labels: gips.map(gip => parseInt(gip.gip_number, 10)),
            datasets: [{
                label: 'Votes',
                data: votesData,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
            }],
        };
    }, [gips]);

    const scoresTotalByGIP = React.useMemo(() => {
        const scoresData = gips.map(gip => ({
            x: parseInt(gip.gip_number, 10),
            y: gip.scores_total || 0
        }));

        return {
            labels: gips.map(gip => parseInt(gip.gip_number, 10)),
            datasets: [{
                label: 'Amount',
                data: scoresData,
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 2,
            }],
        };
    }, [gips]);

    const authorData = React.useMemo(() => {
        const authorCounts = new Map();
        
        // Handle null authors by replacing with "Unknown"
        gips.forEach(gip => {
            const author = gip.author || "Unknown";
            const count = authorCounts.get(author) || 0;
            authorCounts.set(author, count + 1);
        });

        const sortedAuthors = Array.from(authorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            data: {
                labels: new Array(sortedAuthors.length).fill(''),
                datasets: [{
                    label: 'Number of GIPs',
                    data: sortedAuthors.map(([_, count]) => count),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            authors: sortedAuthors.map(([author]) => author)
        };
    }, [gips]);

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

    const optionsAuthor = {
        indexAxis: 'y',
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Number of GIPs'
                }
            },
            y: {
                ticks: {
                    display: false  // Hide default labels
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `GIPs: ${context.raw}`;
                    },
                    title: function(context) {
                        const author = authorData.authors[context[0].dataIndex];
                        return author;
                    }
                }
            }
        },
        maintainAspectRatio: false
    };

    const options = {
        plugins: {
            legend: {
                display: true,
                position: 'left'
            }
        }
    };

    const chartOptions1 = {
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                ticks: {
                    stepSize: 1,
                    callback: function(value) {
                        if (value % 1 === 0) {
                            return value;
                        }
                    }
                },
                min: 0,
                title: {
                    display: true,
                    text: 'GIP Number'
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'No. of Votes'
                }
            }
        },
        maintainAspectRatio: false,
        plugins: {
            zoom: {
                limits: {
                    x: {min: 0, max: 'original', minRange: 1},
                },
                zoom: {
                    wheel: {
                        enabled: false
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x',
                    onZoomComplete: function({chart}) {
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

    const chartOptions2 = {
        ...chartOptions1,
        scales: {
            ...chartOptions1.scales,
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'GNO Amount'
                }
            }
        }
    };

   
    return (
        <div className="container">
            <h3>GIP Stats</h3>
            <div className="flex-container">
                <div className="chart-container flex-item pie-chart-container">
                    <h3>GIPs Status</h3>
                    <Pie data={statusGIP} options={options} />
                </div>
                <div className="chart-container flex-item" style={{ position: 'relative' }}>
                    <h3>Top-10 GIPs Proposers</h3>
                    <div style={{ display: 'flex', position: 'relative', marginTop: '8px' }}>
                        <div style={{ 
                            position: 'absolute',
                            left: 0,
                            top: '0rem',
                            bottom: 0,
                            width: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            paddingTop: '1px',
                            paddingBottom: '47px'
                        }}>
                            {authorData.authors.map((author, index) => (
                                <div key={author} style={{ 
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    paddingRight: '10px'
                                }}>
                                    {author === "Unknown" ? (
                                        <span>Unknown</span>
                                    ) : (
                                        <ENSAuthorDisplay author={author} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ flex: 1, marginLeft: '200px', height: '360px' }}>
                            <Bar data={authorData.data} options={optionsAuthor} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-container">
                <div className="chart-container flex-item">
                    <h3>Votes by GIP</h3>
                    <Bar data={votesByGIP} options={chartOptions1} />
                </div>
                <div className="chart-container flex-item">
                    <h3>Total Amount by GIP</h3>
                    <Bar data={scoresTotalByGIP} options={chartOptions2} />
                </div>
            </div>
        </div>
    );
};

export default GIPStats;