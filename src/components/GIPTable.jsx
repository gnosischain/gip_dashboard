import React, { useState, useMemo } from 'react';
import { Table, Button, Card, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import 'chart.js/auto';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css'; // Import the CSS file
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin);

const GIPTable = ({ gips }) => {
    const [searchTermNo, setSearchTermNo] = useState("");
    const [searchTermTitle, setSearchTermTitle] = useState("");
    const [details, setDetails] = useState([]);
    //const [gips, setGips] = useState([]);
    const [sortState, setSortState] = useState({
        column: 'gip_number',
        state: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    const columns = useMemo(() => ([
        { key: "gip_number", label: "No.", className: "col-number", sortable: true },
        { key: "title", label: "Title", className: "col-title", sortable: true },
        { key: "start", label: "Started", className: "col-started", sortable: true },
        { key: "state", label: "State", className: "col-state", sortable: true },
        { key: "status", label: "Status", className: "col-status", sortable: true },
        { key: "show_details", label: "", className: "col-details", filter: false, sorter: false },
    ]), []);

    const filteredGips = useMemo(() => {
        return gips.filter(gip => {
            const matchesNo = gip.gip_number.toString().toLowerCase().includes(searchTermNo.toLowerCase());
            const matchesTitle = gip.title.toLowerCase().includes(searchTermTitle.toLowerCase());
            return matchesNo && matchesTitle;
        }).sort((a, b) => {
            const column = sortState.column;
            const order = sortState.state === 'asc' ? 1 : -1;
            let valA = a[column];
            let valB = b[column];
            if (column === 'gip_number') {
                valA = parseInt(valA, 10);
                valB = parseInt(valB, 10);
            }
            return (valA < valB ? -order : valA > valB ? order : 0);
        });
    }, [gips, searchTermNo, searchTermTitle, sortState]);

    const currentGips = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredGips.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredGips, currentPage, itemsPerPage]);

    const formatDate = (timestamp) => {
        if (!timestamp) {
            return ''; 
        }
        const date = new Date(timestamp * 1000); // Convert UNIX timestamp to JS Date
        return date.toLocaleDateString("en-US", {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        });
    };

    const getBadge_state = (state) => {
        const stateMap = {
            "closed": 'black',
            "open": "info",
            "phase-1": 'info',
            "phase-2": 'info'
        };
        return stateMap[state] || 'primary';
    };

    const computeState = (scores, quorum, scores_state) => {
        if (scores_state !== 'final') return '';
        if (!scores || scores.length < 3) return 'invalid'; 

        const [firstScore, ...otherScores] = scores;
        const isHighest = otherScores.every(score => firstScore > score);
        const meetsQuorum = firstScore > quorum;
        return isHighest && meetsQuorum ? 'passed' : 'failed';
    };

    const getBadge_status = (status) => {
        const statusMap = {
            "passed": "success",
            "failed": "danger",
            "pending": "warning"
        };
        return statusMap[status] || 'primary';
    };

    const handleSorted = (column) => {
        setSortState(prevState => ({
            column,
            state: prevState.column === column && prevState.state === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleDetails = (id) => {
        setDetails(prevDetails => {
            console.log("Current details:", prevDetails);
            console.log("Toggling ID:", id);
            const newDetails = prevDetails.includes(id) 
                ? prevDetails.filter(detailId => detailId !== id) 
                : [...prevDetails, id];
            console.log("New details:", newDetails);
            return newDetails;
        });
    };
    

    const renderSortIcon = (column) => {
        if (sortState.column !== column) {
            return null;
        }
        return sortState.state === 'asc' ? '▲' : '▼';
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const renderPagination = () => {
        const totalPages = Math.ceil(filteredGips.length / itemsPerPage);
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(
                <Button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    variant={i === currentPage ? "primary" : "outline-primary"}
                    size="sm"
                    className="m-1"
                >
                    {i}
                </Button>
            );
        }
        return pages;
    };

    const renderBarChart = (scores, scores_state, quorum) => {
        if (scores_state !== 'final') return null;  // It's better to return `null` for React components when not rendering.
    
        const data = {
            labels: [''],  
            datasets: [
                {
                    label: 'For',
                    data: [scores[0]],  // First score for "For"
                    backgroundColor: '#4caf50',
                    borderColor: 'black',
                    borderWidth: 2
                },
                {
                    label: 'Against',
                    data: [scores[1]],  // Second score for "Against"
                    backgroundColor: '#f44336',
                    borderColor: 'black',
                    borderWidth: 2
                },
                {
                    label: 'Abstain',
                    data: [scores[2]],  // Corrected index for "Abstain"
                    backgroundColor: '#ff9800',
                    borderColor: 'black',
                    borderWidth: 2
                },
            ],
        };
    
        const options = {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        display: false, // Hide the grid lines for the x-axis
                        drawBorder: true, // Ensure the border is still drawn
                        color: 'black', // Color of the x-axis grid lines (also affects the axis line)
                        borderWidth: 3, // Thickness of the x-axis line
                        borderColor: 'black' // Color of the x-axis line
                    },
                    ticks: {
                        color: 'black',  
                    },
                    title: {
                        display: true,
                        text: 'Amount',  
                        color: 'black'
                    }
                },
                y: {
                    grid: {
                        display: true, // Hide the grid lines for the x-axis
                        drawBorder: true, // Ensure the border is still drawn
                        color: 'black',
                        borderColor: 'black', // Color of the y-axis grid lines (also affects the axis line)
                        borderWidth: 3, // Thickness of the y-axis line
                    },
                    ticks: {
                        color: 'black', 
                    },
                    title: {
                        display: true,
                        text: 'Vote Type',  // More descriptive title for what the y-axis represents
                        color: 'black'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: 'black'
                    }
                },
                annotation: {
                    annotations: {
                        quorumLine: {
                            type: 'line',
                            xMin: quorum,
                            xMax: quorum,
                            borderColor: 'black',
                            borderWidth: 2,
                            borderDash: [6, 6]
                        }
                    }
                }
            }
        };
    
        return (
            <div style={{ width: '600px', height: '400px' }}>
                <Bar data={data} options={options} />
            </div>
        );
    };


    const renderPieChart = (scores, scores_total, scores_state) => {
        if (scores_state !== 'final') return null;
        const data = {
            labels: ['For', 'Against', 'Abstain'],
            datasets: [
                {
                    data: scores,  // Assuming scores is an array [forVotes, againstVotes, abstainVotes]
                    backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
                    borderColor: ['black', 'black', 'black'],
                    borderWidth: 2
                }
            ]
        };
    
        const options = {
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            let label = data.labels[tooltipItem.dataIndex] || '';
                            if (label) {
                                label += ': ';
                            }
                            const sum = tooltipItem.raw;
                            const percent = (sum / scores_total * 100).toFixed(2);
                            label += `${percent}%`;
                            return label;
                        }
                    }
                }
            }
        };
    
        return (
            <div style={{ display: 'flex', alignItems: 'center', width: '500px', height: '300px' }}>
                <div style={{ flex: 1 }}>
                    <Pie data={data} options={options} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
                    <h3>Total Amount</h3>
                    <h3>{scores_total.toFixed(2)}</h3>
                </div>
            </div>
        );
    };
    
    

      
    return (
        <div className="container">
            <h3>GIPs: Gnosis Improvement Proposals</h3>
            <div className="search-inputs">
                <Form.Control 
                    type="text" 
                    value={searchTermNo} 
                    placeholder="Search by No..."
                    onChange={(e) => setSearchTermNo(e.target.value)}
                    className="search-input search-number"
                />
                <Form.Control 
                    type="text" 
                    value={searchTermTitle} 
                    placeholder="Search by Title..."
                    onChange={(e) => setSearchTermTitle(e.target.value)}
                    className="search-input search-title"
                />
            </div>
            <Table striped hover className="table">
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th 
                                key={col.key} 
                                className={`${col.className} left-align`}
                                onClick={() => col.sortable && handleSorted(col.key)}
                            >
                                {col.label}
                                <span className="sort-icon">{renderSortIcon(col.key)}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {currentGips.map(gip => (
                        <React.Fragment key={gip.id}>
                            <tr>
                                {columns.map(col => (
                                    <td key={col.key} className={`${col.className} left-align`}>
                                        {col.key === 'show_details' ? (
                                            <Button 
                                                variant="outline-primary" 
                                                size="sm" 
                                                onClick={() => toggleDetails(gip.id)}
                                            >
                                                {details.includes(gip.id) ? 'Hide' : 'Show'}
                                            </Button>
                                        ) : col.key === 'start' ? (
                                            formatDate(gip.start)
                                        ) : col.key === 'state' ? (
                                            <span className={`badge bg-${getBadge_state(gip.state)}`}>{gip.state}</span>
                                        ) : col.key === 'status' ? (
                                            <span className={`badge bg-${getBadge_status(computeState(gip.scores, gip.quorum, gip.scores_state))}`}>{computeState(gip.scores, gip.quorum, gip.scores_state)}</span>
                                        ) : (
                                            gip[col.key]
                                        )}
                                    </td>
                                ))}
                            </tr>
                            {details.includes(gip.id) && (
                                <tr>
                                    <td colSpan={columns.length}>
                                        <Card.Body>
                                            <p className="text-muted">No.: {parseInt(gip.gip_number, 10) || 0}</p>
                                            <p className="text-muted">Author: {gip.author}</p>
                                            <h4  style={{ display: 'inline-block', whiteSpace: 'normal', width: '100%'  }}>{gip.title}</h4>
                                            <p className="text-muted">Started: {formatDate(gip.start)}</p>
                                            <p className="text-muted">{gip.scores_state !== 'final' ? 'Ending' : 'Ended'}: {formatDate(gip.end)}</p>
                                            <p className="text-muted">
                                                State: <span className={`badge bg-${getBadge_state(gip.state)}`}>{gip.state}</span>  
                                                <span style={{ display: 'inline-block', width: '20px' }}></span>
                                                Status: <span className={`badge bg-${getBadge_status(computeState(gip.scores, gip.quorum, gip.scores_state))}`}>{computeState(gip.scores, gip.quorum, gip.scores_state)}</span> 
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
                                                {gip.choices && gip.scores && renderBarChart(gip.scores, gip.scores_state, gip.quorum)}
                                                {gip.choices && gip.scores && renderPieChart(gip.scores, gip.scores_total, gip.scores_state)}
                                            </div>
                                            <ReactMarkdown className="text-body left-align">{gip.body}</ReactMarkdown>
                                        </Card.Body>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </Table>
            <div className="d-flex justify-content-center">
                {renderPagination()}
            </div>
        </div>
    );
};

export default GIPTable;
