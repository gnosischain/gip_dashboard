import React, { useState, useMemo } from 'react';
import { Table, Button, Card, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import { Chart, registerables } from 'chart.js';
import 'chart.js/auto';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css'; // Import the CSS file
import annotationPlugin from 'chartjs-plugin-annotation';
import DynamicChart from './DynamicChart';
import ENSAuthorDisplay from './ENSAuthorDisplay';

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

    const renderFundingInfo = (gip) => {
        if (gip.funding && gip.funding.amount && gip.funding.currency) {
            return `${gip.funding.amount} ${gip.funding.currency}`;
        }
        return 'No funding information available';
    };

    const renderChart = (scores, scores_total, scores_state, quorum) => {
        // Check if we have valid data for the chart
        if (!scores || !scores.length || !scores_total) {
            return null;
        }
        return <DynamicChart scores={scores} scores_total={scores_total} scores_state={scores_state} quorum={quorum} />;
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
            <div className="col-started d-none d-md-table-cell">
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
                                        <Card.Body className="mx-auto" style={{ maxWidth: '1000px' }}>
                                            {/* Title Section */}
                                            <h2 className="text-center gip-title">
                                                GIP-{parseInt(gip.gip_number, 10) || 0}: {gip.title}
                                            </h2>
                                            
                                            {/* Metadata Card */}
                                            <Card className="mb-4">
                                                <Card.Body className="p-4">
                                                    <div className="row">
                                                        <div className="col-md-6">
                                                            <p className="mb-2">
                                                                <strong>No.: </strong>
                                                                {parseInt(gip.gip_number, 10) || 0}
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>Author: </strong> <ENSAuthorDisplay author={gip.author} />
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>Started: </strong>
                                                                {formatDate(gip.start)}
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>Proposal: </strong>
                                                                {gip.url ? (
                                                                    <a href={gip.url} target="_blank" rel="noopener noreferrer">
                                                                        link
                                                                    </a>
                                                                ) : 'No link available'}
                                                            </p>
                                                        </div>
                                                        <div className="col-md-6">
                                                            <p className="mb-2">
                                                                <strong>{gip.scores_state !== 'final' ? 'Ending' : 'Ended'}: </strong>
                                                                {formatDate(gip.end)}
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>Requested Funding: </strong>
                                                                {renderFundingInfo(gip)}
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>State: </strong>
                                                                <span className={`badge bg-${getBadge_state(gip.state)}`}>{gip.state}</span>
                                                                <span className="mx-2" />
                                                                <strong>Status: </strong>
                                                                <span className={`badge bg-${getBadge_status(computeState(gip.scores, gip.quorum, gip.scores_state))}`}>
                                                                    {computeState(gip.scores, gip.quorum, gip.scores_state)}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>

                                            {/* Chart Section */}
                                            {gip.choices && gip.scores && gip.scores.length > 0 && gip.scores_total && (
                                                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                                                    <div style={{ width: '100%', maxWidth: '800px' }}>
                                                        {renderChart(gip.scores, gip.scores_total, gip.scores_state, gip.quorum)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Body Content */}
                                            <ReactMarkdown className="text-body left-align">
                                                {gip.body}
                                            </ReactMarkdown>
                                        </Card.Body>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </Table>
            </div>
            <div className="d-flex justify-content-center">
                {renderPagination()}
            </div>
        </div>
    );
};

export default GIPTable;