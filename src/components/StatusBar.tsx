const StatusBars = ({
  passed,
  failed,
  open,
  total,
}: {
  passed: number;
  failed: number;
  open: number;
  total: number;
}) => (
  <div className='w-full flex font-mono font-normal text-xs lg:text-base'>
    {[
      { label: 'Passed', count: passed, color: '#42DAA3' },
      { label: 'Failed', count: failed, color: '#F21162' },
      { label: 'Open', count: open, color: 'black' },
    ].map(({ label, count, color }) => (
      <div
        key={label}
        className='flex flex-col'
        style={{ flexBasis: `${(count / total) * 100}%` }}
      >
        <div style={{ backgroundColor: color }} className='w-1/2 h-8'></div>
        <div style={{ backgroundColor: color }} className='w-full h-8'></div>
        <p
          style={{ color }}
          className={`mt-2 ${color === 'black' ? 'max-lg:ml-2' : ''}`}
        >
          {label}
        </p>
      </div>
    ))}
  </div>
);

export default StatusBars;
