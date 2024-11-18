import React, { useState, useMemo } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { Chart, registerables } from 'chart.js';
import 'chart.js/auto';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css';
import annotationPlugin from 'chartjs-plugin-annotation';
import GIPItem from './GIPItem';
import { GIP } from '../App';

Chart.register(...registerables, annotationPlugin);

interface GIPTableProps {
  gips: GIP[];
}

const GIPTable = ({ gips }: GIPTableProps) => {
  const [searchTermNo, setSearchTermNo] = useState('');
  const [searchTermTitle, setSearchTermTitle] = useState('');
  //const [gips, setGips] = useState([]);
  const [sortState, setSortState] = useState({
    column: 'gip_number',
    state: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const columns = useMemo(
    () => [
      {
        key: 'gip_number',
        label: 'No.',
        className: 'col-number',
        sortable: true,
      },
      { key: 'title', label: 'Title', className: 'col-title', sortable: true },
      {
        key: 'start',
        label: 'Started',
        className: 'col-started',
        sortable: true,
      },
      { key: 'state', label: 'State', className: 'col-state', sortable: true },
      {
        key: 'status',
        label: 'Status',
        className: 'col-status',
        sortable: true,
      },
      {
        key: 'show_details',
        label: '',
        className: 'col-details',
        filter: false,
        sorter: false,
      },
    ],
    []
  );

  const filteredGips = useMemo(() => {
    return gips
      .filter((gip) => {
        const matchesNo = gip.gip_number
          .toString()
          .toLowerCase()
          .includes(searchTermNo.toLowerCase());
        const matchesTitle = gip.title
          .toLowerCase()
          .includes(searchTermTitle.toLowerCase());
        return matchesNo && matchesTitle;
      })
      .sort((a, b) => {
        const column = sortState.column;
        const order = sortState.state === 'asc' ? 1 : -1;
        let valA = a[column];
        let valB = b[column];
        if (column === 'gip_number') {
          valA = parseInt(valA, 10);
          valB = parseInt(valB, 10);
        }
        return valA < valB ? -order : valA > valB ? order : 0;
      });
  }, [gips, searchTermNo, searchTermTitle, sortState]);

  const currentGips = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGips.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGips, currentPage, itemsPerPage]);

  const handleSorted = (column) => {
    setSortState((prevState) => ({
      column,
      state:
        prevState.column === column && prevState.state === 'asc'
          ? 'desc'
          : 'asc',
    }));
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
          variant={i === currentPage ? 'primary' : 'outline-primary'}
          size='sm'
          className='m-1'
        >
          {i}
        </Button>
      );
    }
    return pages;
  };

  return (
    <div className='w-full'>
      <div className='search-inputs'>
        <Form.Control
          type='text'
          value={searchTermNo}
          placeholder='Search by No...'
          onChange={(e) => setSearchTermNo(e.target.value)}
          className='search-input search-number'
        />
        <Form.Control
          type='text'
          value={searchTermTitle}
          placeholder='Search by Title...'
          onChange={(e) => setSearchTermTitle(e.target.value)}
          className='search-input search-title'
        />
      </div>
      <Table striped hover className='table'>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.className} left-align`}
                onClick={() => col.sortable && handleSorted(col.key)}
              >
                {col.label}
                <span className='sort-icon'>{renderSortIcon(col.key)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {currentGips.map((gip) => (
            <GIPItem gip={gip} />
          ))}
        </tbody>
      </Table>
      <div className='d-flex justify-content-center'>{renderPagination()}</div>
    </div>
  );
};

export default GIPTable;
