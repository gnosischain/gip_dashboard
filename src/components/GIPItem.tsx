import ReactMarkdown from 'react-markdown';
import ENSAuthorDisplay from './ENSAuthorDisplay';
import { GIP } from '../App';
import DynamicChart from './DynamicChart';
import { useState } from 'react';
import { computeState } from '../utils/computeState';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';

interface GIPItemProps {
  gip: GIP;
}

const GIPItem = ({ gip }: GIPItemProps) => {
  const [open, setOpen] = useState(false);

  const formatDate = (timestamp: number) => {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp * 1000); // Convert UNIX timestamp to JS Date
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  const renderFundingInfo = (gip: GIP) => {
    if (gip.funding && gip.funding.amount && gip.funding.currency) {
      return `${gip.funding.amount} ${gip.funding.currency}`;
    }
    return 'No funding information available';
  };

  const state = computeState(gip.scores, gip.quorum, gip.scores_state);

  const renderChart = (
    scores: number[],
    scores_total: number,
    scores_state: string,
    quorum: number
  ) => {
    // Check if we have valid data for the chart
    if (!scores || !scores.length || !scores_total) {
      return null;
    }
    return (
      <DynamicChart
        scores={scores}
        scores_total={scores_total}
        scores_state={scores_state}
        quorum={quorum}
      />
    );
  };

  return (
    <div
      className={`w-full flex flex-col items-center hover:cursor-pointer ${
        open ? '' : 'hover:bg-black/5'
      } transition-color duration-300 ease-in-out`}
      onClick={() => setOpen(!open)}
    >
      <div className='w-full flex flex-col'>
        <div
          className={`w-full lg:w-1/3 ${
            open ? 'bg-[#F0EBDE]' : ''
          } transition-colors duration-300 ease-in-out`}
        >
          {gip.gip_number}
        </div>
        <div
          className={`w-full flex flex-col lg:grid lg:grid-cols-6 gap-x-3 lg:min-h-20 lg:items-top pl-3 lg:pl-8 ${
            open ? 'bg-[#F0EBDE]' : ''
          } transition-colors duration-300 ease-in-out`}
        >
          <div className='flex gap-x-2 col-span-4'>
            <p className='text-2xl'>{gip.title}</p>
            <a href={gip.url} target='_blank'>
              <ArrowTopRightOnSquareIcon
                className='w-4'
                onClick={(e) => e.stopPropagation()}
              />
            </a>
          </div>
          <p className='text-base font-mono text-neutral-500 max-lg:mt-3'>
            {formatDate(gip.start)}
          </p>
          <div className='flex gap-x-6 font-mono capitalize max-lg:mt-2'>
            <p className='text-neutral-500 text-base'>{gip.state}</p>
            <p
              className={`text-base ${
                state === 'passed' ? 'text-green-400' : 'text-red-500'
              }`}
            >
              {state}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out w-full flex flex-col px-2 lg:pl-[120px] font-mono mt-4 px-2 gap-y-3 ${
          open ? 'max-h-[10000px]' : 'max-h-0'
        }`}
      >
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>Author</span>
          <div className='ml-4'>
            <ENSAuthorDisplay author={gip.author} />
          </div>
        </div>
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>Started</span>
          <p className='ml-4'>{formatDate(gip.start)}</p>
        </div>
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>
            {gip.scores_state !== 'final' ? 'Ending' : 'Ended'}
          </span>
          <p className='ml-4'>{formatDate(gip.end)}</p>
        </div>
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>Requested Funding</span>
          <p className='ml-4'>{renderFundingInfo(gip)}</p>
        </div>
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>State</span>
          <p className='ml-4 capitalize'>{gip.state}</p>
        </div>
        <div className='flex flex-col lg:flex-row'>
          <span className='lg:w-52'>Status</span>
          <p className='ml-4 capitalize'>{state}</p>
        </div>

        {gip.choices &&
          gip.scores &&
          gip.scores.length > 0 &&
          gip.scores_total && (
            <div className='w-full mt-8'>
              {renderChart(
                gip.scores,
                gip.scores_total,
                gip.scores_state,
                gip.quorum
              )}
            </div>
          )}

        <ReactMarkdown className='font-sans'>{gip.body}</ReactMarkdown>
      </div>
    </div>
  );
};

export default GIPItem;
