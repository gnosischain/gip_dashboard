import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Collapse, Card, Form } from 'react-bootstrap';
import yaml from 'js-yaml';
import ReactMarkdown from 'react-markdown';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css'; // Import the CSS file

const GIPTable = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [details, setDetails] = useState([]);
    const [gips, setGips] = useState([]);
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
        return gips.filter(gip =>
            Object.values(gip).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        ).sort((a, b) => {
            const column = sortState.column;
            const order = sortState.state === 'asc' ? 1 : -1;
            let valA = a[column];
            let valB = b[column];
    
            // If sorting by gip_number, convert the values to integers
            if (column === 'gip_number') {
                valA = parseInt(valA, 10);
                valB = parseInt(valB, 10);
            }
    
            if (valA < valB) return -order;
            if (valA > valB) return order;
            return 0;
        });
    }, [gips, searchTerm, sortState]);

    const currentGips = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredGips.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredGips, currentPage, itemsPerPage]);

    const formatDate = (timestamp) => {
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
            "open": "info"
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
    

    const loadGIPs = async () => {
        try {
            const gipFiles = Array.from({ length: 1000 }, (_, i) => `GIP-${i + 1}.yml`);
            const fetchPromises = gipFiles.map(file =>
                fetch(`/GIPs/${file}`)
                    .then(response => response.ok ? response.text() : null)
                    .catch(() => null)
            );
            const fileContents = await Promise.all(fetchPromises);
            const parsedGips = fileContents
                .filter(content => content !== null)
                .map(content => {
                    try {
                        return yaml.load(content);
                    } catch (e) {
                        console.error("Error parsing YAML:", e);
                        return null;
                    }
                })
                .filter(gip => gip !== null && typeof gip === 'object');
            setGips(parsedGips);
        } catch (error) {
            console.error("Error loading GIPs:", error);
        }
    };

    useEffect(() => {
        loadGIPs();
    }, []);

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

    const renderBarChart = (choices, scores, scores_state) => {
        if (scores_state !== 'final') return '';

        const data = {
            labels: choices,
            datasets: [
                {
                    label: 'Votes',
                    data: scores,
                    backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#2196f3'],
                },
            ],
        };

        const options = {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                },
            },
        };

        return (
            <div style={{ width: '600px', height: '400px' }}>
                <Bar data={data} options={options} />
            </div>
        );
    };

      
    return (
        <div className="container">
            <h1>Gnosis Improvement Proposals</h1>
            <Form.Control 
                type="text" 
                value={searchTerm} 
                placeholder="Search GIPs..." 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input left-align"
            />
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
                                            <h4>{gip.title}</h4>
                                            <p className="text-muted">Started: {formatDate(gip.start)}</p>
                                            <p className="text-muted">{gip.scores_state !== 'final' ? 'Ending' : 'Ended'}: {formatDate(gip.end)}</p>
                                            <p className="text-muted">
                                                State: <span className={`badge bg-${getBadge_state(gip.state)}`}>{gip.state}</span>  
                                                <span style={{ display: 'inline-block', width: '20px' }}></span>
                                                Status: <span className={`badge bg-${getBadge_status(computeState(gip.scores, gip.quorum, gip.scores_state))}`}>{computeState(gip.scores, gip.quorum, gip.scores_state)}</span> 
                                            </p>
                                            {gip.choices && gip.scores && renderBarChart(gip.choices, gip.scores, gip.scores_state)}
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
