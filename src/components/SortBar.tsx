import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
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
    <div className='max-sm:hidden w-full flex font-mono bg-gray-100 shadow-sm hover:shadow-md transition duration-300 ease-in-out py-2'>
      <button
        onClick={() => handleSort('gip_number')}
        className='flex items-center text-sm mr-2'
      >
        GIP
        {sortState.column === 'gip_number' ? (
          sortState.state === 'asc' ? (
            <ChevronUpIcon className='w-4 text-blue-500' />
          ) : (
            <ChevronDownIcon className='w-4 text-blue-500' />
          )
        ) : (
          <ChevronDownIcon className='w-4' />
        )}
      </button>
      <div className='w-full grid grid-cols-6'>
        <button
          onClick={() => handleSort('title')}
          className='flex items-center col-span-4 text-sm'
        >
          Title
          {sortState.column === 'title' ? (
            sortState.state === 'asc' ? (
              <ChevronUpIcon className='w-4 text-blue-500' />
            ) : (
              <ChevronDownIcon className='w-4 text-blue-500' />
            )
          ) : (
            <ChevronDownIcon className='w-4' />
          )}
        </button>
        <button
          onClick={() => handleSort('start')}
          className='flex items-center col-span-1 text-sm'
        >
          Date
          {sortState.column === 'start' ? (
            sortState.state === 'asc' ? (
              <ChevronUpIcon className='w-4 text-blue-500' />
            ) : (
              <ChevronDownIcon className='w-4 text-blue-500' />
            )
          ) : (
            <ChevronDownIcon className='w-4' />
          )}
        </button>
        <button
          onClick={() => handleSort('state')}
          className='flex items-center col-span-1 text-sm'
        >
          State
          {sortState.column === 'state' ? (
            sortState.state === 'asc' ? (
              <ChevronUpIcon className='w-4 text-blue-500' />
            ) : (
              <ChevronDownIcon className='w-4 text-blue-500' />
            )
          ) : (
            <ChevronDownIcon className='w-4' />
          )}
        </button>
      </div>
    </div>
  );
};

export default SortBar;
