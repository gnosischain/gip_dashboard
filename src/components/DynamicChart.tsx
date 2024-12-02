import { useState, useRef, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(...registerables, annotationPlugin);

const BarChartIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <rect x='3' y='3' width='6' height='18' rx='1' fill='currentColor' />
    <rect x='11' y='8' width='6' height='13' rx='1' fill='currentColor' />
    <rect x='19' y='13' width='6' height='8' rx='1' fill='currentColor' />
  </svg>
);

const PieChartIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3V12H21Z'
      fill='currentColor'
    />
    <path
      d='M12 3C16.9706 3 21 7.02944 21 12H12V3Z'
      fill='currentColor'
      fillOpacity='0.5'
    />
  </svg>
);

interface DynamicChartProps {
  scores: number[];
  scores_total: number;
  scores_state: string;
  quorum: number;
}

const DynamicChart = ({
  scores,
  scores_total,
  scores_state,
  quorum,
}: DynamicChartProps) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [legendPosition, setLegendPosition] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    const handleMouseMove = (event: MouseEvent) => {
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          setShowLegend(true);
          setLegendPosition({ x, y });
        } else {
          setShowLegend(false);
        }
      }
    };

    const handleMouseLeave = () => {
      setShowLegend(false);
    };

    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  if (scores_state !== 'final') return null;

  const labels = ['For', 'Against', 'Abstain'];
  const colors = ['#42DAA3', '#F21162', '#F0EBDE'];

  const data = {
    labels: labels,
    datasets: [
      {
        data: scores,
        backgroundColor: colors,
        borderColor: 'black',
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'bar' | 'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
      annotation:
        chartType === 'bar'
          ? {
              annotations: {
                quorumLine: {
                  type: 'line',
                  xMin: quorum,
                  xMax: quorum,
                  borderColor: 'black',
                  borderWidth: 2,
                  borderDash: [6, 6],
                },
              },
            }
          : {},
    },
    ...(chartType === 'bar'
      ? {
          indexAxis: 'y',
          scales: {
            x: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Amount',
                color: 'black',
              },
            },
            y: {
              title: {
                display: false,
                text: 'Vote Type',
                color: 'black',
              },
            },
          },
        }
      : {}),
  };

  const iconStyle = {
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'background-color 0.3s',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: '700px',
        maxHeight: '400px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: '0px',
          zIndex: 1000,
          display: 'flex',
          gap: '10px',
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            setChartType('bar');
          }}
          style={{
            ...iconStyle,
            color: chartType === 'bar' ? '#007bff' : '#666',
          }}
          title='Switch to Bar Chart'
        >
          <BarChartIcon />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            setChartType('pie');
          }}
          style={{
            ...iconStyle,
            color: chartType === 'pie' ? '#007bff' : '#666',
          }}
          title='Switch to Pie Chart'
        >
          <PieChartIcon />
        </div>
      </div>
      <Chart type={chartType} data={data} options={options} />
      {showLegend && (
        <div
          style={{
            position: 'absolute',
            left: `${legendPosition.x + 10}px`,
            top: `${legendPosition.y + 10}px`,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '10px',
            pointerEvents: 'none',
            zIndex: 1000,
            fontSize: '16px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          }}
        >
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {labels.map((label, index) => (
                <tr key={label}>
                  <td style={{ paddingRight: '10px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        backgroundColor: colors[index],
                        marginRight: '5px',
                      }}
                    ></span>
                    {label}:
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {scores[index]} (
                    {((scores[index] / scores_total) * 100).toFixed(2)}%)
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <hr style={{ margin: '5px 0' }} />
                </td>
              </tr>
              <tr>
                <td>Total:</td>
                <td style={{ textAlign: 'right' }}>{scores_total}</td>
              </tr>
              <tr>
                <td>Quorum:</td>
                <td style={{ textAlign: 'right' }}>{quorum}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DynamicChart;
