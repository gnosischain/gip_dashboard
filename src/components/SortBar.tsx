import React from 'react';

interface SortBarProps {
  sortState: {
    column: 'gip_number' | 'title' | 'start' | 'state';
    state: 'asc' | 'desc';
  };
  setSortState: React.Dispatch<
    React.SetStateAction<{
      column: 'gip_number' | 'title' | 'start' | 'state';
      state: 'asc' | 'desc';
    }>
  >;
}

const SortBar = ({ sortState, setSortState }: SortBarProps) => {
  const handleSort = (column: 'gip_number' | 'title' | 'start' | 'state') => {
    setSortState((prev) => ({
      column,
      state: prev.column === column && prev.state === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className='max-sm:hidden w-full flex font-mono bg-gray-100'>
      <button
        onClick={() => handleSort('gip_number')}
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
          onClick={() => handleSort('title')}
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
          onClick={() => handleSort('start')}
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
          onClick={() => handleSort('state')}
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
  );
};

export default SortBar;
