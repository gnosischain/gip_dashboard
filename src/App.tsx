import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import './App.css';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import GIPTable from './components/GIPTable';
import GIPStats from './components/GIPStats';
import { XMarkIcon } from '@heroicons/react/16/solid';

export interface GIP {
  author: string;
  body: string;
  choices: 'For' | 'Against' | 'Abstain';
  end: number;
  funding:
    | {
        amount: string;
        currency: string;
      }
    | undefined;
  gip_number: string;
  id: string;
  quorum: number;
  scores: number[];
  scores_state: string;
  scores_total: number;
  start: number;
  state: string;
  title: string;
  url: string;
  votes: number;
}

function App() {
  const [gips, setGips] = useState<GIP[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadGIPs = async () => {
    try {
      const gipFiles = Array.from(
        { length: 1000 },
        (_, i) => `GIP-${i + 1}.yml`
      );
      const fetchPromises = gipFiles.map((file) =>
        fetch(`../GIPs/${file}`)
          .then((response) => {
            if (!response.ok) {
              console.warn(`Error fetching ${file}: ${response.statusText}`);
              return null;
            }
            return response.text();
          })
          .catch((error) => {
            console.error(`Fetch failed for ${file}:`, error);
            return null;
          })
      );
      const fileContents = await Promise.all(fetchPromises);

      const parsedGips = fileContents
        .filter((content): content is string => {
          if (!content || content.startsWith('<!doctype html>')) {
            console.warn(
              'Invalid file content, skipping:',
              content?.slice(0, 100)
            );
            return false;
          }
          return true;
        })
        .map((content) => {
          try {
            return yaml.load(content) as GIP;
          } catch (e) {
            console.error('Error parsing YAML:', e);
            return null;
          }
        })
        .filter((gip): gip is GIP => gip !== null);

      setGips(parsedGips);
      console.log('Parsed GIPs:', parsedGips);
    } catch (error) {
      console.error('Error loading GIPs:', error);
    }
  };

  useEffect(() => {
    loadGIPs();
  }, []);
  return (
    <div className='z-50 w-full min-h-screen bg-white text-black flex flex-col lg:pl-[60px] pt-[20px] lg:pt-[40px] max-w-[1160px]'>
      <p className='flex text-3xl lg:text-[56px] max-lg:pl-[16px]'>
        Gnosis Governance Dashboard
      </p>
      <p className='pl-[40px] lg:pl-[60px] mt-6 lg:mt-8'>
        Gnosis Improvement Proposals (GIPs) describe network upgrades for Gnosis
        Chain, funding requests and allocations from the GnosisDAO treasury to
        support the Gnosis ecosystem and GnosisDAO meta governance
        specifications.
      </p>
      <div className='max-lg:px-4 lg:pl-[60px] mt-10 lg:mt-20'>
        <Tabs>
          <div className='w-full bg-white flex sticky top-0 py-2 gap-x-4'>
            <TabList className='flex gap-x-4 text-black/60'>
              <Tab className='p-0 hover:cursor-pointer' selectedClassName='bg-black text-white'>
                Overview
              </Tab>
              <Tab className='p-0 hover:cursor-pointer' selectedClassName='bg-black text-white'>
                Stats
              </Tab>
            </TabList>
            <div className='flex items-center gap-x-1 lg:mr-2'>
              <input
                type='text'
                value={searchTerm}
                placeholder='Search'
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchTerm('');
                  }
                }}
                className='focus:outline-none w-44 px-1'
              />
              <XMarkIcon
                onClick={() => setSearchTerm('')}
                className='w-5 hover:cursor-pointer text-gray-700'
              />
            </div>
          </div>
          <div className='w-full lg:pl-8 mt-8'>
            <TabPanel>
              <GIPTable gips={gips} searchTerm={searchTerm} />
            </TabPanel>
            <TabPanel>
              <GIPStats gips={gips} />
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
