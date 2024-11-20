import { useState, useMemo } from 'react';
import GIPItem from './GIPItem';
import { GIP } from '../App';

interface GIPTableProps {
  gips: GIP[];
  searchTerm: string;
}

const GIPTable = ({ gips, searchTerm }: GIPTableProps) => {
  const [sortState, setSortState] = useState<{
    column: 'gip_number' | 'title' | 'start' | 'state';
    state: 'asc' | 'desc';
  }>({
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
        valA = parseInt(valA as string, 10);
        valB = parseInt(valB as string, 10);

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
      <div className='max-sm:hidden w-full flex font-mono bg-gray-100'>
        <button
          onClick={() =>
            setSortState((prev) => ({
              column: 'gip_number',
              state:
                prev.column === 'gip_number' && prev.state === 'asc'
                  ? 'desc'
                  : 'asc',
            }))
          }
          className='text-sm mr-2'
        >
          GIP
          {sortState.column === 'gip_number'
            ? sortState.state === 'asc'
              ? '🔼'
              : '🔽'
            : ''}
        </button>
        <div className='w-full grid grid-cols-6'>
          <button
            onClick={() =>
              setSortState((prev) => ({
                column: 'title',
                state:
                  prev.column === 'title' && prev.state === 'asc'
                    ? 'desc'
                    : 'asc',
              }))
            }
            className='flex col-span-4 text-sm'
          >
            Title
            {sortState.column === 'title'
              ? sortState.state === 'asc'
                ? '🔼'
                : '🔽'
              : ''}
          </button>
          <button
            onClick={() =>
              setSortState((prev) => ({
                column: 'start',
                state:
                  prev.column === 'start' && prev.state === 'asc'
                    ? 'desc'
                    : 'asc',
              }))
            }
            className='flex col-span-1 text-sm'
          >
            Date
            {sortState.column === 'start'
              ? sortState.state === 'asc'
                ? '🔼'
                : '🔽'
              : ''}
          </button>
          <button
            onClick={() =>
              setSortState((prev) => ({
                column: 'state',
                state:
                  prev.column === 'state' && prev.state === 'asc'
                    ? 'desc'
                    : 'asc',
              }))
            }
            className='flex col-span-1 text-sm'
          >
            State
            {sortState.column === 'state'
              ? sortState.state === 'asc'
                ? '🔼'
                : '🔽'
              : ''}
          </button>
        </div>
      </div>

      <div className='flex flex-col gap-y-6 mt-4'>
        {visibleGips.map((gip) => (
          <GIPItem key={gip.id} gip={gip} />
        ))}
      </div>

      {visibleCount < filteredAndSortedGips.length && (
        <div className='flex justify-center mt-3'>
          <button onClick={loadMore} className='text-white px-4 py-2 rounded'>
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default GIPTable;
