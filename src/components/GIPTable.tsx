import { useState, useMemo } from 'react';
import GIPItem from './GIPItem';
import { GIP } from '../App';

interface GIPTableProps {
  gips: GIP[];
  searchTerm: string;
}

const GIPTable = ({ gips, searchTerm }: GIPTableProps) => {
  const [sortState, setSortState] = useState({
    column: 'gip_number',
    state: 'desc',
  });
  const [visibleCount, setVisibleCount] = useState(20);

  const filteredAndSortedGips = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();

    const filtered = gips.filter((gip) => {
      return (
        gip.gip_number.toString().includes(lowerSearchTerm) ||
        gip.title.toLowerCase().includes(lowerSearchTerm)
      );
    });

    const sorted = filtered.sort((a, b) => {
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

    return sorted;
  }, [gips, searchTerm, sortState]);

  const visibleGips = useMemo(() => {
    return filteredAndSortedGips.slice(0, visibleCount);
  }, [filteredAndSortedGips, visibleCount]);

  const loadMore = () => {
    setVisibleCount((prev) => prev + 20);
  };

  return (
    <div>
      <div className='flex flex-col gap-y-6 mt-4'>
        {visibleGips.map((gip) => (
          <GIPItem key={gip.id} gip={gip} />
        ))}
      </div>

      {visibleCount < filteredAndSortedGips.length && (
        <div className='flex justify-center mt-3'>
          <button
            onClick={loadMore}
            className='text-white px-4 py-2 rounded'
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default GIPTable;
