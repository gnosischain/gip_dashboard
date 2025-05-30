import React from 'react';
import { Bar } from 'react-chartjs-2';
import ENSAuthorDisplay from './ENSAuthorDisplay';
import { GIP } from '../App';
import StatusBars from './StatusBar';
import { computeStatuses } from '../utils/computeState';
import { ChartOptions } from 'chart.js';

interface GIPStatsProps {
  gips: GIP[];
}

const GIPStats = ({ gips }: GIPStatsProps) => {
  const [passed, failed, open] = React.useMemo(
    () => computeStatuses(gips),
    [gips]
  );

  const votesByGIP = React.useMemo(() => {
    const votesData = gips.map((gip) => ({
      x: parseInt(gip.gip_number, 10),
      y: gip.votes || 0,
    }));
    return {
      labels: gips.map((gip) => parseInt(gip.gip_number, 10)),
      datasets: [
        {
          data: votesData,
          backgroundColor: '#42DAA3',
        },
      ],
    };
  }, [gips]);

  const scoresTotalByGIP = React.useMemo(() => {
    const scoresData = gips.map((gip) => ({
      x: parseInt(gip.gip_number, 10),
      y: gip.scores_total || 0,
    }));

    return {
      labels: gips.map((gip) => parseInt(gip.gip_number, 10)),
      datasets: [
        {
          data: scoresData,
          backgroundColor: '#42DAA3',
        },
      ],
    };
  }, [gips]);

  const authorData = React.useMemo(() => {
    const authorCounts = new Map();

    // Handle null authors by replacing with "Unknown"
    gips.forEach((gip) => {
      const author = gip.author || 'Unknown';
      const count = authorCounts.get(author) || 0;
      authorCounts.set(author, count + 1);
    });

    const sortedAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      data: {
        labels: new Array(sortedAuthors.length).fill(''),
        datasets: [
          {
            data: sortedAuthors.map(([, count]) => count),
          },
        ],
      },
      authors: sortedAuthors.map(([author]) => author),
    };
  }, [gips]);

  const chartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'linear',
        ticks: {
          stepSize: 5,
        },
        min: 0,
      },
      y: {
        beginAtZero: true,
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className='flex flex-col w-full'>
      <h3>GIPs Status</h3>

      <StatusBars
        passed={passed}
        failed={failed}
        open={open}
        total={gips.length}
      />

      <h3>Top-10 GIPs Proposers</h3>
      <div className='w-full flex flex-col gap-y-4'>
        {authorData.authors.map((author, index) => (
          <div className='w-full flex flex-col' key={index}>
            <div className='bg-[#F0EBDE] w-1/2 h-6 flex'>{index}</div>
            <div className='bg-[#F0EBDE] w-full h-6 grid grid-cols-2'>
              <div className='w-full flex justify-center'>
                <ENSAuthorDisplay author={author} />
              </div>
              <div className='w-full flex justify-center'>
                {authorData.data.datasets[0].data[index]}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className='mt-10'>Votes by GIP</h3>
      <div className='flex-item h-96'>
        <Bar data={votesByGIP} options={chartOptions} />
      </div>
      <h3>Total Amount by GIP</h3>
      <div className='flex-item h-96'>
        <Bar data={scoresTotalByGIP} options={chartOptions} />
      </div>
    </div>
  );
};

export default GIPStats;
