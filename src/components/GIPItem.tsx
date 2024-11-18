import { Card } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import ENSAuthorDisplay from './ENSAuthorDisplay';
import { GIP } from '../App';
import DynamicChart from './DynamicChart';
import { useState } from 'react';

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

  const getBadge_state = (state: string) => {
    const stateMap = {
      closed: 'black',
      open: 'info',
      'phase-1': 'info',
      'phase-2': 'info',
    };
    return stateMap[state] || 'primary';
  };

  const getBadge_status = (status) => {
    const statusMap = {
      passed: 'success',
      failed: 'danger',
      pending: 'warning',
    };
    return statusMap[status] || 'primary';
  };

  const computeState = (
    scores: string | any[],
    quorum: number,
    scores_state: string
  ) => {
    if (scores_state !== 'final') return '';
    if (!scores || scores.length < 3) return 'invalid';

    const [firstScore, ...otherScores] = scores;
    const isHighest = otherScores.every((score) => firstScore > score);
    const meetsQuorum = firstScore > quorum;
    return isHighest && meetsQuorum ? 'passed' : 'failed';
  };

  const renderFundingInfo = (gip: GIP) => {
    if (gip.funding && gip.funding.amount && gip.funding.currency) {
      return `${gip.funding.amount} ${gip.funding.currency}`;
    }
    return 'No funding information available';
  };

  const renderChart = (
    scores: string | any[],
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
      className='w-full flex flex-col items-center'
      onClick={() => setOpen(!open)}
    >
      <p className='w-full'>{gip.gip_number}</p>
      <p className='text-2xl'>{gip.title}</p>
      <p className='text-base'>{formatDate(gip.start)}</p>
      <div className='flex gap-x-2'>
        <p>{gip.state}</p>
        <p>{computeState(gip.scores, gip.quorum, gip.scores_state)}</p>
      </div>
      {open && (
        <tr>
          <td colSpan={6}>
            <Card.Body className='mx-auto' style={{ maxWidth: '1000px' }}>
              {/* Title Section */}
              <h2 className='text-center gip-title'>
                GIP-{parseInt(gip.gip_number, 10) || 0}: {gip.title}
              </h2>

              {/* Metadata Card */}
              <Card className='mb-4'>
                <Card.Body className='p-4'>
                  <div className='row'>
                    <div className='col-md-6'>
                      <p className='mb-2'>
                        <strong>No.: </strong>
                        {parseInt(gip.gip_number, 10) || 0}
                      </p>
                      <p className='mb-2'>
                        <strong>Author: </strong>{' '}
                        <ENSAuthorDisplay author={gip.author} />
                      </p>
                      <p className='mb-2'>
                        <strong>Started: </strong>
                        {formatDate(gip.start)}
                      </p>
                      <p className='mb-2'>
                        <strong>Proposal: </strong>
                        {gip.url ? (
                          <a
                            href={gip.url}
                            target='_blank'
                            rel='noopener noreferrer'
                          >
                            link
                          </a>
                        ) : (
                          'No link available'
                        )}
                      </p>
                    </div>
                    <div className='col-md-6'>
                      <p className='mb-2'>
                        <strong>
                          {gip.scores_state !== 'final' ? 'Ending' : 'Ended'}:{' '}
                        </strong>
                        {formatDate(gip.end)}
                      </p>
                      <p className='mb-2'>
                        <strong>Requested Funding: </strong>
                        {renderFundingInfo(gip)}
                      </p>
                      <p className='mb-2'>
                        <strong>State: </strong>
                        <span
                          className={`badge bg-${getBadge_state(gip.state)}`}
                        >
                          {gip.state}
                        </span>
                        <span className='mx-2' />
                        <strong>Status: </strong>
                        <span
                          className={`badge bg-${getBadge_status(
                            computeState(
                              gip.scores,
                              gip.quorum,
                              gip.scores_state
                            )
                          )}`}
                        >
                          {computeState(
                            gip.scores,
                            gip.quorum,
                            gip.scores_state
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Chart Section */}
              {gip.choices &&
                gip.scores &&
                gip.scores.length > 0 &&
                gip.scores_total && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '20px 0',
                    }}
                  >
                    <div style={{ width: '100%', maxWidth: '800px' }}>
                      {renderChart(
                        gip.scores,
                        gip.scores_total,
                        gip.scores_state,
                        gip.quorum
                      )}
                    </div>
                  </div>
                )}

              {/* Body Content */}
              <ReactMarkdown className='text-body left-align'>
                {gip.body}
              </ReactMarkdown>
            </Card.Body>
          </td>
        </tr>
      )}
    </div>
  );
};

export default GIPItem;
