import { useState, useMemo } from 'react';
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
  const [sortState, setSortState] = useState({
    column: 'gip_number',
    state: 'desc',
  });
  const [visibleCount, setVisibleCount] = useState(50);

  const filteredGips = useMemo(() => {
    return gips
      .filter((gip) => {
        const matchesNo = gip.gip_number.toString().includes(searchTermNo);
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

  const visibleGips = useMemo(() => {
    return filteredGips.slice(0, visibleCount);
  }, [filteredGips, visibleCount]);

  const loadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  return (
    <div>
      <div className='search-inputs'>
        <Form.Control
          type='text'
          value={searchTermNo}
          placeholder='Search by No...'
          onChange={(e) => setSearchTermNo(e.target.value)}
        />
        <Form.Control
          type='text'
          value={searchTermTitle}
          placeholder='Search by Title...'
          onChange={(e) => setSearchTermTitle(e.target.value)}
        />
      </div>
      <div>
        <tr>
          <th>No.</th>
          <th>Title</th>
          <th>Started</th>
          <th>State</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
        {visibleGips.map((gip) => (
          <GIPItem key={gip.id} gip={gip} />
        ))}
      </div>
      {visibleCount < filteredGips.length && (
        <div className='text-center mt-3'>
          <Button onClick={loadMore}>Load More</Button>
        </div>
      )}
    </div>
  );
};

export default GIPTable;
